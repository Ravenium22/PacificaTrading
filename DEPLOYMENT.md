# Production Deployment: Vercel (Frontend) + Railway (Backend)

This guide deploys:
- Frontend (Next.js) to Vercel
- Backend (Express + Postgres + WebSocket worker) to Railway

The frontend talks to the backend via NEXT_PUBLIC_API_URL.

## 1) Backend on Railway

Prereqs: GitHub repo connected to Railway, or deploy from local.

- Create a new Railway project (Service: Node.js)
- Set the build command: `npm run build`
- Set the start command: `npm start`
- Add a Postgres plugin (Provision a PostgreSQL database)

### Environment Variables (Railway)
Add these in Railway -> Variables for your Node service:

Required
- PORT: 3000 (Railway provides PORT automatically, you can omit — Express uses process.env.PORT)
- DATABASE_URL: Provided automatically by the Postgres plugin (copy the full connection string)
- NODE_ENV: production
- ENCRYPTION_KEY: 64-char hex string (use `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` to generate)

Optional (enables trading + WS subscription)
- PACIFICA_API_URL: e.g. https://api.pacifica.fi
- PACIFICA_WS_URL: e.g. wss://stream.pacifica.fi (example; set to your real WS endpoint)
- COPIER_WALLET: Your Solana public key
- COPIER_PRIVATE_KEY: Base58 secret key for the copier agent wallet
- FRONTEND_URL: Your Vercel domain, e.g. https://your-app.vercel.app

Notes:
- The server runs automatic DB migrations on start (`prestart` script).
- CORS in production only allows FRONTEND_URL; set it to your Vercel domain.

### Deploy Steps (Railway)
1. Connect repo or use CLI to deploy
2. Ensure Variables are set (above)
3. Trigger a deployment. Logs should show:
   - [Database] Connection established successfully
   - [Database] Models synchronized
   - [Server] Running on port 3000

Test the health endpoint:
- `GET https://<railway-backend-domain>/health` should return `{ status: "ok" }`

## 2) Frontend on Vercel

- Import the `frontend/` folder as a Vercel project
- Framework preset: Next.js
- Build Command: `npm run build`
- Output Directory: `.vercel/output` (Vercel auto-detects; default is fine)

### Environment Variables (Vercel)
Project Settings -> Environment Variables:
- NEXT_PUBLIC_API_URL: `https://<railway-backend-domain>` (no trailing slash)

Optional:
- NODE_ENV: production (Vercel sets automatically for prod)

### Domains
- Assign a production domain in Vercel
- Copy the final frontend URL back to Railway as FRONTEND_URL to lock down CORS

## 3) Local sanity check

From the root:
- `npm run build` (backend type checks)
From `frontend/`:
- `npm run build` (Next.js build)

## 4) Troubleshooting

- 403 from backend in prod: Verify Trader approval flow and that you created a Trader row or approval request.
- CORS errors: Ensure FRONTEND_URL is set on Railway and matches your Vercel domain, including protocol. Redeploy after changing envs.
- DB errors: Confirm DATABASE_URL points to Railway Postgres. Migrations run at start; check logs for migration messages.
- Encryption errors: Set a valid 64-char hex ENCRYPTION_KEY in Railway.

## 5) Rollout checklist
- [ ] Railway deploy green, `/health` OK
- [ ] Vercel deploy green, homepage loads
- [ ] Creating relationships works from frontend
- [ ] Strategies create successfully
- [ ] WebSocket trade replication logs visible when trades occur
