# Pacifica Copy Trading Bot - Testing Checklist

## Pre-Testing Setup

1. **Environment Configuration**
   ```bash
   # Copy .env.example to .env
   cp .env.example .env

   # Edit .env with your credentials:
   # - DATABASE_URL (PostgreSQL connection string)
   # - PACIFICA_WS_URL (WebSocket URL)
   # - PACIFICA_API_URL (REST API URL)
   # - MASTER_WALLET (wallet to monitor)
   # - COPIER_WALLET (your trading wallet public key)
   # - COPIER_PRIVATE_KEY (your trading wallet private key in base58)
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Database Setup**
   ```bash
   # Run migration to create traders table
   ts-node src/database/migrate.ts up
   ```

---

## Testing Checklist

### ✅ 1. Database Connection & CRUD Operations

**Test Command:**
```bash
npm run test:db
```

**Expected Results:**
- ✓ Connects to PostgreSQL database
- ✓ Creates a new trader record
- ✓ Reads trader from database
- ✓ Updates trader (approval status)
- ✓ Lists all traders
- ✓ Deletes test trader
- ✓ Verifies deletion
- ✓ Tests unique constraint on wallet_address

**Status:** [ ] Pass / [ ] Fail

**Notes:**
_______________________________________________

---

### ✅ 2. WebSocket Connection & Ping/Pong

**Test Steps:**
```bash
# Start the server
npm run dev
```

**Expected Results:**
- ✓ Server starts on port 3000
- ✓ WebSocket connects to Pacifica
- ✓ Logs: "[WebSocket] Connected successfully"
- ✓ Logs: "[WebSocket] Subscribing to account_trades for {MASTER_WALLET}"
- ✓ Ping messages sent every 30 seconds (check logs over 1-2 minutes)
- ✓ No disconnection errors

**Status:** [ ] Pass / [ ] Fail

**Notes:**
_______________________________________________

---

### ✅ 3. WebSocket Auto-Reconnect

**Test Steps:**
1. Start the server: `npm run dev`
2. Wait for connection
3. Disconnect your internet or kill the WebSocket connection
4. Reconnect internet

**Expected Results:**
- ✓ Logs: "[WebSocket] Disconnected"
- ✓ Logs: "[WebSocket] Reconnecting in {delay}ms (attempt X/10)"
- ✓ Successfully reconnects with exponential backoff
- ✓ Re-subscribes to account_trades after reconnection

**Status:** [ ] Pass / [ ] Fail

**Notes:**
_______________________________________________

---

### ✅ 4. Live Trade Detection

**Test Steps:**
1. Start the server: `npm run dev`
2. Make a manual trade on Pacifica using the MASTER_WALLET:
   - Symbol: BTC or any available market
   - Side: Buy or Sell
   - Amount: Small test amount (e.g., 0.001 BTC)

**Expected Results:**
- ✓ Server logs show trade message within 1-2 seconds
- ✓ Parsed data logged with:
  ```
  [WebSocket] Trade received: {
    symbol: 'BTC',
    side: 'open_long' | 'close_long' | 'open_short' | 'close_short',
    amount: '0.001',
    price: '{market_price}',
    trader: '{MASTER_WALLET}'
  }
  ```
- ✓ Only `fulfill_maker` events are logged (not limit orders)

**Status:** [ ] Pass / [ ] Fail

**Trade Details:**
- Symbol: __________
- Side: __________
- Amount: __________
- Price: __________

---

### ✅ 5. REST API - Get Account Info

**Test Steps:**
```bash
# In a separate terminal or use Postman/curl
curl "http://localhost:3000/api/account-info?wallet={COPIER_WALLET}"
```

Or create a test script:
```typescript
// src/tests/rest-test.ts
import dotenv from 'dotenv';
import { PacificaRestClient } from '../api/rest-client';

dotenv.config();

async function testRestClient() {
  const client = new PacificaRestClient(
    process.env.PACIFICA_API_URL!,
    process.env.COPIER_WALLET!,
    process.env.COPIER_PRIVATE_KEY!
  );

  console.log('Fetching account info...');
  const accountInfo = await client.getAccountInfo(process.env.COPIER_WALLET!);
  console.log('Account Info:', accountInfo);

  console.log('\nFetching positions...');
  const positions = await client.getPositions(process.env.COPIER_WALLET!);
  console.log('Positions:', positions);
}

testRestClient();
```

**Expected Results:**
- ✓ Returns account data:
  ```json
  {
    "balance": "...",
    "account_equity": "...",
    "available_to_spend": "...",
    "positions_count": ...
  }
  ```
- ✓ No errors or rate limit issues

**Status:** [ ] Pass / [ ] Fail

**Notes:**
_______________________________________________

---

### ✅ 6. REST API - Get Positions

**Test Steps:**
```bash
curl "http://localhost:3000/api/positions?wallet={COPIER_WALLET}"
```

**Expected Results:**
- ✓ Returns positions array (may be empty if no positions):
  ```json
  [{
    "symbol": "BTC",
    "side": "long" | "short",
    "amount": "...",
    "entry_price": "...",
    "isolated": true | false
  }]
  ```

**Status:** [ ] Pass / [ ] Fail

**Notes:**
_______________________________________________

---

### ✅ 7. REST API - Place Market Order

**⚠️ WARNING: This will place a real order with real funds!**

**Test Steps:**
```typescript
// src/tests/order-test.ts
import dotenv from 'dotenv';
import { PacificaRestClient } from '../api/rest-client';

dotenv.config();

async function testMarketOrder() {
  const client = new PacificaRestClient(
    process.env.PACIFICA_API_URL!,
    process.env.COPIER_WALLET!,
    process.env.COPIER_PRIVATE_KEY!
  );

  console.log('Placing tiny market order...');
  const order = await client.createMarketOrder({
    symbol: 'BTC',
    amount: '0.001', // Very small test amount
    side: 'bid',     // Buy
    slippage_percent: '0.5',
    reduce_only: false
  });

  console.log('Order placed:', order);
}

testMarketOrder();
```

Run with: `ts-node src/tests/order-test.ts`

**Expected Results:**
- ✓ Order is successfully placed
- ✓ Returns order confirmation with:
  - Order ID
  - Execution price
  - Filled amount
- ✓ Signature generation works correctly
- ✓ No authentication errors

**Status:** [ ] Pass / [ ] Fail

**Order Details:**
- Order ID: __________
- Symbol: __________
- Amount: __________
- Executed Price: __________

---

### ✅ 8. Rate Limiting

**Test Steps:**
```typescript
// src/tests/rate-limit-test.ts
import dotenv from 'dotenv';
import { PacificaRestClient } from '../api/rest-client';

dotenv.config();

async function testRateLimit() {
  const client = new PacificaRestClient(
    process.env.PACIFICA_API_URL!,
    process.env.COPIER_WALLET!,
    process.env.COPIER_PRIVATE_KEY!
  );

  console.log('Sending 100 requests rapidly...');
  const promises = [];

  for (let i = 0; i < 100; i++) {
    promises.push(
      client.getAccountInfo(process.env.COPIER_WALLET!)
        .then(() => console.log(`Request ${i + 1} completed`))
        .catch(err => console.error(`Request ${i + 1} failed:`, err.message))
    );
  }

  await Promise.all(promises);
  console.log('Queue length:', client.getQueueLength());
  console.log('Requests per minute:', client.getRequestsPerMinute());
}

testRateLimit();
```

**Expected Results:**
- ✓ Requests are queued properly
- ✓ Max 90 requests per minute enforced
- ✓ No 429 (rate limit) errors from API
- ✓ All requests eventually complete successfully

**Status:** [ ] Pass / [ ] Fail

**Notes:**
_______________________________________________

---

### ✅ 9. Error Handling - 429 Retry

**Test Steps:**
1. Temporarily change `maxRequestsPerMinute` to 200 in `src/api/rest-client.ts`
2. Run the rate limit test above
3. Observe retry behavior when 429 occurs

**Expected Results:**
- ✓ When 429 occurs, logs: "[REST] Rate limited, retrying..."
- ✓ Waits 1 second before retry
- ✓ Retries the request once
- ✓ If still fails, throws error

**Status:** [ ] Pass / [ ] Fail

**Notes:**
_______________________________________________

---

## Additional Integration Tests

### ✅ 10. Express Server Endpoints

**Test Health Endpoint:**
```bash
curl http://localhost:3000/health
```
Expected: `{"status":"ok","timestamp":"..."}`

**Test Get Traders:**
```bash
curl http://localhost:3000/api/traders
```
Expected: Array of traders (may be empty)

**Test Create Trader:**
```bash
curl -X POST http://localhost:3000/api/traders \
  -H "Content-Type: application/json" \
  -d '{"wallet_address":"test_wallet_123"}'
```
Expected: Created trader object with `is_approved: false`

**Test Approve Trader:**
```bash
curl -X PATCH http://localhost:3000/api/traders/1/approve
```
Expected: Updated trader with `is_approved: true`

**Status:** [ ] Pass / [ ] Fail

---

## Summary

- [ ] All database tests pass
- [ ] WebSocket connects and maintains heartbeat
- [ ] WebSocket auto-reconnects with exponential backoff
- [ ] Live trades are detected and logged with correct parsing
- [ ] REST API can fetch account info
- [ ] REST API can fetch positions
- [ ] REST API can place market orders (with correct signing)
- [ ] Rate limiting works (max 90 req/min)
- [ ] 429 errors are retried properly
- [ ] Express server endpoints work

**Overall Status:** [ ] Ready for Production / [ ] Needs Fixes

---

## Notes & Issues

_______________________________________________
_______________________________________________
_______________________________________________
