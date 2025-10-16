import nacl from 'tweetnacl';
import bs58 from 'bs58';

interface CreateMarketOrderParams {
  symbol: string;
  amount: string;
  side: 'bid' | 'ask';
  slippage_percent?: string;
  reduce_only?: boolean;
}

interface CreateLimitOrderParams {
  symbol: string;
  amount: string;
  side: 'bid' | 'ask';
  price: string;
  post_only?: boolean;
  reduce_only?: boolean;
}

interface SignedMessage {
  timestamp: number;
  expiry_window: number;
  type: string;
  data: any;
}

interface RateLimitedRequest {
  url: string;
  options: RequestInit;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  retryCount: number;
}

export class PacificaRestClient {
  private apiUrl: string;
  private publicKey?: string;
  private privateKey?: Uint8Array;
  private requestQueue: RateLimitedRequest[] = [];
  private requestsPerMinute = 0;
  private maxRequestsPerMinute = 90; // Buffer below 100 limit
  private isProcessingQueue = false;

  constructor(apiUrl: string, publicKey?: string, privateKeyB58?: string) {
    this.apiUrl = apiUrl;
    this.publicKey = publicKey;
    if (privateKeyB58) {
      this.privateKey = bs58.decode(privateKeyB58);
    }

    // Reset rate limit counter every minute
    setInterval(() => {
      this.requestsPerMinute = 0;
    }, 60000);

    // Start processing queue
    this.processQueue();
  }

  private sortKeys(obj: any): any {
    if (typeof obj !== 'object' || obj === null) return obj;
    if (Array.isArray(obj)) return obj.map((item) => this.sortKeys(item));

    return Object.keys(obj)
      .sort()
      .reduce((result: any, key: string) => {
        result[key] = this.sortKeys(obj[key]);
        return result;
      }, {});
  }

  private requiresAuth(): boolean {
    return !!(this.publicKey && this.privateKey);
  }

  private sign(message: SignedMessage): string {
    if (!this.privateKey) {
      throw new Error('Private key required for signing operations');
    }

    // Sort keys recursively
    const sorted = this.sortKeys(message);

    // Create compact JSON (no spaces)
    const compact = JSON.stringify(sorted);

    // Sign with Ed25519
    const signature = nacl.sign.detached(
      Buffer.from(compact, 'utf8'),
      this.privateKey
    );

    // Encode to base58
    return bs58.encode(signature);
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    while (true) {
      // Check if we can make a request
      if (this.requestQueue.length > 0 && this.requestsPerMinute < this.maxRequestsPerMinute) {
        const request = this.requestQueue.shift();
        if (!request) continue;

        this.requestsPerMinute++;

        try {
          const response = await fetch(request.url, request.options);

          // Handle 429 (rate limit) with retry
          if (response.status === 429) {
            console.log('[REST] Rate limited, retrying...');

            if (request.retryCount < 1) {
              // Wait 1 second and retry once
              await new Promise(resolve => setTimeout(resolve, 1000));
              request.retryCount++;
              this.requestQueue.unshift(request); // Put back at front of queue
              continue;
            } else {
              request.reject(new Error('Rate limit exceeded after retry'));
              continue;
            }
          }

          if (!response.ok) {
            const errorText = await response.text();
            request.reject(new Error(`HTTP ${response.status}: ${errorText}`));
            continue;
          }

          const data = await response.json();
          request.resolve(data);
        } catch (error) {
          request.reject(error);
        }
      }

      // Wait 100ms before checking queue again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  private async queueRequest(url: string, options: RequestInit): Promise<any> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        url,
        options,
        resolve,
        reject,
        retryCount: 0
      });
    });
  }

  public async getAccountInfo(wallet: string): Promise<any> {
    const url = `${this.apiUrl}/account?account=${wallet}`;

    return this.queueRequest(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  public async getPositions(wallet: string): Promise<any> {
    const url = `${this.apiUrl}/positions?account=${wallet}`;

    return this.queueRequest(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  public async createMarketOrder(params: CreateMarketOrderParams): Promise<any> {
  if (!this.requiresAuth()) {
    throw new Error('Authentication required for trading operations');
  }

  const timestamp = Date.now();
  const expiryWindow = 5000;

  // Derive agent public key from private key
  const agentPublicKey = bs58.encode(
    nacl.sign.keyPair.fromSecretKey(this.privateKey!).publicKey
  );

  // Create message to sign
  const message: SignedMessage = {
    timestamp,
    expiry_window: expiryWindow,
    type: 'create_market_order',
    data: {
      symbol: params.symbol,
      amount: params.amount,
      side: params.side,
      slippage_percent: params.slippage_percent || '0.5',
      reduce_only: params.reduce_only || false
    }
  };

  // Generate signature
  const signature = this.sign(message);

  // Create request body
  const body = {
    account: this.publicKey!,           // main wallet
    agent_wallet: agentPublicKey,        // ADD THIS - agent wallet public key
    signature,
    timestamp,
    expiry_window: expiryWindow,
    symbol: params.symbol,
    amount: params.amount,
    side: params.side,
    slippage_percent: params.slippage_percent || '0.5',
    reduce_only: params.reduce_only || false
  };

  const url = `${this.apiUrl}/orders/create_market`;

  console.log('[REST] Creating market order:', {
    symbol: params.symbol,
    side: params.side,
    amount: params.amount,
    agent: agentPublicKey  // log it
  });

  return this.queueRequest(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
}

  public getQueueLength(): number {
    return this.requestQueue.length;
  }

  public getRequestsPerMinute(): number {
    return this.requestsPerMinute;
  }

  public async createLimitOrder(params: CreateLimitOrderParams): Promise<any> {
    if (!this.requiresAuth()) {
      throw new Error('Authentication required for trading operations');
    }

    const timestamp = Date.now();
    const expiryWindow = 5000;

    // Derive agent public key from private key
    const agentPublicKey = bs58.encode(
      nacl.sign.keyPair.fromSecretKey(this.privateKey!).publicKey
    );

    // Create message to sign
    const message: SignedMessage = {
      timestamp,
      expiry_window: expiryWindow,
      type: 'create_limit_order',
      data: {
        symbol: params.symbol,
        amount: params.amount,
        side: params.side,
        price: params.price,
        post_only: params.post_only || false,
        reduce_only: params.reduce_only || false
      }
    };

    // Generate signature
    const signature = this.sign(message);

    // Create request body
    const body = {
      account: this.publicKey!,
      agent_wallet: agentPublicKey,
      signature,
      timestamp,
      expiry_window: expiryWindow,
      symbol: params.symbol,
      amount: params.amount,
      side: params.side,
      price: params.price,
      post_only: params.post_only || false,
      reduce_only: params.reduce_only || false
    };

    const url = `${this.apiUrl}/orders/create`;

    console.log('[REST] Creating limit order:', {
      symbol: params.symbol,
      side: params.side,
      amount: params.amount,
      price: params.price,
      agent: agentPublicKey
    });

    return this.queueRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
  }

  public async cancelOrder(orderId: string): Promise<any> {
    if (!this.requiresAuth()) {
      throw new Error('Authentication required for trading operations');
    }

    const timestamp = Date.now();
    const expiryWindow = 5000;

    // Derive agent public key from private key
    const agentPublicKey = bs58.encode(
      nacl.sign.keyPair.fromSecretKey(this.privateKey!).publicKey
    );

    // Create message to sign
    const message: SignedMessage = {
      timestamp,
      expiry_window: expiryWindow,
      type: 'cancel_order',
      data: {
        order_id: orderId
      }
    };

    // Generate signature
    const signature = this.sign(message);

    // Create request body
    const body = {
      account: this.publicKey!,
      agent_wallet: agentPublicKey,
      signature,
      timestamp,
      expiry_window: expiryWindow,
      order_id: orderId
    };

    const url = `${this.apiUrl}/orders/cancel`;

    console.log('[REST] Cancelling order:', orderId);

    return this.queueRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
  }

  public async getOpenOrders(wallet: string): Promise<any> {
    const url = `${this.apiUrl}/orders?account=${wallet}&status=open`;

    return this.queueRequest(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}
