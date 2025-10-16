import WebSocket from 'ws';
import { EventEmitter } from 'events';

interface TradeData {
  s: string;        // symbol
  ts: string;       // trade side
  p: string;        // price
  a: string;        // amount
  te: string;       // event type
  u: string;        // trader wallet
}

interface TradeMessage {
  channel: string;
  data: TradeData[];
}

interface ParsedTrade {
  symbol: string;
  side: string;
  amount: string;
  price: string;
  eventType: string;
  trader: string;
  timestamp: number;
}

export class PacificaWebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private wsUrl: string;
  private wallet: string | null = null; // made optional for multi-master support
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseReconnectDelay = 1000;
  private pingInterval: NodeJS.Timeout | null = null;
  private shouldReconnect = true;

  constructor(wsUrl: string, wallet?: string) {
    super();
    this.wsUrl = wsUrl;
    this.wallet = wallet || null;
  }

  public connect(): void {
    console.log(`[WebSocket] Connecting to ${this.wsUrl} for wallet ${this.wallet}`);

    this.ws = new WebSocket(this.wsUrl);

    this.ws.on('open', () => {
      console.log('[WebSocket] Connected successfully');
      this.reconnectAttempts = 0;
      this.emit('connected');

      // Subscribe to account trades (only if wallet was provided)
      if (this.wallet) {
        this.subscribeToAccount('account_trades', this.wallet);
      }

      // Start heartbeat
      this.startHeartbeat();
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      console.log('[WebSocket] >>> RAW:', data.toString());

      try {
        const message = JSON.parse(data.toString());

        // Handle pong response
        if (message.channel === 'pong') {
          return;
        }

        // Handle trade messages
        if (message.channel === 'account_trades' && message.data) {
          this.handleTradeMessage(message as TradeMessage);
        }
      } catch (error) {
        console.error('[WebSocket] Error parsing message:', error);
        this.emit('error', error);
      }
    });

    this.ws.on('close', () => {
      console.log('[WebSocket] Disconnected');
      this.emit('disconnected');
      this.cleanup();

      if (this.shouldReconnect) {
        this.reconnect();
      }
    });

    this.ws.on('error', (error) => {
      console.error('[WebSocket] Error:', error);
      this.emit('error', error);
    });
  }

  // Public method to subscribe to a specific account
  public subscribeToAccount(source: string, account: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[WebSocket] Cannot subscribe: connection not open');
      return;
    }

    const subscribeMsg = {
      method: 'subscribe',
      params: {
        source,
        account
      }
    };

    console.log(`[WebSocket] Subscribing to ${source} for ${account}`);
    this.ws.send(JSON.stringify(subscribeMsg));
  }

  // Public method to unsubscribe from a specific account
  public unsubscribeFromAccount(source: string, account: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[WebSocket] Cannot unsubscribe: connection not open');
      return;
    }

    const unsubscribeMsg = {
      method: 'unsubscribe',
      params: {
        source,
        account
      }
    };

    console.log(`[WebSocket] Unsubscribing from ${source} for ${account}`);
    this.ws.send(JSON.stringify(unsubscribeMsg));
  }

  private startHeartbeat(): void {
    // Send ping every 30 seconds
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ method: 'ping' }));
      }
    }, 30000);
  }

  private handleTradeMessage(message: TradeMessage): void {
    message.data.forEach((trade) => {
      // Process both maker and taker fills
      if (trade.te === 'fulfill_maker' || trade.te === 'fulfill_taker') {
        const parsedTrade: ParsedTrade = {
          symbol: trade.s,
          side: trade.ts,
          amount: trade.a,
          price: trade.p,
          eventType: trade.te,
          trader: trade.u,
          timestamp: Date.now()
        };

        console.log('[WebSocket] Trade received:', parsedTrade);

        this.emit('trade', parsedTrade);
      }
    });
  }

  private reconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnect attempts reached');
      this.emit('error', new Error('Max reconnect attempts reached'));
      return;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, etc.
    const delay = this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  private cleanup(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  public disconnect(): void {
    console.log('[WebSocket] Disconnecting...');
    this.shouldReconnect = false;
    this.cleanup();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
