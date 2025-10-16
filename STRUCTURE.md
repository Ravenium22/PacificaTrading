# Project Structure

```
PacificaTradingWebsite/
│
├── 📄 Configuration Files
│   ├── package.json              # Dependencies and npm scripts
│   ├── tsconfig.json             # TypeScript configuration
│   ├── .env.example              # Environment variables template
│   └── .gitignore                # Git ignore rules
│
├── 📚 Documentation
│   ├── README.md                 # Full project documentation
│   ├── QUICKSTART.md             # 5-minute setup guide
│   ├── TESTING.md                # Comprehensive testing checklist
│   ├── PROJECT_SUMMARY.md        # Project summary and status
│   ├── STRUCTURE.md              # This file - project structure
│   └── API.md                    # Pacifica API reference
│
└── 📁 src/
    │
    ├── 📁 api/                   # API Clients
    │   ├── websocket-client.ts   # WebSocket client
    │   │                         # - Auto-reconnect with exponential backoff
    │   │                         # - Ping/pong heartbeat (30s)
    │   │                         # - Trade event parsing
    │   │                         # - EventEmitter (connected, trade, error, disconnected)
    │   │
    │   └── rest-client.ts        # REST API client
    │                             # - Ed25519 signing (per API.md)
    │                             # - Rate limiting (90 req/min)
    │                             # - Retry on 429 errors
    │                             # - Methods: getAccountInfo, getPositions, createMarketOrder
    │
    ├── 📁 database/              # Database Layer
    │   ├── config.ts             # Sequelize configuration
    │   │                         # - PostgreSQL connection
    │   │                         # - Connection pooling
    │   │
    │   ├── models/
    │   │   └── Trader.ts         # Trader model
    │   │                         # - id, wallet_address, is_approved, created_at
    │   │
    │   ├── migrations/
    │   │   └── 001-create-traders-table.ts
    │   │                         # - Creates traders table
    │   │                         # - Adds unique index on wallet_address
    │   │
    │   └── migrate.ts            # Migration runner
    │                             # - Commands: up, down
    │
    ├── 📁 tests/                 # Test Suite
    │   ├── database.test.ts      # Database CRUD tests
    │   │                         # - Create, Read, Update, Delete
    │   │                         # - Unique constraint validation
    │   │
    │   └── rest-api.test.ts      # REST API tests
    │                             # - Account info fetch
    │                             # - Positions fetch
    │                             # - Rate limiting info
    │
    └── index.ts                  # Main Server
                                  # - Express server (port 3000)
                                  # - CORS enabled
                                  # - Error handling
                                  # - WebSocket & REST client initialization
                                  # - Trader API endpoints
                                  # - Graceful shutdown
```

## File Descriptions

### Configuration

**package.json**
- Dependencies: express, ws, tweetnacl, bs58, sequelize, pg, dotenv, cors
- Dev dependencies: TypeScript, ts-node, nodemon, type definitions
- Scripts: dev, build, start, test:db, test:rest, migrate:up, migrate:down

**tsconfig.json**
- Target: ES2020
- Module: CommonJS
- Strict mode enabled
- Source maps enabled
- Output directory: ./dist

**.env.example**
- DATABASE_URL
- PACIFICA_WS_URL
- PACIFICA_API_URL
- MASTER_WALLET
- COPIER_WALLET
- COPIER_PRIVATE_KEY
- PORT

### Source Files

**src/api/websocket-client.ts** (187 lines)
- Class: `PacificaWebSocketClient`
- Extends: `EventEmitter`
- Features:
  - WebSocket connection management
  - Auto-reconnect with exponential backoff (1s, 2s, 4s, 8s...)
  - Ping/pong heartbeat every 30 seconds
  - Subscribes to account_trades channel
  - Parses and emits trade events
  - Filters for fulfill_maker events only
- Events: connected, trade, error, disconnected

**src/api/rest-client.ts** (195 lines)
- Class: `PacificaRestClient`
- Features:
  - Ed25519 signature generation (per API.md spec)
  - Recursive key sorting
  - Compact JSON serialization
  - Rate limiting with request queue (max 90/min)
  - Retry logic for 429 errors
- Methods:
  - `getAccountInfo(wallet)` → account data
  - `getPositions(wallet)` → positions array
  - `createMarketOrder(params)` → order confirmation
  - `getQueueLength()` → current queue size
  - `getRequestsPerMinute()` → rate limit status

**src/database/config.ts** (42 lines)
- Exports: `sequelize`, `connectDatabase()`, `syncDatabase()`
- Features:
  - Sequelize PostgreSQL configuration
  - Connection pooling (max: 5, min: 0)
  - Authentication test
  - Model synchronization

**src/database/models/Trader.ts** (51 lines)
- Model: `Trader`
- Fields:
  - `id` (INTEGER, PK, auto-increment)
  - `wallet_address` (STRING, unique, not null)
  - `is_approved` (BOOLEAN, default false)
  - `created_at` (DATE, default NOW)
- No timestamps (managed manually)

**src/database/migrations/001-create-traders-table.ts** (36 lines)
- Functions: `up()`, `down()`
- Creates traders table with unique index on wallet_address
- Rollback support

**src/database/migrate.ts** (50 lines)
- CLI tool for running migrations
- Commands: `up` (apply), `down` (rollback)
- Usage: `ts-node src/database/migrate.ts [up|down]`

**src/index.ts** (143 lines)
- Express application setup
- Middleware: CORS, JSON parser, error handler
- Endpoints:
  - `GET /health` → health check
  - `GET /api/traders` → list all traders
  - `POST /api/traders` → create trader
  - `PATCH /api/traders/:id/approve` → approve trader
- WebSocket and REST client initialization
- Trade event listener (TODO: implement copy logic)
- Graceful shutdown on SIGINT

**src/tests/database.test.ts** (109 lines)
- Tests: CREATE, READ, UPDATE, DELETE operations
- Validates unique constraint
- Cleanup after tests
- Exit codes: 0 (pass), 1 (fail)

**src/tests/rest-api.test.ts** (45 lines)
- Tests: getAccountInfo, getPositions
- Shows rate limiting status
- Environment variable validation
- Exit codes: 0 (pass), 1 (fail)

### Documentation

**README.md** (6,093 bytes)
- Project overview
- Features list
- Installation instructions
- Configuration guide
- API reference
- Database schema
- Testing instructions
- Security notes
- Next steps

**QUICKSTART.md** (4,062 bytes)
- 5-minute setup guide
- Step-by-step testing
- Available commands
- API endpoint examples
- Troubleshooting
- Next steps

**TESTING.md** (9,014 bytes)
- Pre-testing setup
- 10 test cases with checklists:
  1. Database connection & CRUD
  2. WebSocket connection & ping/pong
  3. WebSocket auto-reconnect
  4. Live trade detection
  5. REST API - Get account info
  6. REST API - Get positions
  7. REST API - Place market order
  8. Rate limiting
  9. Error handling - 429 retry
  10. Express server endpoints

**PROJECT_SUMMARY.md** (10,380 bytes)
- Complete project summary
- Implementation highlights
- Key features breakdown
- Getting started guide
- Next steps for copy trading
- Security considerations
- Production deployment checklist

**API.md** (3,557 bytes)
- Pacifica API reference
- Base URLs (mainnet/testnet)
- Authentication (Ed25519)
- WebSocket protocol
- REST endpoints
- Rate limits
- Important notes

## NPM Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with auto-reload |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Run production server |
| `npm run test:db` | Run database CRUD tests |
| `npm run test:rest` | Run REST API tests |
| `npm run migrate:up` | Apply database migrations |
| `npm run migrate:down` | Rollback database migrations |

## Dependencies

### Production (7 packages)
- **express** (v5.1.0) - Web framework
- **ws** (v8.18.3) - WebSocket client
- **tweetnacl** (v1.0.3) - Ed25519 signing
- **bs58** (v6.0.0) - Base58 encoding
- **sequelize** (v6.37.7) - ORM
- **pg** (v8.16.3) - PostgreSQL driver
- **dotenv** (v17.2.3) - Environment variables
- **cors** (v2.8.5) - CORS middleware

### Development (6 packages)
- **typescript** (v5.9.3) - TypeScript compiler
- **ts-node** (v10.9.2) - Run TypeScript directly
- **nodemon** (v3.1.10) - Auto-reload during development
- **@types/node** (v24.6.2) - Node.js type definitions
- **@types/express** (v5.0.3) - Express type definitions
- **@types/ws** (v8.18.1) - WebSocket type definitions
- **@types/cors** (v2.8.19) - CORS type definitions

## Lines of Code

| File | Lines | Description |
|------|-------|-------------|
| src/api/websocket-client.ts | 187 | WebSocket client |
| src/api/rest-client.ts | 195 | REST API client |
| src/index.ts | 143 | Main server |
| src/database/config.ts | 42 | Database config |
| src/database/models/Trader.ts | 51 | Trader model |
| src/database/migrations/001-create-traders-table.ts | 36 | Migration |
| src/database/migrate.ts | 50 | Migration runner |
| src/tests/database.test.ts | 109 | Database tests |
| src/tests/rest-api.test.ts | 45 | REST tests |
| **Total Source Code** | **858** | **9 TypeScript files** |

## Environment Setup

1. Copy `.env.example` to `.env`
2. Fill in required values:
   - PostgreSQL connection string
   - Pacifica API URLs (mainnet or testnet)
   - Master wallet to monitor
   - Copier wallet credentials (public key + private key in base58)
3. Run migrations: `npm run migrate:up`
4. Test database: `npm run test:db`
5. Start server: `npm run dev`

## Next Steps

1. ✅ Foundation complete (all requirements met)
2. ✅ Testing suite ready
3. ⏭️ Implement copy trading logic in `src/index.ts`
4. ⏭️ Add position sizing calculations
5. ⏭️ Add safety limits (max position, daily limit)
6. ⏭️ Deploy to production

---

**Status:** ✅ Foundation Complete - Ready for Testing & Implementation
