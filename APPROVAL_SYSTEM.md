# Copy Trading Approval System

## Overview

The approval system adds manual gating to the copy trading bot. Only approved wallets can execute copy trades. This system includes:

- Database schema with approval tracking
- API endpoints for request submission and status checking
- Admin endpoints for approval management
- Admin dashboard UI
- Automatic approval check before trade replication

---

## Database Schema

The `traders` table has been extended with:

```sql
wallet_address    VARCHAR     (Primary Key, Unique)
is_approved       BOOLEAN     (Default: false)
requested_at      TIMESTAMP   (Default: NOW)
approved_at       TIMESTAMP   (Nullable)
notes             TEXT        (Nullable)
created_at        TIMESTAMP   (Default: NOW)
```

---

## API Endpoints

### User Endpoints

#### 1. Submit Approval Request
```http
POST /api/copy/request
Content-Type: application/json

{
  "wallet_address": "EPwPib9r5pK5Z9S6iyT6t9yCD9MeA3P5G4srPT2dYfuY"
}
```

**Success Response (201):**
```json
{
  "message": "Approval request created",
  "wallet": {
    "full": "EPwPib9r5pK5Z9S6iyT6t9yCD9MeA3P5G4srPT2dYfuY",
    "first_4": "EPwP",
    "last_4": "YfuY"
  },
  "status": "pending"
}
```

**Error Responses:**
- 400: Missing wallet_address
- 409: Request already exists

---

#### 2. Check Approval Status
```http
GET /api/copy/status/:wallet
```

**Success Response (200):**
```json
{
  "wallet": {
    "full": "EPwPib9r5pK5Z9S6iyT6t9yCD9MeA3P5G4srPT2dYfuY",
    "first_4": "EPwP",
    "last_4": "YfuY"
  },
  "status": "approved",
  "requested_at": "2024-10-10T12:00:00.000Z",
  "approved_at": "2024-10-10T12:30:00.000Z",
  "notes": "Verified user"
}
```

**Error Responses:**
- 404: No approval request found

---

### Admin Endpoints

#### 1. Get Pending Requests
```http
GET /admin/pending
```

**Success Response (200):**
```json
[
  {
    "id": 1,
    "wallet": {
      "full": "EPwPib9r5pK5Z9S6iyT6t9yCD9MeA3P5G4srPT2dYfuY",
      "first_4": "EPwP",
      "last_4": "YfuY"
    },
    "requested_at": "2024-10-10T12:00:00.000Z",
    "notes": null
  }
]
```

---

#### 2. Get Approved Wallets
```http
GET /admin/approved
```

**Success Response (200):**
```json
[
  {
    "id": 1,
    "wallet": {
      "full": "EPwPib9r5pK5Z9S6iyT6t9yCD9MeA3P5G4srPT2dYfuY",
      "first_4": "EPwP",
      "last_4": "YfuY"
    },
    "requested_at": "2024-10-10T12:00:00.000Z",
    "approved_at": "2024-10-10T12:30:00.000Z",
    "notes": "Verified user"
  }
]
```

---

#### 3. Approve Wallet
```http
POST /admin/approve/:wallet
Content-Type: application/json

{
  "notes": "Verified user - KYC completed"
}
```

**Success Response (200):**
```json
{
  "message": "Wallet approved",
  "wallet": {
    "full": "EPwPib9r5pK5Z9S6iyT6t9yCD9MeA3P5G4srPT2dYfuY",
    "first_4": "EPwP",
    "last_4": "YfuY"
  },
  "approved_at": "2024-10-10T12:30:00.000Z"
}
```

**Error Responses:**
- 400: Trader already approved
- 404: Trader not found

---

#### 4. Deny Wallet
```http
POST /admin/deny/:wallet
```

**Success Response (200):**
```json
{
  "message": "Wallet denied and removed",
  "wallet": {
    "full": "EPwPib9r5pK5Z9S6iyT6t9yCD9MeA3P5G4srPT2dYfuY",
    "first_4": "EPwP",
    "last_4": "YfuY"
  }
}
```

---

## Admin Dashboard

Access the admin dashboard at: `http://localhost:3000/admin`

### Features:
- **Pending Requests Table**: Shows all wallets awaiting approval
  - Wallet address (first 4 + last 4 chars)
  - Request timestamp
  - Notes field
  - Approve/Deny buttons

- **Approved Wallets Table**: Shows all approved wallets
  - Wallet address (first 4 + last 4 chars)
  - Request timestamp
  - Approval timestamp
  - Notes field

- **Auto-refresh**: Dashboard automatically refreshes every 30 seconds
- **Manual refresh**: Refresh buttons for each section

### Dashboard Actions:
1. **Approve**: Prompts for optional notes, then approves the wallet
2. **Deny**: Confirms action, then removes the wallet from the system

---

## Trade Replication Behavior

The `replicateTrade()` function now checks approval status **before** executing any trade:

```typescript
// Check if copier wallet is approved
const copier = await Trader.findOne({ where: { wallet_address: copierWallet } });
if (!copier || !copier.is_approved) {
  console.log('[REPLICATION] SKIPPED: Copier not approved');
  return;
}
```

**Behavior:**
- ✅ If approved: Trade replicates normally
- ❌ If not approved: Trade is skipped with log message
- ❌ If not in database: Trade is skipped with log message

---

## Testing Guide

### Step 1: Start the Server
```bash
npm run build
npm start
```

Server should start on `http://localhost:3000`

---

### Step 2: Request Approval for Copier Wallet

**Using curl:**
```bash
curl -X POST http://localhost:3000/api/copy/request \
  -H "Content-Type: application/json" \
  -d '{"wallet_address":"EPwPib9r5pK5Z9S6iyT6t9yCD9MeA3P5G4srPT2dYfuY"}'
```

**Using Postman/Thunder Client:**
- Method: POST
- URL: `http://localhost:3000/api/copy/request`
- Body (JSON):
  ```json
  {
    "wallet_address": "EPwPib9r5pK5Z9S6iyT6t9yCD9MeA3P5G4srPT2dYfuY"
  }
  ```

**Expected Response:**
```json
{
  "message": "Approval request created",
  "wallet": {
    "full": "EPwPib9r5pK5Z9S6iyT6t9yCD9MeA3P5G4srPT2dYfuY",
    "first_4": "EPwP",
    "last_4": "YfuY"
  },
  "status": "pending"
}
```

---

### Step 3: Check Admin Dashboard

1. Open browser: `http://localhost:3000/admin`
2. You should see the copier wallet in the "Pending Approval Requests" table
3. Wallet should display as: `EPwP...YfuY`

---

### Step 4: Test Unapproved Behavior

1. Trigger a master wallet trade (or wait for one)
2. Check server logs - you should see:
   ```
   [REPLICATION] SKIPPED: Copier not approved
   ```
3. Trade should NOT replicate

---

### Step 5: Approve the Wallet

**Option A - Using Dashboard:**
1. In admin dashboard, click "Approve" button for the pending wallet
2. Optional: Enter notes (e.g., "Test approval")
3. Click OK
4. Wallet should move to "Approved Wallets" section

**Option B - Using API:**
```bash
curl -X POST http://localhost:3000/admin/approve/EPwPib9r5pK5Z9S6iyT6t9yCD9MeA3P5G4srPT2dYfuY \
  -H "Content-Type: application/json" \
  -d '{"notes":"Test approval"}'
```

---

### Step 6: Test Approved Behavior

1. Trigger another master wallet trade (or wait for one)
2. Check server logs - you should see normal replication flow:
   ```
   [REPLICATION] Master: SOL open_long 1.5 @ 145.32
   [REPLICATION] Checking copier balance...
   [REPLICATION] Copier: executing SOL open_long 0.75 @ market
   [REPLICATION] Success: order placed, id: xyz123
   ```
3. Trade SHOULD replicate successfully

---

### Step 7: Test Status Check

```bash
curl http://localhost:3000/api/copy/status/EPwPib9r5pK5Z9S6iyT6t9yCD9MeA3P5G4srPT2dYfuY
```

**Expected Response:**
```json
{
  "wallet": {
    "full": "EPwPib9r5pK5Z9S6iyT6t9yCD9MeA3P5G4srPT2dYfuY",
    "first_4": "EPwP",
    "last_4": "YfuY"
  },
  "status": "approved",
  "requested_at": "2024-10-10T12:00:00.000Z",
  "approved_at": "2024-10-10T12:30:00.000Z",
  "notes": "Test approval"
}
```

---

### Step 8: Test Deny Functionality

1. Create another test request:
   ```bash
   curl -X POST http://localhost:3000/api/copy/request \
     -H "Content-Type: application/json" \
     -d '{"wallet_address":"TestWallet123456789"}'
   ```

2. In admin dashboard, click "Deny" for this wallet
3. Wallet should be removed from the system
4. Check status - should return 404:
   ```bash
   curl http://localhost:3000/api/copy/status/TestWallet123456789
   ```

---

## Implementation Details

### Files Modified:
1. `src/database/models/Trader.ts` - Added new fields
2. `src/database/migrations/002-add-approval-fields.ts` - New migration
3. `src/database/migrate.ts` - Updated to run new migration
4. `src/index.ts` - Added endpoints and approval check
5. `src/admin/dashboard.html` - New admin UI

### Key Features:
- ✅ Database schema with approval tracking
- ✅ User request submission endpoint
- ✅ User status check endpoint
- ✅ Admin pending list endpoint
- ✅ Admin approved list endpoint
- ✅ Admin approve endpoint with notes
- ✅ Admin deny endpoint
- ✅ Wallet formatting helper (first 4 + last 4)
- ✅ Trade replication gating
- ✅ Admin dashboard UI
- ✅ Auto-refresh dashboard
- ✅ Manual refresh buttons

---

## Next Steps (Optional Enhancements)

1. **Authentication**: Add basic auth or API keys to admin routes
2. **Webhooks**: Notify users when approved/denied
3. **Rate Limiting**: Prevent spam requests
4. **Audit Log**: Track all admin actions
5. **Bulk Actions**: Approve/deny multiple wallets at once
6. **Search/Filter**: Filter wallets in dashboard
7. **Email Notifications**: Auto-notify users of status changes

---

## Security Considerations

⚠️ **Important**: The admin routes currently have **no authentication**. Before deploying to production:

1. Add authentication middleware to admin routes
2. Use environment variables for admin credentials
3. Implement API rate limiting
4. Add HTTPS/SSL for production
5. Consider IP whitelisting for admin access
6. Add CSRF protection for admin actions

---

## Troubleshooting

### Issue: Migration fails with "relation already exists"
**Solution**: The migration script now checks for existing tables/columns and skips them automatically.

### Issue: Dashboard shows "Failed to load"
**Solution**: Check that the server is running and the database connection is working.

### Issue: Trades still replicate when not approved
**Solution**: Ensure you've restarted the server after running migrations and rebuilding.

### Issue: Admin dashboard not loading
**Solution**: Ensure the HTML file is in `src/admin/dashboard.html` and has been copied to `dist/admin/dashboard.html` during build.

---

## Support

For issues or questions, check:
1. Server logs for detailed error messages
2. Database connection status
3. Environment variables are set correctly
4. Migrations have run successfully
