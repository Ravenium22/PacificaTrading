# Pacifica API Reference

## Base URLs
- Mainnet REST: `https://api.pacifica.fi/api/v1`
- Mainnet WebSocket: `wss://ws.pacifica.fi/ws`
- Testnet REST: `https://test-api.pacifica.fi/api/v1`
- Testnet WebSocket: `wss://test-ws.pacifica.fi/ws`

## Authentication (REST)

All POST requests need Ed25519 signature:

```typescript
// 1. Create message to sign
const message = {
  timestamp: Date.now(),
  expiry_window: 5000,
  type: "create_market_order", // operation type
  data: {
    symbol: "BTC",
    amount: "0.001",
    side: "bid",
    // ... other params
  }
};

// 2. Sort keys recursively
function sortKeys(obj) {
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sortKeys);
  return Object.keys(obj).sort().reduce((result, key) => {
    result[key] = sortKeys(obj[key]);
    return result;
  }, {});
}

// 3. Create compact JSON (no spaces)
const sorted = sortKeys(message);
const compact = JSON.stringify(sorted);

// 4. Sign with Ed25519
const signature = nacl.sign.detached(
  Buffer.from(compact, 'utf8'),
  secretKey
);
const signatureB58 = bs58.encode(signature);

// 5. Send request
POST /api/v1/orders/create_market
Headers:
  Content-Type: application/json
Body: {
  account: "YOUR_PUBLIC_KEY",
  signature: signatureB58,
  timestamp: message.timestamp,
  expiry_window: 5000,
  symbol: "BTC",
  amount: "0.001",
  side: "bid",
  slippage_percent: "0.5",
  reduce_only: false
}
```

## WebSocket

### Connect
```typescript
const ws = new WebSocket('wss://ws.pacifica.fi/ws');

// Heartbeat (every 30s)
setInterval(() => {
  ws.send(JSON.stringify({ method: "ping" }));
}, 30000);

ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.channel === 'pong') return; // heartbeat response
  // handle actual data
});
```

### Subscribe to trades
```typescript
ws.send(JSON.stringify({
  method: "subscribe",
  params: {
    source: "account_trades",
    account: "WALLET_ADDRESS"
  }
}));
```

### Trade message format
```typescript
{
  channel: "account_trades",
  data: [{
    s: "BTC",              // symbol
    ts: "open_long",       // trade side
    p: "100000",           // price
    a: "0.001",            // amount
    te: "fulfill_maker",   // event type
    u: "WALLET_ADDRESS"    // trader
  }]
}
```

Trade sides:
- `open_long` = buy to open long
- `close_long` = sell to close long  
- `open_short` = sell to open short
- `close_short` = buy to close short

Only replicate `fulfill_maker` events (actual fills, not limit orders)

## Key Endpoints

### Get Account Info
```
GET /api/v1/account?account=WALLET_ADDRESS
Response: {
  balance, account_equity, available_to_spend, positions_count
}
```

### Create Market Order
```
POST /api/v1/orders/create_market
Body: {
  account, signature, timestamp, expiry_window,
  symbol: "BTC",
  amount: "0.001",
  side: "bid" | "ask",
  slippage_percent: "0.5",
  reduce_only: false
}
```

### Get Positions
```
GET /api/v1/positions?account=WALLET_ADDRESS
Response: [{
  symbol, side, amount, entry_price, isolated
}]
```

## Rate Limits
- 100 requests per minute per API key
- WebSocket: 100 concurrent connections per IP
- On 429 error: exponential backoff

## Important Notes
- All prices/amounts are strings (not numbers)
- Amounts must be multiples of lot_size (check /api/v1/info)
- Prices must be multiples of tick_size
- Market orders use slippage_percent instead of price