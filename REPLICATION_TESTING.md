# Trade Replication Testing Guide

## Overview
Trade replication is now active! When the master wallet makes a trade, the copier wallet automatically executes a proportional trade (50% by default).

## What Was Added

### 1. Replication Logic (`src/index.ts`)
- **Balance checking** - Verifies sufficient funds before executing
- **Position sizing** - Copies trades at 50% of master amount (configurable)
- **Side conversion** - Converts trade sides (open_long, close_long, etc.) to bid/ask
- **Error handling** - Logs errors without crashing, tracks consecutive failures
- **Slippage calculation** - Shows price difference between master and copier trades

### 2. Environment Variable
Added to `.env.example`:
```
POSITION_MULTIPLIER=0.5
```
This controls the position sizing (0.5 = 50% of master trade).

### 3. Replication Logs
The bot logs detailed information about each replication:
```
[REPLICATION] Master: BTC open_long 0.001 @ 123921
[REPLICATION] Checking copier balance...
[REPLICATION] Available balance: 683.814441
[REPLICATION] Estimated cost: 61.9605
[REPLICATION] Copier: executing BTC open_long 0.0005 @ market
[REPLICATION] Success: order placed, id: 12345
[REPLICATION] Slippage: 0.02% (master: 123921, copier: 123946)
```

## How It Works

### Flow:
1. Master wallet makes a trade on Pacifica
2. WebSocket receives trade event (only `fulfill_maker` events)
3. Replication logic calculates copier amount (master × 0.5)
4. Checks copier balance via REST API
5. If sufficient balance: executes market order
6. Logs success/failure with slippage info

### Trade Side Conversion:
- `open_long` → `bid` (buy to open long)
- `close_long` → `ask` (sell to close long)
- `open_short` → `ask` (sell to open short)
- `close_short` → `bid` (buy to close short)

### Safety Features:
- ✅ Balance check before execution
- ✅ Skips if insufficient funds
- ✅ Error handling (doesn't crash)
- ✅ Consecutive failure tracking
- ✅ Warning after 3 consecutive failures

---

## Testing Steps

### Test 1: Basic Replication ✅

**Setup:**
```bash
# 1. Make sure .env has POSITION_MULTIPLIER=0.5
# 2. Start the bot
npm run dev
```

**Expected Startup Logs:**
```
[Database] Connection established successfully
[Server] REST client initialized
[WebSocket] Connected successfully
[WebSocket] Subscribing to account_trades for {MASTER_WALLET}
[Server] Running on port 3000
```

**Execute Test:**
1. Go to Pacifica exchange
2. Log in with MASTER_WALLET
3. Make a small trade:
   - Symbol: BTC
   - Side: Buy (open long)
   - Amount: 0.001 BTC
   - Type: Market order

**Expected Logs:**
```
[WebSocket] Trade received: {
  symbol: 'BTC',
  side: 'open_long',
  amount: '0.001',
  price: '123921',
  trader: '{MASTER_WALLET}'
}

[REPLICATION] Master: BTC open_long 0.001 @ 123921
[REPLICATION] Checking copier balance...
[REPLICATION] Available balance: 683.814441
[REPLICATION] Estimated cost: 61.9605
[REPLICATION] Copier: executing BTC open_long 0.0005 @ market
[REPLICATION] Success: order placed, id: 12345
[REPLICATION] Slippage: 0.02% (master: 123921, copier: 123946)
```

**Verification:**
- [ ] Check Pacifica: Both wallets have the trade
- [ ] Master amount: 0.001 BTC
- [ ] Copier amount: 0.0005 BTC (50% of master)
- [ ] Prices are close (small slippage)
- [ ] No errors in logs

---

### Test 2: Insufficient Balance ⚠️

**Setup:**
1. Withdraw most funds from copier wallet
2. Leave only a small amount (e.g., $10)

**Execute Test:**
1. Make a large trade with master wallet:
   - Symbol: BTC
   - Amount: 0.1 BTC (large)
   - Side: Buy

**Expected Logs:**
```
[REPLICATION] Master: BTC open_long 0.1 @ 123921
[REPLICATION] Checking copier balance...
[REPLICATION] Available balance: 10.0
[REPLICATION] Estimated cost: 6196.05
[REPLICATION] SKIPPED: Insufficient balance (need 6196.05, have 10.0)
```

**Verification:**
- [ ] Trade is skipped (not executed on copier)
- [ ] Log shows "SKIPPED: Insufficient balance"
- [ ] Bot continues running (doesn't crash)
- [ ] Master trade still executes normally

---

### Test 3: Close Position ✅

**Setup:**
1. Ensure both wallets have an open long position

**Execute Test:**
1. Close the position with master wallet:
   - Symbol: BTC
   - Side: Sell (close long)
   - Amount: Full position amount

**Expected Logs:**
```
[REPLICATION] Master: BTC close_long 0.001 @ 124200
[REPLICATION] Copier: executing BTC close_long 0.0005 @ market
[REPLICATION] Success: order placed, id: 12346
```

**Verification:**
- [ ] Both positions are closed
- [ ] `reduce_only: true` was used
- [ ] Slippage is calculated
- [ ] No errors

---

### Test 4: Consecutive Failures Warning ⚠️

**Setup:**
1. Temporarily invalidate copier private key in `.env` (add a character)
2. Restart bot: `npm run dev`

**Execute Test:**
1. Make 3 trades with master wallet

**Expected Logs:**
```
[REPLICATION] Failed: Unauthorized (after each trade)
[REPLICATION] WARNING: 3 consecutive failures - check copier account!
```

**Verification:**
- [ ] After 3 failures, warning appears
- [ ] Bot continues running
- [ ] Doesn't crash despite failures

**Cleanup:**
- Fix the private key in `.env`
- Restart bot

---

### Test 5: Different Position Sizes 🔧

**Setup:**
1. Edit `.env` and change `POSITION_MULTIPLIER=0.5` to `POSITION_MULTIPLIER=0.25`
2. Restart bot: `npm run dev`

**Execute Test:**
1. Make a trade with master:
   - Amount: 0.004 BTC

**Expected Logs:**
```
[REPLICATION] Master: BTC open_long 0.004 @ 123921
[REPLICATION] Copier: executing BTC open_long 0.001 @ market
```

**Verification:**
- [ ] Copier amount = 0.001 (25% of 0.004)
- [ ] Position multiplier works correctly

**Cleanup:**
- Change back to `POSITION_MULTIPLIER=0.5`
- Restart bot

---

## Verification Checklist

After all tests:

- [ ] Master trades execute on Pacifica
- [ ] Copier trades execute at 50% size (default)
- [ ] Balance check prevents insufficient balance trades
- [ ] Slippage is calculated and logged
- [ ] Bot handles errors gracefully (no crashes)
- [ ] Warning appears after 3 consecutive failures
- [ ] Both long and short positions work
- [ ] Close positions use `reduce_only: true`
- [ ] WebSocket reconnects if disconnected

---

## Common Issues & Solutions

### Issue: "REPLICATION REST client not initialized"
**Solution:** Check that all environment variables are set in `.env`:
```
PACIFICA_API_URL=...
COPIER_WALLET=...
COPIER_PRIVATE_KEY=...
```

### Issue: "SKIPPED: Failed to fetch account info"
**Solution:**
- Verify `COPIER_WALLET` is correct
- Check API URL is reachable
- Test with `npm run test:rest`

### Issue: No trades are replicating
**Solution:**
- Check WebSocket is connected (look for "[WebSocket] Connected successfully")
- Verify `MASTER_WALLET` is correct
- Make sure trades are market orders (limit orders are ignored)
- Check logs for "[WebSocket] Trade received"

### Issue: "Unknown trade side"
**Solution:** This shouldn't happen with Pacifica trades. If it does:
- Check trade event format
- Verify trade side is one of: open_long, close_long, open_short, close_short

### Issue: Slippage too high
**Solution:**
- Adjust `slippage_percent` in `src/index.ts` (line 149)
- Current: `0.5%`, increase to `1.0%` or `2.0%` if needed

---

## Monitoring

### Key Metrics to Watch:
1. **Replication success rate** - Should be close to 100%
2. **Average slippage** - Should be < 0.5%
3. **Balance warnings** - Indicates need to deposit funds
4. **Consecutive failures** - Should stay at 0

### Logs to Monitor:
```bash
# Watch logs in real-time
npm run dev

# Look for:
[REPLICATION] Success: order placed
[REPLICATION] Slippage: X%
[REPLICATION] WARNING (if any failures)
```

---

## Next Steps

Once basic replication is working:

1. **Add trader approval checks** (check database for approved traders)
2. **Implement position limits** (max position size, daily limits)
3. **Add trade history logging** (save to database)
4. **Implement advanced position sizing** (based on account size, risk %)
5. **Add notifications** (Discord/Telegram alerts)
6. **Implement stop-loss logic**
7. **Add performance tracking**

---

## Quick Reference

**Start bot:**
```bash
npm run dev
```

**View logs:**
Watch terminal output in real-time

**Test balance:**
```bash
npm run test:rest
```

**Stop bot:**
Press `Ctrl+C`

**Change position size:**
Edit `POSITION_MULTIPLIER` in `.env`, then restart bot

---

**Status:** ✅ Trade replication is ACTIVE and ready for testing!

**Start testing:** Make a small trade with your master wallet and watch it replicate!
