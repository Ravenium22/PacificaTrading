import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { connectDatabase, syncDatabase } from './database/config';
import { PacificaWebSocketClient } from './api/websocket-client';
import { PacificaRestClient } from './api/rest-client';
import Trader from './database/models/Trader';
import CopyRelationship from './database/models/CopyRelationship';
import { encryptApiKey, decryptApiKey } from './utils/encryption';
import { isValidSolanaPrivateKey, verifySolanaSignature, isRecentTimestamp } from './utils/validation';
import strategyRoutes from './api/strategies';
import { strategyExecutor } from './strategies/executor';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL
    : true, // allow all origins in development
  credentials: true
}));
app.use(express.json());

// Simple Basic Auth for admin endpoints
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;

function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  if (!ADMIN_USER || !ADMIN_PASS) {
    // If not configured, block access in production to avoid exposing admin
    if (process.env.NODE_ENV === 'production') {
      return res.status(503).send('Admin authentication not configured');
    }
    return next(); // allow in dev when not configured
  }

  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin"');
    return res.status(401).send('Authentication required');
  }

  const encoded = auth.substring('Basic '.length);
  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  const sep = decoded.indexOf(':');
  const user = decoded.substring(0, sep);
  const pass = decoded.substring(sep + 1);

  if (user === ADMIN_USER && pass === ADMIN_PASS) {
    return next();
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="Admin"');
  return res.status(401).send('Invalid credentials');
}

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('[Server] Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Helper function for wallet display
function formatWallet(address: string) {
  return {
    full: address,
    first_4: address.substring(0, 4),
    last_4: address.substring(address.length - 4)
  };
}

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount strategy routes
app.use('/api/strategies', strategyRoutes);

// Trader endpoints
app.get('/api/traders', async (req: Request, res: Response) => {
  try {
    const traders = await Trader.findAll();
    res.json(traders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch traders' });
  }
});

app.post('/api/traders', async (req: Request, res: Response) => {
  try {
    const { wallet_address } = req.body;

    if (!wallet_address) {
      return res.status(400).json({ error: 'wallet_address is required' });
    }

    const trader = await Trader.create({ wallet_address });
    res.status(201).json(trader);
  } catch (error: any) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'Trader already exists' });
    }
    res.status(500).json({ error: 'Failed to create trader' });
  }
});

app.patch('/api/traders/:id/approve', async (req: Request, res: Response) => {
  try {
    const trader = await Trader.findByPk(req.params.id);

    if (!trader) {
      return res.status(404).json({ error: 'Trader not found' });
    }

    trader.is_approved = true;
    await trader.save();

    res.json(trader);
  } catch (error) {
    res.status(500).json({ error: 'Failed to approve trader' });
  }
});

// Copy trading request endpoints
app.post('/api/copy/request', async (req: Request, res: Response) => {
  try {
    const { wallet_address, signature, timestamp } = req.body;

    if (!wallet_address) {
      return res.status(400).json({ error: 'wallet_address is required' });
    }

    // Require signature + fresh timestamp to verify wallet ownership and prevent replay
    if (!signature || !timestamp) {
      return res.status(400).json({ error: 'signature and timestamp are required' });
    }

    if (!isRecentTimestamp(Number(timestamp))) {
      return res.status(400).json({ error: 'timestamp is too old or invalid' });
    }

    const message = JSON.stringify({
      type: 'copy_approval_request',
      wallet_address,
      timestamp: Number(timestamp)
    });

    const ok = verifySolanaSignature(message, String(signature), String(wallet_address));
    if (!ok) {
      return res.status(401).json({ error: 'invalid signature' });
    }

    // Check if already exists
    const existing = await Trader.findOne({ where: { wallet_address } });
    if (existing) {
      return res.status(409).json({
        error: 'Request already exists',
        status: existing.is_approved ? 'approved' : 'pending'
      });
    }

    // Create new approval request
    const trader = await Trader.create({
      wallet_address,
      is_approved: false,
      requested_at: new Date()
    });

    res.status(201).json({
      message: 'Approval request created',
      wallet: formatWallet(wallet_address),
      status: 'pending'
    });
  } catch (error) {
    console.error('[API] Copy request error:', error);
    res.status(500).json({ error: 'Failed to create approval request' });
  }
});

app.get('/api/copy/status/:wallet', async (req: Request, res: Response) => {
  try {
    const { wallet } = req.params;

    const trader = await Trader.findOne({ where: { wallet_address: wallet } });

    if (!trader) {
      return res.status(404).json({
        status: 'not_found',
        message: 'No approval request found for this wallet'
      });
    }

    res.json({
      wallet: formatWallet(wallet),
      status: trader.is_approved ? 'approved' : 'pending',
      requested_at: trader.requested_at,
      approved_at: trader.approved_at,
      notes: trader.notes
    });
  } catch (error) {
    console.error('[API] Status check error:', error);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

// New Copy Relationship endpoints
app.post('/api/copy/create', async (req: Request, res: Response) => {
  try {
    const { user_wallet, api_key, master_wallet, sizing_method, sizing_value, max_position_cap, symbols, custom_leverage, max_total_exposure, symbol_multipliers } = req.body;

    // Validate required fields
    if (!user_wallet || !api_key || !master_wallet) {
      return res.status(400).json({
        error: 'user_wallet, api_key, and master_wallet are required'
      });
    }

    // Validate sizing method and value
    const method = sizing_method || 'multiplier';
    const validMethods = ['multiplier', 'fixed_usd', 'balance_percent'];
    if (!validMethods.includes(method)) {
      return res.status(400).json({
        error: 'sizing_method must be one of: multiplier, fixed_usd, balance_percent'
      });
    }

    const value = sizing_value !== undefined ? parseFloat(sizing_value) : 0.5;

    // Validate sizing_value based on method
    switch (method) {
      case 'multiplier':
        if (value < 0.01 || value > 2.0) {
          return res.status(400).json({
            error: 'sizing_value for multiplier method must be between 0.01 and 2.0'
          });
        }
        break;
      case 'fixed_usd':
        if (value < 10) {
          return res.status(400).json({
            error: 'sizing_value for fixed_usd method must be at least $10'
          });
        }
        break;
      case 'balance_percent':
        if (value < 1 || value > 100) {
          return res.status(400).json({
            error: 'sizing_value for balance_percent method must be between 1 and 100'
          });
        }
        break;
    }

    // Validate max_position_cap if provided
    if (max_position_cap !== undefined && max_position_cap !== null) {
      const cap = parseFloat(max_position_cap);
      if (isNaN(cap) || cap <= 0) {
        return res.status(400).json({
          error: 'max_position_cap must be greater than 0'
        });
      }
    }

    // Validate API agent key format
    if (!isValidSolanaPrivateKey(api_key)) {
      return res.status(400).json({
        error: 'Invalid API agent key format. Must be a valid base58-encoded Solana private key (64 bytes).',
        details: 'Please ensure you copied the entire private key from Pacifica settings without extra spaces.'
      });
    }

    // Validate optional advanced controls
    if (custom_leverage !== undefined && custom_leverage !== null) {
      const leverage = parseInt(custom_leverage);
      if (isNaN(leverage) || leverage < 1 || leverage > 50) {
        return res.status(400).json({
          error: 'custom_leverage must be between 1 and 50'
        });
      }
    }

    if (max_total_exposure !== undefined && max_total_exposure !== null) {
      const exposure = parseFloat(max_total_exposure);
      if (isNaN(exposure) || exposure <= 0) {
        return res.status(400).json({
          error: 'max_total_exposure must be greater than 0'
        });
      }
    }

    if (symbol_multipliers !== undefined && symbol_multipliers !== null) {
      if (typeof symbol_multipliers !== 'object' || Array.isArray(symbol_multipliers)) {
        return res.status(400).json({
          error: 'symbol_multipliers must be an object with symbol keys and multiplier values'
        });
      }

      // Validate each multiplier value
      for (const [symbol, mult] of Object.entries(symbol_multipliers)) {
        const multiplierValue = parseFloat(mult as string);
        if (isNaN(multiplierValue) || multiplierValue < 0.01 || multiplierValue > 1.0) {
          return res.status(400).json({
            error: `Symbol multiplier for ${symbol} must be between 0.01 and 1.0`
          });
        }
      }
    }

    // Check if user is approved
    const trader = await Trader.findOne({ where: { wallet_address: user_wallet } });
    if (!trader || !trader.is_approved) {
      return res.status(403).json({
        error: 'User wallet must be approved first',
        message: 'Please request approval at /api/copy/request'
      });
    }

    // Encrypt API key
    const encrypted = encryptApiKey(api_key);

    // Create copy relationship
    const relationship = await CopyRelationship.create({
      user_wallet,
      encrypted_api_key: encrypted,
      master_wallet,
      sizing_method: method,
      sizing_value: value,
      max_position_cap: max_position_cap !== undefined && max_position_cap !== null ? parseFloat(max_position_cap) : null,
      symbols: symbols || [],
      is_active: true,
      custom_leverage: custom_leverage !== undefined && custom_leverage !== null ? parseInt(custom_leverage) : null,
      max_total_exposure: max_total_exposure !== undefined && max_total_exposure !== null ? parseFloat(max_total_exposure) : null,
      symbol_multipliers: symbol_multipliers || null
    });

    console.log(`[COPY] Created relationship: ${user_wallet} -> ${master_wallet} (${method}: ${value})`);

    // Update WebSocket subscriptions to include this new master
    await updateMasterSubscriptions();

    res.status(201).json({
      id: relationship.id,
      user_wallet: formatWallet(user_wallet),
      master_wallet: formatWallet(master_wallet),
      sizing_method: relationship.sizing_method,
      sizing_value: relationship.sizing_value,
      max_position_cap: relationship.max_position_cap,
      symbols: relationship.symbols,
      is_active: relationship.is_active,
      custom_leverage: relationship.custom_leverage,
      max_total_exposure: relationship.max_total_exposure,
      symbol_multipliers: relationship.symbol_multipliers,
      created_at: relationship.created_at
    });
  } catch (error: any) {
    console.error('[API] Copy create error:', error);
    res.status(500).json({ error: 'Failed to create copy relationship' });
  }
});

app.get('/api/copy/relationships/:user_wallet', async (req: Request, res: Response) => {
  try {
    const { user_wallet } = req.params;

    const relationships = await CopyRelationship.findAll({
      where: { user_wallet },
      order: [['created_at', 'DESC']]
    });

    const formatted = relationships.map(rel => ({
      id: rel.id,
      user_wallet: formatWallet(rel.user_wallet),
      master_wallet: formatWallet(rel.master_wallet),
      sizing_method: rel.sizing_method,
      sizing_value: rel.sizing_value,
      max_position_cap: rel.max_position_cap,
      symbols: rel.symbols,
      is_active: rel.is_active,
      custom_leverage: rel.custom_leverage,
      max_total_exposure: rel.max_total_exposure,
      symbol_multipliers: rel.symbol_multipliers,
      created_at: rel.created_at,
      updated_at: rel.updated_at
    }));

    res.json({
      count: formatted.length,
      relationships: formatted
    });
  } catch (error) {
    console.error('[API] Relationships fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch relationships' });
  }
});

app.patch('/api/copy/relationships/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { is_active, sizing_method, sizing_value, max_position_cap, symbols, custom_leverage, max_total_exposure, symbol_multipliers } = req.body;

    const relationship = await CopyRelationship.findByPk(id);

    if (!relationship) {
      return res.status(404).json({ error: 'Relationship not found' });
    }

    // Update fields if provided
    if (typeof is_active !== 'undefined') {
      relationship.is_active = is_active;
    }

    // Update sizing method and value
    if (sizing_method !== undefined) {
      const validMethods = ['multiplier', 'fixed_usd', 'balance_percent'];
      if (!validMethods.includes(sizing_method)) {
        return res.status(400).json({
          error: 'sizing_method must be one of: multiplier, fixed_usd, balance_percent'
        });
      }
      relationship.sizing_method = sizing_method;
    }

    if (sizing_value !== undefined) {
      const value = parseFloat(sizing_value);
      const method = relationship.sizing_method;

      // Validate based on method
      switch (method) {
        case 'multiplier':
          if (value < 0.01 || value > 2.0) {
            return res.status(400).json({
              error: 'sizing_value for multiplier method must be between 0.01 and 2.0'
            });
          }
          break;
        case 'fixed_usd':
          if (value < 10) {
            return res.status(400).json({
              error: 'sizing_value for fixed_usd method must be at least $10'
            });
          }
          break;
        case 'balance_percent':
          if (value < 1 || value > 100) {
            return res.status(400).json({
              error: 'sizing_value for balance_percent method must be between 1 and 100'
            });
          }
          break;
      }
      relationship.sizing_value = value;
    }

    if (max_position_cap !== undefined) {
      if (max_position_cap === null) {
        relationship.max_position_cap = null;
      } else {
        const cap = parseFloat(max_position_cap);
        if (isNaN(cap) || cap <= 0) {
          return res.status(400).json({
            error: 'max_position_cap must be greater than 0'
          });
        }
        relationship.max_position_cap = cap;
      }
    }

    if (symbols) {
      relationship.symbols = symbols;
    }

    // Update advanced controls
    if (custom_leverage !== undefined) {
      if (custom_leverage === null) {
        relationship.custom_leverage = null;
      } else {
        const leverage = parseInt(custom_leverage);
        if (isNaN(leverage) || leverage < 1 || leverage > 50) {
          return res.status(400).json({
            error: 'custom_leverage must be between 1 and 50'
          });
        }
        relationship.custom_leverage = leverage;
      }
    }

    if (max_total_exposure !== undefined) {
      if (max_total_exposure === null) {
        relationship.max_total_exposure = null;
      } else {
        const exposure = parseFloat(max_total_exposure);
        if (isNaN(exposure) || exposure <= 0) {
          return res.status(400).json({
            error: 'max_total_exposure must be greater than 0'
          });
        }
        relationship.max_total_exposure = exposure;
      }
    }

    if (symbol_multipliers !== undefined) {
      if (symbol_multipliers === null) {
        relationship.symbol_multipliers = null;
      } else {
        if (typeof symbol_multipliers !== 'object' || Array.isArray(symbol_multipliers)) {
          return res.status(400).json({
            error: 'symbol_multipliers must be an object with symbol keys and multiplier values'
          });
        }

        // Validate each multiplier value
        for (const [symbol, mult] of Object.entries(symbol_multipliers)) {
          const multiplierValue = parseFloat(mult as string);
          if (isNaN(multiplierValue) || multiplierValue < 0.01 || multiplierValue > 1.0) {
            return res.status(400).json({
              error: `Symbol multiplier for ${symbol} must be between 0.01 and 1.0`
            });
          }
        }
        relationship.symbol_multipliers = symbol_multipliers;
      }
    }

    await relationship.save();

    console.log(`[COPY] Updated relationship ${id}: active=${relationship.is_active}`);

    // Update WebSocket subscriptions (might need to unsubscribe if is_active changed to false)
    await updateMasterSubscriptions();

    res.json({
      id: relationship.id,
      user_wallet: formatWallet(relationship.user_wallet),
      master_wallet: formatWallet(relationship.master_wallet),
      sizing_method: relationship.sizing_method,
      sizing_value: relationship.sizing_value,
      max_position_cap: relationship.max_position_cap,
      symbols: relationship.symbols,
      is_active: relationship.is_active,
      custom_leverage: relationship.custom_leverage,
      max_total_exposure: relationship.max_total_exposure,
      symbol_multipliers: relationship.symbol_multipliers,
      updated_at: relationship.updated_at
    });
  } catch (error) {
    console.error('[API] Relationship update error:', error);
    res.status(500).json({ error: 'Failed to update relationship' });
  }
});

app.delete('/api/copy/relationships/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const relationship = await CopyRelationship.findByPk(id);

    if (!relationship) {
      return res.status(404).json({ error: 'Relationship not found' });
    }

    const userWallet = relationship.user_wallet;
    const masterWallet = relationship.master_wallet;

    await relationship.destroy();

    console.log(`[COPY] Deleted relationship ${id}: ${userWallet} -> ${masterWallet}`);

    // Update WebSocket subscriptions (might need to unsubscribe from this master)
    await updateMasterSubscriptions();

    res.json({
      message: 'Relationship deleted successfully',
      id: parseInt(id)
    });
  } catch (error) {
    console.error('[API] Relationship delete error:', error);
    res.status(500).json({ error: 'Failed to delete relationship' });
  }
});

// Positions endpoint
app.get('/api/positions/:wallet', async (req: Request, res: Response) => {
  try {
    const { wallet } = req.params;

    if (!wallet) {
      return res.status(400).json({ error: 'wallet address required' });
    }

    // Use the public REST client to fetch positions from Pacifica
    if (!publicRestClient) {
      return res.status(503).json({ error: 'Service unavailable' });
    }

    const positionsResponse = await publicRestClient.getPositions(wallet);

    if (!positionsResponse.success) {
      return res.status(500).json({
        error: 'Failed to fetch positions',
        details: positionsResponse.error
      });
    }

    res.json({
      wallet,
      positions: positionsResponse.data || [],
      count: positionsResponse.data?.length || 0
    });
  } catch (error: any) {
    console.error('[API] Positions fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
});

// Admin dashboard route
app.get('/admin', requireAdminAuth, (req: Request, res: Response) => {
  // Try dist/admin first (production), then fallback to src/admin (dev)
  const distPath = path.join(__dirname, 'admin', 'dashboard.html');
  const srcPath = path.join(process.cwd(), 'src', 'admin', 'dashboard.html');

  const fileToServe = fs.existsSync(distPath)
    ? distPath
    : (fs.existsSync(srcPath) ? srcPath : null);

  if (!fileToServe) {
    console.error('[Admin] dashboard.html not found in dist/admin or src/admin');
    return res.status(404).send('Admin dashboard not found');
  }

  res.sendFile(fileToServe);
});

// Admin endpoints
app.get('/admin/pending', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const pending = await Trader.findAll({
      where: { is_approved: false },
      order: [['requested_at', 'DESC']]
    });

    const formattedPending = pending.map(trader => ({
      id: trader.id,
      wallet: formatWallet(trader.wallet_address),
      requested_at: trader.requested_at,
      notes: trader.notes
    }));

    res.json(formattedPending);
  } catch (error) {
    console.error('[Admin] Failed to fetch pending:', error);
    res.status(500).json({ error: 'Failed to fetch pending requests' });
  }
});

app.get('/admin/approved', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const approved = await Trader.findAll({
      where: { is_approved: true },
      order: [['approved_at', 'DESC']]
    });

    const formattedApproved = approved.map(trader => ({
      id: trader.id,
      wallet: formatWallet(trader.wallet_address),
      requested_at: trader.requested_at,
      approved_at: trader.approved_at,
      notes: trader.notes
    }));

    res.json(formattedApproved);
  } catch (error) {
    console.error('[Admin] Failed to fetch approved:', error);
    res.status(500).json({ error: 'Failed to fetch approved wallets' });
  }
});

app.post('/admin/approve/:wallet', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { wallet } = req.params;
    const { notes } = req.body;

    const trader = await Trader.findOne({ where: { wallet_address: wallet } });

    if (!trader) {
      return res.status(404).json({ error: 'Trader not found' });
    }

    if (trader.is_approved) {
      return res.status(400).json({ error: 'Trader already approved' });
    }

    trader.is_approved = true;
    trader.approved_at = new Date();
    if (notes) {
      trader.notes = notes;
    }
    await trader.save();

    console.log(`[Admin] Approved wallet: ${formatWallet(wallet).first_4}...${formatWallet(wallet).last_4}`);

    res.json({
      message: 'Wallet approved',
      wallet: formatWallet(wallet),
      approved_at: trader.approved_at
    });
  } catch (error) {
    console.error('[Admin] Failed to approve:', error);
    res.status(500).json({ error: 'Failed to approve wallet' });
  }
});

app.post('/admin/deny/:wallet', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { wallet } = req.params;

    const trader = await Trader.findOne({ where: { wallet_address: wallet } });

    if (!trader) {
      return res.status(404).json({ error: 'Trader not found' });
    }

    await trader.destroy();

    console.log(`[Admin] Denied wallet: ${formatWallet(wallet).first_4}...${formatWallet(wallet).last_4}`);

    res.json({
      message: 'Wallet denied and removed',
      wallet: formatWallet(wallet)
    });
  } catch (error) {
    console.error('[Admin] Failed to deny:', error);
    res.status(500).json({ error: 'Failed to deny wallet' });
  }
});

// Initialize clients
let wsClient: PacificaWebSocketClient | null = null;
let restClient: PacificaRestClient | null = null; // authenticated client (for trading)
let publicRestClient: PacificaRestClient | null = null; // public client (no auth)
const activeSubscriptions = new Set<string>(); // master wallets we're subscribed to

// Cache market info
const marketInfoCache = new Map<string, any>();

async function getMarketInfo(symbol: string): Promise<any> {
  if (marketInfoCache.has(symbol)) {
    return marketInfoCache.get(symbol);
  }

  try {
    const url = `${process.env.PACIFICA_API_URL}/info`;
    console.log(`[REPLICATION] Fetching market info from: ${url}`);

    const response = await fetch(url);

    if (!response.ok) {
      console.error(`[REPLICATION] Market info API returned ${response.status}`);
      return null;
    }

  const result: any = await response.json();
    const markets = result?.data ?? result; // UNWRAP HERE

    if (!Array.isArray(markets)) {
      console.error(`[REPLICATION] Expected array, got:`, typeof markets);
      return null;
    }
    console.log(`[REPLICATION] Fetched ${markets.length} markets`);

    const market = markets.find((m: any) => m.symbol === symbol);

    if (market) {
      marketInfoCache.set(symbol, market);
      console.log(`[REPLICATION] Lot size for ${symbol}: ${market.lot_size}`);
      return market;
    }
  } catch (error: any) {
    console.error(`[REPLICATION] Failed to fetch market info:`, error.message);
  }

  return null;
}

// Helper function to get lot size for a symbol
function getLotSize(symbol: string): number {
  switch (symbol.toUpperCase()) {
    case 'SOL':
      return 0.01; // SOL trades in hundredths
    case 'BTC':
      return 0.00001; // 1e-5 BTC
    default:
      return 0.00001; // sensible default for most assets
  }
}

// Helper function to convert trade side
function getSide(tradeSide: string): 'bid' | 'ask' {
  if (tradeSide === 'open_long' || tradeSide === 'close_short') {
    return 'bid'; // Buy
  } else if (tradeSide === 'close_long' || tradeSide === 'open_short') {
    return 'ask'; // Sell
  }
  throw new Error(`Unknown trade side: ${tradeSide}`);
}

// Replicate trade to a single user
async function replicateToUser(relationship: CopyRelationship, trade: any) {
  try {
    // Check symbol filter
    if (relationship.symbols.length > 0 && !relationship.symbols.includes(trade.symbol)) {
      console.log(`[REPLICATION] ${relationship.user_wallet.substring(0, 4)}...: Skipped ${trade.symbol} (not in filter)`);
      return;
    }

    // Decrypt API key with error handling
    let apiKey: string;
    try {
      apiKey = decryptApiKey(relationship.encrypted_api_key);
    } catch (error: any) {
      console.error(`[REPLICATION] Invalid/corrupted API key for ${relationship.user_wallet.substring(0, 4)}...`);
      console.error(`[REPLICATION] Error details: ${error.message}`);
      // Optionally: mark relationship as invalid in DB
      // await relationship.update({ is_active: false });
      return;
    }

    // Create user-specific REST client
    const apiUrl = process.env.PACIFICA_API_URL;
    if (!apiUrl) {
      console.error('[REPLICATION] API URL not configured');
      return;
    }

    const userRestClient = new PacificaRestClient(apiUrl, relationship.user_wallet, apiKey);

  // Calculate copier amount based on sizing method
  const symbol = String(trade.symbol).toUpperCase();
  const masterAmount = parseFloat(trade.amount);
  const masterPrice = parseFloat(trade.price);
  const masterPositionValue = masterAmount * masterPrice;

  let copierAmount: number;

  // Calculate base amount based on sizing method
  switch (relationship.sizing_method) {
    case 'multiplier':
      // Option A: Copy as fraction of master's size
      copierAmount = masterAmount * relationship.sizing_value;
      break;

    case 'fixed_usd':
      // Option B: Fixed USD amount per trade
      copierAmount = relationship.sizing_value / masterPrice;
      break;

    case 'balance_percent':
      // Option C: Percentage of available balance
      // Need to get balance first for this method
      const accountInfo = await userRestClient.getAccountInfo(relationship.user_wallet);
      if (!accountInfo.success) {
        console.error(`[REPLICATION] ${relationship.user_wallet.substring(0, 4)}...: Failed to get balance for balance_percent sizing`);
        return;
      }
      const available = parseFloat(accountInfo.data.available_to_spend);
      const targetValue = (available * relationship.sizing_value) / 100;
      copierAmount = targetValue / masterPrice;
      break;

    default:
      console.error(`[REPLICATION] Unknown sizing method: ${relationship.sizing_method}`);
      return;
  }

  // Apply symbol-specific multiplier on top of base sizing (if set)
  if (relationship.symbol_multipliers?.[symbol]) {
    copierAmount *= relationship.symbol_multipliers[symbol];
  }

  // Apply optional position cap (works for all methods)
  if (relationship.max_position_cap) {
    const cappedAmount = relationship.max_position_cap / masterPrice;
    copierAmount = Math.min(copierAmount, cappedAmount);
  }

  // Get lot size from API
  const marketInfo = await getMarketInfo(symbol);
  const lotSize = marketInfo ? parseFloat(marketInfo.lot_size) : 0.00001;
  const decimals = Math.max(0, (lotSize.toString().split('.')[1] || '').length);

  // Round down to nearest lot size
  copierAmount = Math.floor(copierAmount / lotSize) * lotSize;

    if (copierAmount <= 0) {
      console.log(`[REPLICATION] ${relationship.user_wallet.substring(0, 4)}...: Amount below minimum lot size`);
      return;
    }

    // Get balance (only if not already fetched for balance_percent method)
    let available: number;
    if (relationship.sizing_method === 'balance_percent') {
      // Already have accountInfo from balance_percent calculation above
      // Re-fetch to ensure we have the reference
      const accountInfo = await userRestClient.getAccountInfo(relationship.user_wallet);
      if (!accountInfo.success) {
        console.error(`[REPLICATION] ${relationship.user_wallet.substring(0, 4)}...: Failed to get balance`);
        return;
      }
      available = parseFloat(accountInfo.data.available_to_spend);
    } else {
      // Fetch balance for other methods
      const accountInfo = await userRestClient.getAccountInfo(relationship.user_wallet);
      if (!accountInfo.success) {
        console.error(`[REPLICATION] ${relationship.user_wallet.substring(0, 4)}...: Failed to get balance`);
        return;
      }
      available = parseFloat(accountInfo.data.available_to_spend);
    }

    // Apply custom leverage limit if configured
    if (relationship.custom_leverage) {
      const maxSize = (available * relationship.custom_leverage) / parseFloat(trade.price);
      const previousAmount = copierAmount;
      copierAmount = Math.min(copierAmount, maxSize);

      // Round down again after leverage limit
      copierAmount = Math.floor(copierAmount / lotSize) * lotSize;

      if (copierAmount < previousAmount) {
        console.log(`[REPLICATION] ${relationship.user_wallet.substring(0, 4)}...: Applied ${relationship.custom_leverage}x leverage limit (${previousAmount.toFixed(decimals)} → ${copierAmount.toFixed(decimals)})`);
      }

      if (copierAmount <= 0) {
        console.log(`[REPLICATION] ${relationship.user_wallet.substring(0, 4)}...: Amount below minimum after leverage limit`);
        return;
      }
    }

    const formattedAmount = copierAmount.toFixed(decimals).replace(/\.?0+$/, '');

    // Check balance (already fetched above)
    const cost = copierAmount * parseFloat(trade.price);

    if (available < cost) {
      console.log(`[REPLICATION] ${relationship.user_wallet.substring(0, 4)}...: Insufficient balance (need ${cost.toFixed(2)}, have ${available.toFixed(2)})`);
      return;
    }

    // Check max total exposure limit if configured
    if (relationship.max_total_exposure) {
      if (!publicRestClient) {
        console.error('[REPLICATION] Public REST client not available for exposure check');
        return;
      }

      const positionsResponse = await publicRestClient.getPositions(relationship.user_wallet);

      if (positionsResponse.success && positionsResponse.data) {
        const positions = positionsResponse.data.positions || [];

        // Calculate total current exposure
        const totalExposure = positions.reduce((sum: number, p: any) => {
          const amount = parseFloat(p.amount || p.size || '0');
          const price = parseFloat(p.entry_price || p.entryPrice || p.mark_price || p.markPrice || p.price || '0');
          return sum + (amount * price);
        }, 0);

        const newExposure = copierAmount * parseFloat(trade.price);
        const totalAfterTrade = totalExposure + newExposure;

        if (totalAfterTrade > relationship.max_total_exposure) {
          console.log(`[REPLICATION] ${relationship.user_wallet.substring(0, 4)}...: Skipped: max exposure limit (${totalExposure.toFixed(2)} + ${newExposure.toFixed(2)} = ${totalAfterTrade.toFixed(2)} > ${relationship.max_total_exposure})`);
          return;
        }
      }
    }

    // Execute order
    const side = getSide(trade.side);
    const reduceOnly = trade.side.includes('close');

    const orderResponse = await userRestClient.createMarketOrder({
      symbol: trade.symbol,
      amount: formattedAmount,
      side,
      slippage_percent: '0.5',
      reduce_only: reduceOnly
    });

    if (orderResponse.success) {
      console.log(`[REPLICATION] ✅ ${relationship.user_wallet.substring(0, 4)}...: ${trade.symbol} ${trade.side} ${formattedAmount} @ ${trade.price}`);
    } else {
      console.error(`[REPLICATION] ❌ ${relationship.user_wallet.substring(0, 4)}...: ${orderResponse.error || 'Unknown error'}`);
    }
  } catch (error: any) {
    console.error(`[REPLICATION] Error for ${relationship.user_wallet.substring(0, 4)}...: ${error.message}`);
  }
}

// Multi-user trade replication logic
async function replicateTrade(masterWallet: string, trade: any) {
  try {
    // Log master trade
    console.log(`\n[REPLICATION] Master ${masterWallet.substring(0, 4)}...: ${trade.symbol} ${trade.side} ${trade.amount} @ ${trade.price}`);

    // Prime market info cache for this symbol
    await getMarketInfo(String(trade.symbol).toUpperCase());

    // Find ALL active copy relationships for this master trader
    const relationships = await CopyRelationship.findAll({
      where: {
        master_wallet: masterWallet,
        is_active: true
      }
    });

    if (relationships.length === 0) {
      console.log('[REPLICATION] No active copiers for this master');
      return;
    }

    console.log(`[REPLICATION] Replicating to ${relationships.length} copier(s)`);

    // Replicate to each copier in parallel
    await Promise.all(
      relationships.map(rel => replicateToUser(rel, trade))
    );

    console.log('[REPLICATION] Replication complete\n');
  } catch (error: any) {
    console.error('[REPLICATION] Error:', error.message);
  }
}

// Update WebSocket subscriptions based on active copy relationships
async function updateMasterSubscriptions() {
  try {
    if (!wsClient || !wsClient.isConnected()) {
      console.log('[WebSocket] Not connected, skipping subscription update');
      return;
    }

    // Get all unique active master wallets
    const relationships = await CopyRelationship.findAll({
      where: { is_active: true },
      attributes: ['master_wallet']
    });

    const activeMasters = new Set(relationships.map(r => r.master_wallet));

    // Subscribe to new masters
    for (const master of activeMasters) {
      if (!activeSubscriptions.has(master)) {
        console.log(`[WebSocket] Subscribing to new master: ${master.substring(0, 4)}...${master.substring(master.length - 4)}`);
        wsClient.subscribeToAccount('account_trades', master);
        activeSubscriptions.add(master);
      }
    }

    // Unsubscribe from masters no one is following anymore
    for (const master of activeSubscriptions) {
      if (!activeMasters.has(master)) {
        console.log(`[WebSocket] Unsubscribing from inactive master: ${master.substring(0, 4)}...${master.substring(master.length - 4)}`);
        wsClient.unsubscribeFromAccount('account_trades', master);
        activeSubscriptions.delete(master);
      }
    }

    console.log(`[WebSocket] Active master subscriptions: ${activeSubscriptions.size}`);
  } catch (error) {
    console.error('[WebSocket] Failed to update subscriptions:', error);
  }
}

async function initializeClients() {
  const wsUrl = process.env.PACIFICA_WS_URL;
  const apiUrl = process.env.PACIFICA_API_URL;
  const copierWallet = process.env.COPIER_WALLET;
  const copierPrivateKey = process.env.COPIER_PRIVATE_KEY;

  // Always create public client (no credentials needed)
  if (apiUrl) {
    publicRestClient = new PacificaRestClient(apiUrl);
    console.log('[Server] Public REST client initialized');
  }

  // Only create authenticated client if credentials exist
  if (apiUrl && copierWallet && copierPrivateKey) {
    restClient = new PacificaRestClient(apiUrl, copierWallet, copierPrivateKey);
    console.log('[Server] Authenticated REST client initialized');
  } else {
    console.warn('[Server] Copier credentials not provided. Trading operations disabled.');
  }

  // Initialize WebSocket client (no longer requires MASTER_WALLET)
  if (!wsUrl) {
    console.warn('[Server] WebSocket URL not provided. Trade monitoring disabled.');
    return;
  }

  // Initialize WebSocket client without a specific wallet (multi-master support)
  wsClient = new PacificaWebSocketClient(wsUrl);

  wsClient.on('connected', async () => {
    console.log('[Server] WebSocket connected');
    // Subscribe to all active masters
    await updateMasterSubscriptions();
  });

  wsClient.on('trade', (trade) => {
    console.log('[Server] Trade event:', trade);
    // Trigger trade replication using the trader from the trade event
    replicateTrade(trade.trader, trade);
  });

  wsClient.on('error', (error) => {
    console.error('[Server] WebSocket error:', error);
  });

  wsClient.on('disconnected', () => {
    console.log('[Server] WebSocket disconnected');
  });

  wsClient.connect();
}

// Start server
async function startServer() {
  try {
    // Connect to database
    await connectDatabase();
    await syncDatabase();

    // Initialize Pacifica clients
    await initializeClients();

    // Start strategy executor
    strategyExecutor.start();
    console.log('[Server] Strategy executor started');

    // Periodic subscription refresh (every 60 seconds)
    setInterval(async () => {
      await updateMasterSubscriptions();
    }, 60000);
    console.log('[Server] Periodic subscription refresh enabled (60s interval)');

    // Start Express server
    app.listen(PORT, () => {
      console.log(`[Server] Running on port ${PORT}`);
    });
  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('[Server] Shutting down...');
  if (wsClient) {
    wsClient.disconnect();
  }
  strategyExecutor.stop();
  process.exit(0);
});

startServer();
