# Quick Start Guide

## Setup (5 minutes)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
# Copy template
cp .env.example .env

# Edit .env with your values:
# - DATABASE_URL: Your PostgreSQL connection string
# - PACIFICA_WS_URL: wss://ws.pacifica.fi/ws (or testnet URL)
# - PACIFICA_API_URL: https://api.pacifica.fi/api/v1 (or testnet URL)
# - MASTER_WALLET: Wallet address to monitor for trades
# - COPIER_WALLET: Your wallet public key (for copying trades)
# - COPIER_PRIVATE_KEY: Your wallet private key in base58 format
```

### 3. Set Up Database
```bash
# Run migration to create tables
npm run migrate:up
```

### 4. Test Database Connection
```bash
npm run test:db
```

Expected output:
```
✓ Connected successfully
✓ Trader created: { id: 1, wallet_address: '...', ... }
✓ All Tests Passed
```

---

## Testing the Bot

### Test 1: WebSocket Connection
```bash
npm run dev
```

Look for:
```
[Database] Connection established successfully
[WebSocket] Connecting to wss://ws.pacifica.fi/ws...
[WebSocket] Connected successfully
[WebSocket] Subscribing to account_trades for {MASTER_WALLET}
[Server] Running on port 3000
```

Keep it running and watch for ping messages every 30 seconds.

### Test 2: REST API
```bash
# In a new terminal
npm run test:rest
```

Expected output:
```
✓ Account Info: { balance: '...', account_equity: '...', ... }
✓ Positions (0): No open positions
✓ Queue length: 0
✓ Requests this minute: 2/90
```

### Test 3: Live Trade Detection

With the server running (`npm run dev`):

1. Go to Pacifica exchange
2. Make a small trade with your MASTER_WALLET
3. Watch the terminal for:

```
[WebSocket] Trade received: {
  symbol: 'BTC',
  side: 'open_long',
  amount: '0.001',
  price: '100000',
  trader: 'YOUR_MASTER_WALLET'
}
```

---

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build TypeScript to JavaScript |
| `npm start` | Run production server |
| `npm run test:db` | Test database CRUD operations |
| `npm run test:rest` | Test REST API client |
| `npm run migrate:up` | Run database migrations |
| `npm run migrate:down` | Rollback database migrations |

---

## API Endpoints

Once server is running on port 3000:

### Health Check
```bash
curl http://localhost:3000/health
```

### Get All Traders
```bash
curl http://localhost:3000/api/traders
```

### Add Trader to Monitor
```bash
curl -X POST http://localhost:3000/api/traders \
  -H "Content-Type: application/json" \
  -d '{"wallet_address":"EPwPib9r5pK5Z9S6iyT6t9yCD9MeA3P5G4srPT2dYfuY"}'
```

### Approve Trader
```bash
curl -X PATCH http://localhost:3000/api/traders/1/approve
```

---

## Troubleshooting

### Database Connection Error
```
Error: DATABASE_URL environment variable is not set
```
**Solution:** Make sure `.env` file exists with `DATABASE_URL` set to a valid PostgreSQL connection string.

### WebSocket Connection Failed
```
[WebSocket] Error: connect ECONNREFUSED
```
**Solution:**
- Check `PACIFICA_WS_URL` in `.env`
- Verify internet connection
- Check if Pacifica WebSocket endpoint is accessible

### Signature/Authentication Error
```
HTTP 401: Unauthorized
```
**Solution:**
- Verify `COPIER_PRIVATE_KEY` is correct and in base58 format
- Verify `COPIER_WALLET` matches the private key
- Check that the signing logic matches API.md exactly

### Rate Limit Error
```
HTTP 429: Too Many Requests
```
**Solution:**
- The bot should auto-retry (once, after 1s)
- Reduce request frequency if it persists
- Current limit: 90 requests/minute (10 buffer below API limit)

---

## Next Steps

Once all tests pass:

1. ✅ Monitor live trades from MASTER_WALLET
2. ✅ Test REST API can place orders
3. ✅ Implement copy trading logic in `src/index.ts`
4. ✅ Add position sizing logic
5. ✅ Add safety limits (max position, daily limit, etc.)
6. ✅ Deploy to production

---

## Full Testing Checklist

See [TESTING.md](./TESTING.md) for the comprehensive testing checklist with all test cases.
