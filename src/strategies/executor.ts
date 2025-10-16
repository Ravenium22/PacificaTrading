import { Strategy, Execution, TWAPConfig, DCAConfig, GridConfig, TrailingStopConfig } from '../database/models/Strategy';
import { decryptApiKey } from '../utils/encryption';
import { PacificaRestClient } from '../api/rest-client';

// Price cache to avoid excessive API calls
const priceCache = new Map<string, { price: number; timestamp: number }>();
const PRICE_CACHE_TTL = 30000; // 30 seconds

/**
 * Main strategy executor - runs every minute
 */
export class StrategyExecutor {
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;

  constructor() {
    // Constructor
  }

  /**
   * Start the executor loop
   */
  public start(): void {
    if (this.isRunning) {
      console.log('[StrategyExecutor] Already running');
      return;
    }

    console.log('[StrategyExecutor] Starting strategy executor...');
    this.isRunning = true;

    // Run immediately
    this.executeAllStrategies();

    // Then run every minute
    this.intervalId = setInterval(() => {
      this.executeAllStrategies();
    }, 60000);
  }

  /**
   * Stop the executor loop
   */
  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.isRunning = false;
    console.log('[StrategyExecutor] Stopped');
  }

  /**
   * Execute all active strategies
   */
  private async executeAllStrategies(): Promise<void> {
    try {
      const strategies = await Strategy.findAll({
        where: { is_active: true },
      });

      console.log(`[StrategyExecutor] Found ${strategies.length} active strategies`);

      for (const strategy of strategies) {
        try {
          // Auto-pause if too many errors
          if (strategy.shouldPause()) {
            await strategy.update({ is_active: false });
            console.log(`[StrategyExecutor] Auto-paused strategy ${strategy.id} due to excessive errors`);
            continue;
          }

          // Skip if completed
          if (strategy.isCompleted()) {
            await strategy.update({
              is_active: false,
              completed_at: new Date()
            });
            console.log(`[StrategyExecutor] Strategy ${strategy.id} completed`);
            continue;
          }

          await this.executeStrategy(strategy);
        } catch (error) {
          console.error(`[StrategyExecutor] Error executing strategy ${strategy.id}:`, error);
          await strategy.update({
            error_count: strategy.error_count + 1,
            last_error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    } catch (error) {
      console.error('[StrategyExecutor] Error fetching strategies:', error);
    }
  }

  /**
   * Execute a single strategy based on its type
   */
  private async executeStrategy(strategy: Strategy): Promise<void> {
    console.log(`[StrategyExecutor] Executing ${strategy.strategy_type} strategy ${strategy.id}`);

    switch (strategy.strategy_type) {
      case 'twap':
        await this.executeTWAP(strategy);
        break;
      case 'dca':
        await this.executeDCA(strategy);
        break;
      case 'grid':
        await this.executeGrid(strategy);
        break;
      case 'trailing_stop':
        await this.executeTrailingStop(strategy);
        break;
      default:
        throw new Error(`Unknown strategy type: ${strategy.strategy_type}`);
    }
  }

  /**
   * Execute TWAP (Time-Weighted Average Price) strategy
   * Splits total amount across N intervals
   */
  private async executeTWAP(strategy: Strategy): Promise<void> {
    const config = strategy.config as TWAPConfig;
    const now = new Date();
    const createdAt = new Date(strategy.created_at);

    // Calculate elapsed time
    const elapsedMinutes = (now.getTime() - createdAt.getTime()) / 60000;
    const targetMinutes = config.duration_minutes;

    // Check if strategy duration has passed
    if (elapsedMinutes >= targetMinutes) {
      await strategy.update({ is_active: false, completed_at: now });
      console.log(`[TWAP] Strategy ${strategy.id} duration completed`);
      return;
    }

    // Check if it's time for next execution
    const minutesSinceLastExecution = strategy.last_execution
      ? (now.getTime() - new Date(strategy.last_execution).getTime()) / 60000
      : config.interval_minutes;

    if (minutesSinceLastExecution < config.interval_minutes) {
      console.log(`[TWAP] Strategy ${strategy.id} waiting for next interval`);
      return;
    }

    // Calculate order size
    const totalIntervals = Math.floor(config.duration_minutes / config.interval_minutes);
    const amountPerInterval = strategy.total_amount / totalIntervals;
    const remainingAmount = strategy.getRemainingAmount();
    const orderAmount = Math.min(amountPerInterval, remainingAmount);

    if (orderAmount < 10) {
      console.log(`[TWAP] Strategy ${strategy.id} order amount too small: $${orderAmount}`);
      return;
    }

    // Execute order
    await this.executeMarketOrder(strategy, 'buy', orderAmount);
  }

  /**
   * Execute DCA (Dollar Cost Averaging) strategy
   * Fixed amount at fixed intervals
   */
  private async executeDCA(strategy: Strategy): Promise<void> {
    const config = strategy.config as DCAConfig;
    const now = new Date();

    // Check if it's time for next execution
    let nextExecution = config.next_execution ? new Date(config.next_execution) : new Date(strategy.created_at);

    if (now < nextExecution) {
      console.log(`[DCA] Strategy ${strategy.id} waiting for next execution at ${nextExecution.toISOString()}`);
      return;
    }

    // Calculate next execution time
    const nextExecutionTime = new Date(now.getTime() + config.frequency_hours * 3600000);

    // Update config with next execution time
    await strategy.update({
      config: {
        ...config,
        next_execution: nextExecutionTime,
      },
    });

    // Execute order
    const remainingAmount = strategy.getRemainingAmount();
    const orderAmount = Math.min(config.buy_amount, remainingAmount);

    if (orderAmount < 10) {
      console.log(`[DCA] Strategy ${strategy.id} completed or order too small`);
      await strategy.update({ is_active: false, completed_at: now });
      return;
    }

    await this.executeMarketOrder(strategy, 'buy', orderAmount);
  }

  /**
   * Execute Grid trading strategy
   * Place limit orders at price levels
   */
  private async executeGrid(strategy: Strategy): Promise<void> {
    const config = strategy.config as GridConfig;

    try {
      // Get current price
      const currentPrice = await this.getCurrentPrice(strategy.symbol);

      // Calculate grid levels
      const priceRange = config.upper_price - config.lower_price;
      const levelSpacing = priceRange / (config.grid_levels - 1);

      // Initialize orders if not exists
      if (!config.orders) {
        console.log(`[Grid] Strategy ${strategy.id} initializing grid...`);

        const orders: Array<{ price: number; size: number; side: 'buy' | 'sell'; orderId?: string }> = [];
        const amountPerLevel = strategy.total_amount / config.grid_levels;

        // Decrypt API key
        const apiKey = this.decryptApiKey(strategy.api_key_encrypted);
        const restClient = this.getRestClient(strategy.user_wallet, apiKey);

        // Create orders at each grid level
        for (let i = 0; i < config.grid_levels; i++) {
          const price = config.lower_price + (levelSpacing * i);
          const side: 'buy' | 'sell' = price < currentPrice ? 'buy' : 'sell';
          const size = amountPerLevel / price;

          try {
            // Place limit order at this level
            const orderResponse = await restClient.createLimitOrder({
              symbol: strategy.symbol,
              amount: size.toFixed(8),
              side: side === 'buy' ? 'bid' : 'ask',
              price: price.toFixed(2),
              post_only: true,
            });

            if (orderResponse.success && orderResponse.data?.order_id) {
              orders.push({
                price,
                size,
                side,
                orderId: orderResponse.data.order_id,
              });

              // Create execution record
              await this.createExecution(strategy.id, {
                symbol: strategy.symbol,
                side,
                size,
                price,
                amount: amountPerLevel,
                status: 'open',
                order_id: orderResponse.data.order_id,
              });

              console.log(`[Grid] Strategy ${strategy.id} placed ${side} order at $${price.toFixed(2)} (${size.toFixed(8)})`);
            } else {
              console.error(`[Grid] Strategy ${strategy.id} failed to place order at $${price.toFixed(2)}`);
            }
          } catch (error) {
            console.error(`[Grid] Strategy ${strategy.id} error placing order at $${price.toFixed(2)}:`, error);
          }
        }

        // Save orders to config
        await strategy.update({
          config: { ...config, orders },
        });

        console.log(`[Grid] Strategy ${strategy.id} initialized with ${orders.length} orders`);
        return;
      }

      // Check for filled orders and place opposite orders
      const restClient = this.getRestClient(strategy.user_wallet, this.decryptApiKey(strategy.api_key_encrypted));
      const openOrdersResponse = await restClient.getOpenOrders(strategy.user_wallet);

      if (!openOrdersResponse.success) {
        console.error(`[Grid] Strategy ${strategy.id} failed to fetch open orders`);
        return;
      }

      const openOrderIds = new Set(
        (openOrdersResponse.data?.orders || []).map((o: any) => o.order_id)
      );

      // Check each grid order
      for (const order of config.orders || []) {
        if (!order.orderId) continue;

        // If order is not in open orders, it was filled
        if (!openOrderIds.has(order.orderId)) {
          console.log(`[Grid] Strategy ${strategy.id} order filled at $${order.price.toFixed(2)}`);

          // Update execution record
          const execution = await this.findExecutionByOrderId(order.orderId);
          if (execution) {
            await execution.update({ status: 'filled' });
          }

          // Calculate opposite side price (one level away)
          const oppositeSide: 'buy' | 'sell' = order.side === 'buy' ? 'sell' : 'buy';
          const oppositePrice = oppositeSide === 'sell'
            ? order.price + levelSpacing
            : order.price - levelSpacing;

          // Only place opposite order if within grid range
          if (oppositePrice >= config.lower_price && oppositePrice <= config.upper_price) {
            try {
              const orderResponse = await restClient.createLimitOrder({
                symbol: strategy.symbol,
                amount: order.size.toFixed(8),
                side: oppositeSide === 'buy' ? 'bid' : 'ask',
                price: oppositePrice.toFixed(2),
                post_only: true,
              });

              if (orderResponse.success && orderResponse.data?.order_id) {
                // Update the order with new ID and price
                order.orderId = orderResponse.data.order_id;
                order.price = oppositePrice;
                order.side = oppositeSide;

                // Create new execution record
                await this.createExecution(strategy.id, {
                  symbol: strategy.symbol,
                  side: oppositeSide,
                  size: order.size,
                  price: oppositePrice,
                  amount: order.size * oppositePrice,
                  status: 'open',
                  order_id: orderResponse.data.order_id,
                });

                console.log(`[Grid] Strategy ${strategy.id} placed opposite ${oppositeSide} order at $${oppositePrice.toFixed(2)}`);
              }
            } catch (error) {
              console.error(`[Grid] Strategy ${strategy.id} error placing opposite order:`, error);
            }
          }

          // Update executed amount
          const executedValue = order.size * order.price;
          await strategy.update({
            executed_amount: Number(strategy.executed_amount) + executedValue,
          });
        }
      }

      // Save updated orders
      await strategy.update({
        config: { ...config, orders: config.orders },
        last_execution: new Date(),
      });

    } catch (error) {
      console.error(`[Grid] Strategy ${strategy.id} execution error:`, error);
      throw error;
    }
  }

  /**
   * Execute Trailing Stop strategy
   * Follow price up, sell on X% drop
   */
  private async executeTrailingStop(strategy: Strategy): Promise<void> {
    const config = strategy.config as TrailingStopConfig;
    const currentPrice = await this.getCurrentPrice(strategy.symbol);

    // Initialize highest price if not set
    if (!config.highest_price) {
      await strategy.update({
        config: {
          ...config,
          highest_price: currentPrice,
          triggered: false,
        },
      });
      console.log(`[TrailingStop] Strategy ${strategy.id} initialized at price ${currentPrice}`);
      return;
    }

    // Update highest price if current is higher
    if (currentPrice > config.highest_price) {
      await strategy.update({
        config: {
          ...config,
          highest_price: currentPrice,
        },
      });
      console.log(`[TrailingStop] Strategy ${strategy.id} new high: ${currentPrice}`);
    }

    // Check if stop is triggered
    const dropPercent = ((config.highest_price - currentPrice) / config.highest_price) * 100;

    if (dropPercent >= config.trail_percent) {
      console.log(`[TrailingStop] Strategy ${strategy.id} triggered! Drop: ${dropPercent.toFixed(2)}%`);

      // Execute sell order
      const remainingAmount = strategy.getRemainingAmount();
      if (remainingAmount > 0) {
        await this.executeMarketOrder(strategy, 'sell', strategy.total_amount);
      }

      await strategy.update({
        is_active: false,
        completed_at: new Date(),
        config: { ...config, triggered: true },
      });
    }
  }

  /**
   * Execute a market order via Pacifica
   */
  private async executeMarketOrder(
    strategy: Strategy,
    side: 'buy' | 'sell',
    amountUsd: number
  ): Promise<void> {
    console.log(`[Executor] Executing ${side} order for strategy ${strategy.id}: $${amountUsd}`);

    try {
      // Decrypt API key
      const apiKey = decryptApiKey(strategy.api_key_encrypted);

      // Get current price
      const price = await this.getCurrentPrice(strategy.symbol);

      // Calculate size
      const size = amountUsd / price;

      // Create execution record
      const execution = await Execution.create({
        strategy_id: strategy.id,
        symbol: strategy.symbol,
        side,
        size,
        price,
        amount: amountUsd,
        status: 'pending',
      });

      // TODO: Execute order via Pacifica
      // For now, we'll simulate the order
      // In production, this would call: await this.pacificaService.placeOrder(...)

      console.log(`[Executor] Order placed: ${size} ${strategy.symbol} at ${price}`);

      // Update execution as filled
      await execution.update({
        status: 'filled',
        order_id: `sim-${Date.now()}`, // Simulated order ID
      });

      // Update strategy
      await strategy.update({
        executed_amount: Number(strategy.executed_amount) + amountUsd,
        last_execution: new Date(),
        error_count: 0, // Reset error count on success
      });

      console.log(`[Executor] Strategy ${strategy.id} executed: ${strategy.getProgress().toFixed(2)}% complete`);
    } catch (error) {
      console.error(`[Executor] Error executing order for strategy ${strategy.id}:`, error);

      await Execution.create({
        strategy_id: strategy.id,
        symbol: strategy.symbol,
        side,
        size: 0,
        price: 0,
        amount: amountUsd,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Get current price for a symbol (with caching)
   */
  private async getCurrentPrice(symbol: string): Promise<number> {
    const cached = priceCache.get(symbol);
    const now = Date.now();

    if (cached && now - cached.timestamp < PRICE_CACHE_TTL) {
      return cached.price;
    }

    // TODO: Fetch from Pacifica API
    // For now, return mock prices
    const mockPrices: Record<string, number> = {
      'BTC-USD': 45000,
      'ETH-USD': 2500,
      'SOL-USD': 100,
      'BNB-USD': 350,
    };

    const price = mockPrices[symbol] || 100;
    priceCache.set(symbol, { price, timestamp: now });

    return price;
  }

  /**
   * Decrypt API key wrapper
   */
  private decryptApiKey(encrypted: string): string {
    return decryptApiKey(encrypted);
  }

  /**
   * Get REST client for a user
   */
  private getRestClient(userWallet: string, apiKey: string): PacificaRestClient {
    const apiUrl = process.env.PACIFICA_API_URL || 'https://api.pacifica.fi';
    return new PacificaRestClient(apiUrl, userWallet, apiKey);
  }

  /**
   * Create execution record
   */
  private async createExecution(strategyId: number, data: {
    symbol: string;
    side: 'buy' | 'sell';
    size: number;
    price: number;
    amount: number;
    status: 'pending' | 'open' | 'filled' | 'failed' | 'cancelled';
    order_id?: string;
    error?: string;
  }): Promise<Execution> {
    return await Execution.create({
      strategy_id: strategyId,
      symbol: data.symbol,
      side: data.side,
      size: data.size,
      price: data.price,
      amount: data.amount,
      status: data.status,
      order_id: data.order_id,
      error: data.error,
    });
  }

  /**
   * Find execution by order ID
   */
  private async findExecutionByOrderId(orderId: string): Promise<Execution | null> {
    return await Execution.findOne({
      where: { order_id: orderId }
    });
  }
}

// Export singleton instance
export const strategyExecutor = new StrategyExecutor();
