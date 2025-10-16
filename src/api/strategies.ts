import { Router, Request, Response } from 'express';
import { Strategy, Execution } from '../database/models/Strategy';
import { encryptApiKey, decryptApiKey } from '../utils/encryption';
import { PacificaRestClient } from './rest-client';
import { Op } from 'sequelize';

const router = Router();

/**
 * Create a new strategy
 * POST /api/strategies/create
 */
router.post('/create', async (req: Request, res: Response) => {
  try {
    const {
      user_wallet,
      strategy_type,
      symbol,
      total_amount,
      config,
      api_key,
    } = req.body;

    // Validation
    if (!user_wallet || !strategy_type || !symbol || !total_amount || !config || !api_key) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'user_wallet, strategy_type, symbol, total_amount, config, and api_key are required',
      });
    }

    // Validate strategy type
    const validTypes = ['twap', 'dca', 'grid', 'trailing_stop'];
    if (!validTypes.includes(strategy_type)) {
      return res.status(400).json({
        error: 'Invalid strategy type',
        details: `Must be one of: ${validTypes.join(', ')}`,
      });
    }

    // Validate total amount
    if (total_amount < 10) {
      return res.status(400).json({
        error: 'Total amount too small',
        details: 'Minimum amount is $10',
      });
    }

    // Validate strategy-specific config
    const configError = validateStrategyConfig(strategy_type, config);
    if (configError) {
      return res.status(400).json({
        error: 'Invalid strategy configuration',
        details: configError,
      });
    }

    // Encrypt API key
    const api_key_encrypted = encryptApiKey(api_key);

    // Create strategy
    const strategy = await Strategy.create({
      user_wallet,
      strategy_type,
      symbol,
      total_amount,
      config,
      api_key_encrypted,
      is_active: true,
      executed_amount: 0,
      error_count: 0,
    });

    // Return strategy (without encrypted API key)
    return res.json({
      id: strategy.id,
      user_wallet: strategy.user_wallet,
      strategy_type: strategy.strategy_type,
      symbol: strategy.symbol,
      is_active: strategy.is_active,
      total_amount: strategy.total_amount,
      executed_amount: strategy.executed_amount,
      config: strategy.config,
      created_at: strategy.created_at,
      progress: strategy.getProgress(),
    });
  } catch (error) {
    console.error('[API] Error creating strategy:', error);
    return res.status(500).json({
      error: 'Failed to create strategy',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get all strategies for a wallet
 * GET /api/strategies/:wallet
 */
router.get('/:wallet', async (req: Request, res: Response) => {
  try {
    const { wallet } = req.params;

    const strategies = await Strategy.findAll({
      where: { user_wallet: wallet },
      order: [['created_at', 'DESC']],
    });

    const formattedStrategies = strategies.map((s) => ({
      id: s.id,
      user_wallet: s.user_wallet,
      strategy_type: s.strategy_type,
      symbol: s.symbol,
      is_active: s.is_active,
      total_amount: s.total_amount,
      executed_amount: s.executed_amount,
      config: s.config,
      created_at: s.created_at,
      updated_at: s.updated_at,
      completed_at: s.completed_at,
      last_execution: s.last_execution,
      error_count: s.error_count,
      last_error: s.last_error,
      progress: s.getProgress(),
      remaining: s.getRemainingAmount(),
    }));

    return res.json({ strategies: formattedStrategies });
  } catch (error) {
    console.error('[API] Error fetching strategies:', error);
    return res.status(500).json({
      error: 'Failed to fetch strategies',
    });
  }
});

/**
 * Update strategy (pause/resume)
 * PATCH /api/strategies/:id
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    const strategy = await Strategy.findByPk(id);

    if (!strategy) {
      return res.status(404).json({ error: 'Strategy not found' });
    }

    // If pausing a grid strategy, cancel all open orders
    if (typeof is_active !== 'undefined' && !is_active && strategy.strategy_type === 'grid') {
      await cancelGridOrders(strategy);
    }

    // Only allow updating is_active for now
    if (typeof is_active !== 'undefined') {
      await strategy.update({ is_active });
    }

    return res.json({
      id: strategy.id,
      is_active: strategy.is_active,
      updated_at: strategy.updated_at,
    });
  } catch (error) {
    console.error('[API] Error updating strategy:', error);
    return res.status(500).json({
      error: 'Failed to update strategy',
    });
  }
});

/**
 * Delete strategy
 * DELETE /api/strategies/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const strategy = await Strategy.findByPk(id);

    if (!strategy) {
      return res.status(404).json({ error: 'Strategy not found' });
    }

    // If grid strategy, cancel all open orders
    if (strategy.strategy_type === 'grid') {
      await cancelGridOrders(strategy);
    }

    // Pause strategy first
    await strategy.update({ is_active: false });

    // Delete strategy and all executions (cascade)
    await strategy.destroy();

    return res.json({ success: true, message: 'Strategy deleted' });
  } catch (error) {
    console.error('[API] Error deleting strategy:', error);
    return res.status(500).json({
      error: 'Failed to delete strategy',
    });
  }
});

/**
 * Get strategy performance/details
 * GET /api/strategies/:id/performance
 */
router.get('/:id/performance', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const strategy = await Strategy.findByPk(id, {
      include: [
        {
          model: Execution,
          as: 'executions',
          order: [['executed_at', 'DESC']],
        },
      ],
    });

    if (!strategy) {
      return res.status(404).json({ error: 'Strategy not found' });
    }

    const executions = await Execution.findAll({
      where: { strategy_id: id },
      order: [['executed_at', 'DESC']],
    });

    // Calculate performance metrics
    const filledExecutions = executions.filter((e) => e.status === 'filled');
    const totalExecutions = executions.length;
    const successRate = totalExecutions > 0 ? (filledExecutions.length / totalExecutions) * 100 : 0;

    const avgEntryPrice =
      filledExecutions.length > 0
        ? filledExecutions.reduce((sum, e) => sum + Number(e.price), 0) / filledExecutions.length
        : 0;

    const totalSpent = filledExecutions.reduce((sum, e) => sum + Number(e.amount), 0);

    return res.json({
      strategy: {
        id: strategy.id,
        strategy_type: strategy.strategy_type,
        symbol: strategy.symbol,
        is_active: strategy.is_active,
        total_amount: strategy.total_amount,
        executed_amount: strategy.executed_amount,
        progress: strategy.getProgress(),
        remaining: strategy.getRemainingAmount(),
        created_at: strategy.created_at,
        completed_at: strategy.completed_at,
        last_execution: strategy.last_execution,
        error_count: strategy.error_count,
        last_error: strategy.last_error,
      },
      performance: {
        total_executions: totalExecutions,
        filled_executions: filledExecutions.length,
        failed_executions: executions.filter((e) => e.status === 'failed').length,
        success_rate: successRate,
        avg_entry_price: avgEntryPrice,
        total_spent: totalSpent,
      },
      executions: executions.map((e) => ({
        id: e.id,
        executed_at: e.executed_at,
        side: e.side,
        size: e.size,
        price: e.price,
        amount: e.amount,
        status: e.status,
        error: e.error,
      })),
    });
  } catch (error) {
    console.error('[API] Error fetching strategy performance:', error);
    return res.status(500).json({
      error: 'Failed to fetch strategy performance',
    });
  }
});

/**
 * Cancel all open orders for a grid strategy
 */
async function cancelGridOrders(strategy: Strategy): Promise<void> {
  try {
    const config = strategy.config as any;

    if (!config.orders || !Array.isArray(config.orders)) {
      return;
    }

    const apiKey = decryptApiKey(strategy.api_key_encrypted);
    const apiUrl = process.env.PACIFICA_API_URL || 'https://api.pacifica.fi';
    const restClient = new PacificaRestClient(apiUrl, strategy.user_wallet, apiKey);

    console.log(`[Strategies] Cancelling ${config.orders.length} grid orders for strategy ${strategy.id}`);

    // Cancel all orders
    for (const order of config.orders) {
      if (order.orderId) {
        try {
          await restClient.cancelOrder(order.orderId);
          console.log(`[Strategies] Cancelled order ${order.orderId}`);

          // Update execution status
          const execution = await Execution.findOne({
            where: { order_id: order.orderId }
          });
          if (execution && execution.status === 'open') {
            await execution.update({ status: 'cancelled' });
          }
        } catch (error) {
          console.error(`[Strategies] Error cancelling order ${order.orderId}:`, error);
        }
      }
    }

    console.log(`[Strategies] Finished cancelling orders for strategy ${strategy.id}`);
  } catch (error) {
    console.error(`[Strategies] Error in cancelGridOrders:`, error);
  }
}

/**
 * Validate strategy-specific configuration
 */
function validateStrategyConfig(strategyType: string, config: any): string | null {
  switch (strategyType) {
    case 'twap':
      if (!config.duration_minutes || config.duration_minutes < 1) {
        return 'TWAP duration must be at least 1 minute';
      }
      if (!config.interval_minutes || config.interval_minutes < 1) {
        return 'TWAP interval must be at least 1 minute';
      }
      if (config.interval_minutes > config.duration_minutes) {
        return 'TWAP interval cannot be longer than duration';
      }
      break;

    case 'dca':
      if (!config.buy_amount || config.buy_amount < 10) {
        return 'DCA buy amount must be at least $10';
      }
      if (!config.frequency_hours || config.frequency_hours < 1) {
        return 'DCA frequency must be at least 1 hour';
      }
      break;

    case 'grid':
      if (!config.lower_price || config.lower_price <= 0) {
        return 'Grid lower price must be positive';
      }
      if (!config.upper_price || config.upper_price <= 0) {
        return 'Grid upper price must be positive';
      }
      if (config.lower_price >= config.upper_price) {
        return 'Grid lower price must be less than upper price';
      }
      if (!config.grid_levels || config.grid_levels < 2) {
        return 'Grid must have at least 2 levels';
      }
      break;

    case 'trailing_stop':
      if (!config.trigger_price || config.trigger_price <= 0) {
        return 'Trailing stop trigger price must be positive';
      }
      if (!config.trail_percent || config.trail_percent <= 0 || config.trail_percent > 100) {
        return 'Trailing stop percent must be between 0 and 100';
      }
      break;

    default:
      return `Unknown strategy type: ${strategyType}`;
  }

  return null;
}

export default router;
