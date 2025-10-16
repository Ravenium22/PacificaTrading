# Pacifica Copy Trading Bot

A TypeScript-based copy trading bot foundation for the Pacifica decentralized exchange. This bot monitors a master wallet's trades via WebSocket and can replicate them using the REST API with Ed25519 signing.

## Features

- **Trade Replication**: Automatically copies trades from master wallet to copier wallet with configurable position sizing (50% by default)
- **WebSocket Client**: Real-time trade monitoring with automatic reconnection and heartbeat
- **REST API Client**: Authenticated API calls with Ed25519 signing, rate limiting, and retry logic
- **Balance Checking**: Verifies sufficient funds before executing trades
- **Error Handling**: Graceful error handling with consecutive failure tracking
- **Slippage Calculation**: Logs price difference between master and copier trades
- **Database**: PostgreSQL with Sequelize ORM for trader management
- **Express Server**: REST API with CORS support and error handling
- **TypeScript**: Full type safety and modern ES2020 features

## Project Structure

```
PacificaTradingWebsite/
├── src/
│   ├── api/
│   │   ├── websocket-client.ts    # WebSocket client with auto-reconnect
│   │   └── rest-client.ts         # REST client with signing & rate limiting
│   ├── database/
│   │   ├── config.ts              # Database configuration
│   │   ├── models/
│   │   │   └── Trader.ts          # Trader model
│   │   ├── migrations/
│   │   │   └── 001-create-traders-table.ts
│   │   └── migrate.ts             # Migration runner
│   ├── tests/
│   │   └── database.test.ts       # Database CRUD tests
│   └── index.ts                   # Main server entry point
├── .env.example                   # Environment variables template
├── tsconfig.json                  # TypeScript configuration
├── package.json                   # Dependencies and scripts
├── TESTING.md                     # Comprehensive testing checklist
└── README.md                      # This file
```

## Installation

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Set up PostgreSQL database:**
   - Create a PostgreSQL database
   - Update `DATABASE_URL` in `.env`

4. **Run migrations:**
   ```bash
   ts-node src/database/migrate.ts up
   ```

## Configuration

Edit `.env` file with the following variables:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/pacifica_bot

# Pacifica API URLs
PACIFICA_WS_URL=wss://ws.pacifica.fi/ws
PACIFICA_API_URL=https://api.pacifica.fi/api/v1

# Trading Wallets
MASTER_WALLET=WALLET_TO_MONITOR
COPIER_WALLET=YOUR_WALLET_PUBLIC_KEY
COPIER_PRIVATE_KEY=YOUR_WALLET_PRIVATE_KEY_BASE58

# Server Configuration
PORT=3000

# Replication Settings
POSITION_MULTIPLIER=0.5  # Copy trades at 50% of master size
```

## Usage

### Development Mode
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

### Run Database Tests
```bash
npm run test:db
```

## API Reference

### WebSocket Client

**Events:**
- `connected` - Fired when WebSocket connects
- `trade` - Fired when a trade is detected (only `fulfill_maker` events)
- `error` - Fired on errors
- `disconnected` - Fired when WebSocket disconnects

**Trade Data Structure:**
```typescript
{
  symbol: string,      // e.g., "BTC"
  side: string,        // "open_long" | "close_long" | "open_short" | "close_short"
  amount: string,      // e.g., "0.001"
  price: string,       // e.g., "100000"
  eventType: string,   // "fulfill_maker"
  trader: string,      // wallet address
  timestamp: number    // milliseconds
}
```

### REST Client

**Methods:**

1. `getAccountInfo(wallet: string)`
   - Fetches account information
   - Returns: balance, equity, available funds, etc.

2. `getPositions(wallet: string)`
   - Fetches open positions
   - Returns: array of positions

3. `createMarketOrder(params)`
   - Places a market order with signature
   - Params:
     ```typescript
     {
       symbol: string,
       amount: string,
       side: 'bid' | 'ask',
       slippage_percent?: string,
       reduce_only?: boolean
     }
     ```

**Rate Limiting:**
- Max 90 requests per minute (buffer below 100 limit)
- Automatic queuing of requests
- Retry on 429 errors (once, with 1s delay)

### Express Endpoints

**Health Check:**
```
GET /health
```

**Traders:**
```
GET /api/traders
POST /api/traders
PATCH /api/traders/:id/approve
```

## Database Schema

**Traders Table:**
```sql
CREATE TABLE traders (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR UNIQUE NOT NULL,
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Testing

See [TESTING.md](./TESTING.md) for the complete testing checklist covering:

✅ Database connection & CRUD operations
✅ WebSocket connection & ping/pong heartbeat
✅ WebSocket auto-reconnect with exponential backoff
✅ Live trade detection and parsing
✅ REST API account info retrieval
✅ REST API position fetching
✅ Market order placement with Ed25519 signing
✅ Rate limiting (90 req/min)
✅ 429 error retry logic
✅ Express server endpoints

## Key Implementation Details

### Ed25519 Signing (as per API.md)
1. Create message with timestamp, type, and data
2. Recursively sort all object keys
3. Create compact JSON (no spaces)
4. Sign with tweetnacl Ed25519
5. Encode signature to base58

### WebSocket Heartbeat
- Ping every 30 seconds: `{ method: "ping" }`
- Expects pong response: `{ channel: "pong" }`

### Auto-Reconnect
- Exponential backoff: 1s, 2s, 4s, 8s, etc.
- Max 10 reconnect attempts
- Auto-resubscribes to channels on reconnect

### Rate Limiting
- Request queue with FIFO processing
- Tracks requests per minute
- Automatic 429 retry (once, 1s delay)

## Security Notes

- **Never commit `.env` file** - Contains private keys
- **Validate all trade amounts** before replication
- **Test with small amounts** first
- **Monitor for API changes** on Pacifica

## Trade Replication

✅ **Basic trade replication is now ACTIVE!**

The bot automatically copies trades from the master wallet to the copier wallet. See [REPLICATION_TESTING.md](./REPLICATION_TESTING.md) for testing instructions.

**Features:**
- Monitors master wallet trades via WebSocket
- Automatically executes proportional trades (50% by default)
- Balance checking before execution
- Skips trades if insufficient funds
- Logs detailed replication info with slippage calculation
- Tracks consecutive failures and warns after 3 failures

**Testing:**
```bash
# Start the bot
npm run dev

# Make a trade with your master wallet on Pacifica
# Watch the terminal for replication logs
```

## Next Steps

To enhance the copy trading bot:

1. ✅ ~~Basic trade replication~~ (DONE)
2. Check if trader is approved in database before replicating
3. Add advanced position sizing (based on account equity, risk %)
4. Implement position limits (max position size, daily limits)
5. Add trade history logging to database
6. Implement stop-loss and take-profit logic
7. Add notifications (Discord/Telegram alerts)
8. Performance tracking and analytics

## License

ISC
