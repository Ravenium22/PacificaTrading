# Setup & Command Reference

## Initial Setup (One-time)

```bash
# 1. Install dependencies
npm install

# 2. Create .env file from template
cp .env.example .env

# 3. Edit .env with your credentials
# Use your text editor to fill in:
# - DATABASE_URL=postgresql://user:password@localhost:5432/dbname
# - PACIFICA_WS_URL=wss://ws.pacifica.fi/ws
# - PACIFICA_API_URL=https://api.pacifica.fi/api/v1
# - MASTER_WALLET=wallet_to_monitor
# - COPIER_WALLET=your_public_key
# - COPIER_PRIVATE_KEY=your_private_key_base58

# 4. Run database migration
npm run migrate:up

# 5. Test database connection
npm run test:db
```

## Development Commands

```bash
# Start development server (with auto-reload)
npm run dev

# Build TypeScript to JavaScript
npm run build

# Start production server
npm start
```

## Testing Commands

```bash
# Test database CRUD operations
npm run test:db

# Test REST API client
npm run test:rest
```

## Database Commands

```bash
# Apply migrations (create tables)
npm run migrate:up

# Rollback migrations (drop tables)
npm run migrate:down
```

## Quick Test Workflow

### 1. Test Database
```bash
npm run test:db
```
Expected: ✓ All Tests Passed

### 2. Test REST API (requires .env configured)
```bash
npm run test:rest
```
Expected: ✓ Account info and positions fetched

### 3. Test WebSocket & Live Trades
```bash
# Terminal 1: Start server
npm run dev

# Expected logs:
# [Database] Connection established successfully
# [WebSocket] Connected successfully
# [WebSocket] Subscribing to account_trades for {MASTER_WALLET}
# [Server] Running on port 3000

# Terminal 2: Make a test trade on Pacifica with MASTER_WALLET
# Watch Terminal 1 for trade logs:
# [WebSocket] Trade received: { symbol: 'BTC', side: 'open_long', ... }
```

## API Endpoints (when server is running)

```bash
# Health check
curl http://localhost:3000/health

# Get all traders
curl http://localhost:3000/api/traders

# Add trader to monitor
curl -X POST http://localhost:3000/api/traders \
  -H "Content-Type: application/json" \
  -d '{"wallet_address":"WALLET_ADDRESS"}'

# Approve trader (replace 1 with trader ID)
curl -X PATCH http://localhost:3000/api/traders/1/approve

# Get trader by ID
curl http://localhost:3000/api/traders/1
```

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/db` |
| `PACIFICA_WS_URL` | Pacifica WebSocket URL | `wss://ws.pacifica.fi/ws` |
| `PACIFICA_API_URL` | Pacifica REST API URL | `https://api.pacifica.fi/api/v1` |
| `MASTER_WALLET` | Wallet to monitor for trades | Your wallet address |
| `COPIER_WALLET` | Your trading wallet (public key) | Your public key |
| `COPIER_PRIVATE_KEY` | Your trading wallet private key | Base58 encoded private key |
| `PORT` | Server port (optional) | `3000` (default) |

## Troubleshooting

### Issue: "Cannot find module"
```bash
# Solution: Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Issue: "DATABASE_URL not set"
```bash
# Solution: Create .env file
cp .env.example .env
# Edit .env and add your DATABASE_URL
```

### Issue: TypeScript compilation errors
```bash
# Solution: Check TypeScript version and rebuild
npm run build
# Fix any errors shown
```

### Issue: WebSocket won't connect
```bash
# Check:
# 1. PACIFICA_WS_URL is correct in .env
# 2. Internet connection is working
# 3. Firewall allows WebSocket connections
```

### Issue: REST API 401 Unauthorized
```bash
# Check:
# 1. COPIER_PRIVATE_KEY is correct and in base58 format
# 2. COPIER_WALLET matches the private key
# 3. Signature generation is working (check signing logic)
```

### Issue: Rate limit (429) errors
```bash
# The bot auto-retries once
# If it persists:
# 1. Check if multiple instances are running
# 2. Verify rate limit is set to 90/min (not higher)
# 3. Wait 1 minute for rate limit to reset
```

## Production Deployment

```bash
# 1. Build the project
npm run build

# 2. Set production environment variables
# (on your server, not in .env)

# 3. Run with process manager (PM2 example)
pm2 start dist/index.js --name pacifica-bot

# 4. Check logs
pm2 logs pacifica-bot

# 5. Monitor
pm2 monit
```

## File Locations

| File Type | Location |
|-----------|----------|
| Source code | `src/` |
| Compiled JS | `dist/` |
| Configuration | `.env`, `tsconfig.json`, `package.json` |
| Documentation | `*.md` files in root |
| Tests | `src/tests/` |
| Database | `src/database/` |
| API clients | `src/api/` |

## Documentation Files

| File | Purpose |
|------|---------|
| `README.md` | Full project documentation |
| `QUICKSTART.md` | 5-minute setup guide |
| `TESTING.md` | Testing checklist |
| `PROJECT_SUMMARY.md` | Project overview & status |
| `STRUCTURE.md` | File structure & architecture |
| `SETUP_COMMANDS.md` | This file - command reference |
| `API.md` | Pacifica API reference |

## Useful Commands Reference

```bash
# Install new package
npm install package-name

# Install new dev package
npm install -D package-name

# Check for outdated packages
npm outdated

# Update packages
npm update

# Check TypeScript errors without building
npx tsc --noEmit

# Run specific test file
ts-node src/tests/database.test.ts

# View logs in development
npm run dev | tee logs/dev.log

# Check PostgreSQL connection
psql $DATABASE_URL -c "SELECT 1"
```

## Git Commands (if using version control)

```bash
# Initialize git (if not already done)
git init

# Stage all files
git add .

# Commit
git commit -m "Initial commit: Pacifica copy trading bot foundation"

# Add remote
git remote add origin YOUR_REPO_URL

# Push
git push -u origin main
```

## Quick Reference Card

**Start Development:**
```bash
npm run dev
```

**Run Tests:**
```bash
npm run test:db && npm run test:rest
```

**Deploy Production:**
```bash
npm run build && npm start
```

**Reset Database:**
```bash
npm run migrate:down && npm run migrate:up
```

**View Server Status:**
```bash
curl http://localhost:3000/health
```

---

**Need Help?** Check documentation files in project root or run `npm run dev` and watch the logs for errors.
