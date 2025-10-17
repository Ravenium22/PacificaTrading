const RAW_API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
// Ensure absolute URL (prefix https:// if user provides host only) and remove trailing slash
const API_URL = (RAW_API.startsWith('http://') || RAW_API.startsWith('https://')
  ? RAW_API
  : `https://${RAW_API}`
).replace(/\/$/, '');

export interface ApprovalStatus {
  approved: boolean;
  requestDate?: string;
  approvalDate?: string;
}

export interface CopyRelationship {
  id: string;
  followerWallet: string;
  masterWallet: string;
  apiKey: string;
  sizingMethod: 'multiplier' | 'fixed_usd' | 'balance_percent';
  sizingValue: number;
  maxPositionCap?: number | null;
  symbolFilter?: string[];
  active: boolean;
  customLeverage?: number | null;
  maxTotalExposure?: number | null;
  symbolMultipliers?: Record<string, number> | null;
  createdAt: string;
  updatedAt: string;
}

export interface Position {
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  markPrice: number;
  liquidationPrice: number;
  unrealizedPnl: number;
  leverage: number;
}

export type StrategyType = 'twap' | 'dca' | 'grid' | 'trailing_stop';

export interface TWAPConfig {
  duration_minutes: number;
  interval_minutes: number;
}

export interface DCAConfig {
  buy_amount: number;
  frequency_hours: number;
}

export interface GridConfig {
  lower_price: number;
  upper_price: number;
  grid_levels: number;
  amount_per_grid: number;
}

export interface TrailingStopConfig {
  trigger_price: number;
  trail_percent: number;
}

export type StrategyConfig = TWAPConfig | DCAConfig | GridConfig | TrailingStopConfig;

export interface Strategy {
  id: string;
  userWallet: string;
  strategyType: StrategyType;
  symbol: string;
  isActive: boolean;
  totalAmount: number;
  executedAmount: number;
  config: StrategyConfig;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  lastExecution?: string;
  errorCount: number;
  lastError?: string;
  progress: number;
  remaining: number;
}

export interface Execution {
  id: string;
  executedAt: string;
  side: 'buy' | 'sell';
  size: number;
  price: number;
  amount: number;
  status: 'pending' | 'filled' | 'failed';
  error?: string;
}

// Check if wallet is approved for copy trading
export async function checkApproval(walletAddress: string): Promise<ApprovalStatus> {
  const response = await fetch(`${API_URL}/api/copy/status/${walletAddress}`);

  // Treat 404 as not approved/no request yet
  if (response.status === 404) {
    return { approved: false };
  }

  if (!response.ok) {
    // Try to surface backend error details when available
    try {
      const err = await response.json();
      throw new Error(err.error || err.message || 'Failed to check approval status');
    } catch {
      throw new Error('Failed to check approval status');
    }
  }

  const data = await response.json();
  // Backend returns: { status: 'approved'|'pending'|'not_found', requested_at, approved_at }
  return {
    approved: data.status === 'approved',
    requestDate: data.requested_at,
    approvalDate: data.approved_at,
  };
}

// Request approval for copy trading
export async function requestApproval(walletAddress: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_URL}/api/copy/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    // Backend expects snake_case: wallet_address
    body: JSON.stringify({ wallet_address: walletAddress }),
  });
  if (!response.ok) {
    try {
      const error = await response.json();
      throw new Error(error.error || error.message || 'Failed to request approval');
    } catch {
      throw new Error('Failed to request approval');
    }
  }
  const data = await response.json();
  return { success: true, message: data.message || 'Approval request submitted' };
}

// Signed approval request (recommended/required in production)
export async function requestApprovalSigned(walletAddress: string, signatureB58: string, timestamp: number): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_URL}/api/copy/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      wallet_address: walletAddress,
      signature: signatureB58,
      timestamp,
    }),
  });
  if (!response.ok) {
    try {
      const error = await response.json();
      throw new Error(error.error || error.message || 'Failed to request approval');
    } catch {
      throw new Error('Failed to request approval');
    }
  }
  const data = await response.json();
  return { success: true, message: data.message || 'Approval request submitted' };
}

// Create a new copy trading relationship
export async function createRelationship(data: {
  followerWallet: string;
  masterWallet: string;
  apiKey: string;
  sizingMethod: 'multiplier' | 'fixed_usd' | 'balance_percent';
  sizingValue: number;
  maxPositionCap?: number | null;
  symbolFilter?: string[];
  customLeverage?: number | null;
  maxTotalExposure?: number | null;
  symbolMultipliers?: Record<string, number> | null;
}): Promise<CopyRelationship> {
  const response = await fetch(`${API_URL}/api/copy/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    // Map to backend fields
    body: JSON.stringify({
      user_wallet: data.followerWallet,
      api_key: data.apiKey,
      master_wallet: data.masterWallet,
      sizing_method: data.sizingMethod,
      sizing_value: data.sizingValue,
      max_position_cap: data.maxPositionCap,
      symbols: data.symbolFilter || [],
      custom_leverage: data.customLeverage,
      max_total_exposure: data.maxTotalExposure,
      symbol_multipliers: data.symbolMultipliers,
    }),
  });
  if (!response.ok) {
    try {
      const error = await response.json();
      // Combine error and details if available for better user feedback
      const errorMessage = error.error || error.message || 'Failed to create relationship';
      const errorDetails = error.details ? ` ${error.details}` : '';
      throw new Error(errorMessage + errorDetails);
    } catch (parseError) {
      // If JSON parsing fails, throw a generic error
      if (parseError instanceof Error && parseError.message) {
        throw parseError;
      }
      throw new Error('Failed to create relationship');
    }
  }
  const res = await response.json();
  // Backend returns formatted wallets and snake_case fields
  return {
    id: String(res.id),
    followerWallet: typeof res.user_wallet === 'object' ? res.user_wallet.full : res.user_wallet,
    masterWallet: typeof res.master_wallet === 'object' ? res.master_wallet.full : res.master_wallet,
    apiKey: '', // never return API key to client
    sizingMethod: res.sizing_method || 'multiplier',
    sizingValue: parseFloat(String(res.sizing_value ?? '0.5')),
    maxPositionCap: res.max_position_cap,
    symbolFilter: res.symbols || [],
    active: res.is_active,
    customLeverage: res.custom_leverage,
    maxTotalExposure: res.max_total_exposure,
    symbolMultipliers: res.symbol_multipliers,
    createdAt: res.created_at,
    updatedAt: res.updated_at || res.created_at,
  };
}

// Get all relationships for a follower wallet
export async function getRelationships(walletAddress: string): Promise<CopyRelationship[]> {
  const response = await fetch(`${API_URL}/api/copy/relationships/${walletAddress}`);
  if (!response.ok) {
    try {
      const err = await response.json();
      throw new Error(err.error || 'Failed to fetch relationships');
    } catch {
      throw new Error('Failed to fetch relationships');
    }
  }
  const data = await response.json();
  const list = (Array.isArray(data.relationships) ? data.relationships : []) as Array<{
    id: string | number;
    user_wallet: string | { full: string };
    master_wallet: string | { full: string };
    sizing_method: 'multiplier' | 'fixed_usd' | 'balance_percent';
    sizing_value: number | string;
    max_position_cap?: number | null;
    symbols?: string[];
    is_active: boolean;
    custom_leverage?: number | null;
    max_total_exposure?: number | null;
    symbol_multipliers?: Record<string, number> | null;
    created_at: string;
    updated_at?: string;
  }>;
  return list.map((rel) => ({
    id: String(rel.id),
    followerWallet: typeof rel.user_wallet === 'object' ? rel.user_wallet.full : rel.user_wallet,
    masterWallet: typeof rel.master_wallet === 'object' ? rel.master_wallet.full : rel.master_wallet,
    apiKey: '',
    sizingMethod: rel.sizing_method || 'multiplier',
    sizingValue: parseFloat(String(rel.sizing_value ?? '0.5')),
    maxPositionCap: rel.max_position_cap,
    symbolFilter: rel.symbols || [],
    active: rel.is_active,
    customLeverage: rel.custom_leverage,
    maxTotalExposure: rel.max_total_exposure,
    symbolMultipliers: rel.symbol_multipliers,
    createdAt: rel.created_at || rel.created_at,
    updatedAt: rel.updated_at || rel.created_at,
  }));
}

// Update a relationship (e.g., toggle active status, change sizing)
export async function updateRelationship(
  id: string,
  updates: Partial<Pick<CopyRelationship, 'active' | 'sizingMethod' | 'sizingValue' | 'maxPositionCap' | 'symbolFilter' | 'customLeverage' | 'maxTotalExposure' | 'symbolMultipliers'>>
): Promise<CopyRelationship> {
  const response = await fetch(`${API_URL}/api/copy/relationships/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    // Map to backend fields
    body: JSON.stringify({
      ...(typeof updates.active !== 'undefined' ? { is_active: updates.active } : {}),
      ...(typeof updates.sizingMethod !== 'undefined' ? { sizing_method: updates.sizingMethod } : {}),
      ...(typeof updates.sizingValue !== 'undefined' ? { sizing_value: updates.sizingValue } : {}),
      ...(typeof updates.maxPositionCap !== 'undefined' ? { max_position_cap: updates.maxPositionCap } : {}),
      ...(typeof updates.symbolFilter !== 'undefined' ? { symbols: updates.symbolFilter } : {}),
      ...(typeof updates.customLeverage !== 'undefined' ? { custom_leverage: updates.customLeverage } : {}),
      ...(typeof updates.maxTotalExposure !== 'undefined' ? { max_total_exposure: updates.maxTotalExposure } : {}),
      ...(typeof updates.symbolMultipliers !== 'undefined' ? { symbol_multipliers: updates.symbolMultipliers } : {}),
    }),
  });
  if (!response.ok) {
    try {
      const error = await response.json();
      throw new Error(error.error || error.message || 'Failed to update relationship');
    } catch {
      throw new Error('Failed to update relationship');
    }
  }
  const res = await response.json();
  return {
    id: String(res.id),
    followerWallet: typeof res.user_wallet === 'object' ? res.user_wallet.full : res.user_wallet,
    masterWallet: typeof res.master_wallet === 'object' ? res.master_wallet.full : res.master_wallet,
    apiKey: '',
    sizingMethod: res.sizing_method || 'multiplier',
    sizingValue: parseFloat(String(res.sizing_value ?? '0.5')),
    maxPositionCap: res.max_position_cap,
    symbolFilter: res.symbols || [],
    active: res.is_active,
    customLeverage: res.custom_leverage,
    maxTotalExposure: res.max_total_exposure,
    symbolMultipliers: res.symbol_multipliers,
    createdAt: res.created_at || res.updated_at,
    updatedAt: res.updated_at,
  };
}

// Delete a relationship
export async function deleteRelationship(id: string): Promise<{ success: boolean }> {
  const response = await fetch(`${API_URL}/api/copy/relationships/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    try {
      const error = await response.json();
      throw new Error(error.error || error.message || 'Failed to delete relationship');
    } catch {
      throw new Error('Failed to delete relationship');
    }
  }
  await response.json().catch(() => ({}));
  return { success: true };
}

// Get positions for a wallet
export async function getPositions(walletAddress: string): Promise<Position[]> {
  const response = await fetch(`${API_URL}/api/positions/${walletAddress}`);
  if (!response.ok) {
    try {
      const err = await response.json();
      throw new Error(err.error || 'Failed to fetch positions');
    } catch {
      throw new Error('Failed to fetch positions');
    }
  }
  const data = await response.json();
  const list = (Array.isArray(data.positions) ? data.positions : []) as Array<{
    symbol: string;
    side: string;
    amount?: string | number;
    size?: string | number;
    entry_price?: string | number;
    entryPrice?: string | number;
    mark_price?: string | number;
    markPrice?: string | number;
    price?: string | number;
    liquidation_price?: string | number;
    liquidationPrice?: string | number;
    unrealized_pnl?: string | number;
    unrealizedPnl?: string | number;
    leverage?: string | number;
  }>;
  // Map backend fields to UI Position interface; use safe defaults if fields missing
  return list.map((p) => ({
    symbol: p.symbol,
    side: String(p.side).toLowerCase().includes('long') ? 'long' : 'short',
    size: parseFloat(String(p.amount ?? p.size ?? '0')),
    entryPrice: parseFloat(String(p.entry_price ?? p.entryPrice ?? '0')),
    markPrice: parseFloat(String(p.mark_price ?? p.markPrice ?? p.price ?? '0')),
    liquidationPrice: parseFloat(String(p.liquidation_price ?? p.liquidationPrice ?? '0')),
    unrealizedPnl: parseFloat(String(p.unrealized_pnl ?? p.unrealizedPnl ?? '0')),
    leverage: parseFloat(String(p.leverage ?? '1')),
  }));
}

// Create a new strategy
export async function createStrategy(data: {
  userWallet: string;
  strategyType: StrategyType;
  symbol: string;
  totalAmount: number;
  config: StrategyConfig;
  apiKey: string;
}): Promise<Strategy> {
  const response = await fetch(`${API_URL}/api/strategies/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_wallet: data.userWallet,
      strategy_type: data.strategyType,
      symbol: data.symbol,
      total_amount: data.totalAmount,
      config: data.config,
      api_key: data.apiKey,
    }),
  });

  if (!response.ok) {
    try {
      const error = await response.json();
      throw new Error(error.error || error.details || 'Failed to create strategy');
    } catch (parseError) {
      if (parseError instanceof Error && parseError.message) {
        throw parseError;
      }
      throw new Error('Failed to create strategy');
    }
  }

  const res = await response.json();
  return {
    id: String(res.id),
    userWallet: res.user_wallet,
    strategyType: res.strategy_type,
    symbol: res.symbol,
    isActive: res.is_active,
    totalAmount: parseFloat(res.total_amount),
    executedAmount: parseFloat(res.executed_amount),
    config: res.config,
    createdAt: res.created_at,
    updatedAt: res.updated_at || res.created_at,
    completedAt: res.completed_at,
    lastExecution: res.last_execution,
    errorCount: res.error_count || 0,
    lastError: res.last_error,
    progress: res.progress || 0,
    remaining: res.remaining || res.total_amount,
  };
}

// Get all strategies for a wallet
export async function getStrategies(walletAddress: string): Promise<Strategy[]> {
  const response = await fetch(`${API_URL}/api/strategies/${walletAddress}`);
  if (!response.ok) {
    try {
      const err = await response.json();
      throw new Error(err.error || 'Failed to fetch strategies');
    } catch {
      throw new Error('Failed to fetch strategies');
    }
  }

  const data = await response.json();
  const list = Array.isArray(data.strategies) ? data.strategies : [];

  interface BackendStrategy {
    id: string | number;
    user_wallet: string;
    strategy_type: StrategyType;
    symbol: string;
    is_active: boolean;
    total_amount: number | string;
    executed_amount: number | string;
    config: StrategyConfig;
    created_at: string;
    updated_at: string;
    completed_at?: string;
    last_execution?: string;
    error_count?: number;
    last_error?: string;
    progress?: number;
    remaining?: number | string;
  }

  return list.map((s: BackendStrategy) => ({
    id: String(s.id),
    userWallet: s.user_wallet,
    strategyType: s.strategy_type,
    symbol: s.symbol,
    isActive: s.is_active,
    totalAmount: parseFloat(String(s.total_amount)),
    executedAmount: parseFloat(String(s.executed_amount)),
    config: s.config,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
    completedAt: s.completed_at,
    lastExecution: s.last_execution,
    errorCount: s.error_count || 0,
    lastError: s.last_error,
    progress: s.progress || 0,
    remaining: typeof s.remaining === 'number' ? s.remaining : parseFloat(String(s.remaining || s.total_amount)),
  }));
}

// Update strategy (pause/resume)
export async function updateStrategy(
  id: string,
  updates: { isActive: boolean }
): Promise<Strategy> {
  const response = await fetch(`${API_URL}/api/strategies/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      is_active: updates.isActive,
    }),
  });

  if (!response.ok) {
    try {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update strategy');
    } catch {
      throw new Error('Failed to update strategy');
    }
  }

  const res = await response.json();
  return {
    id: String(res.id),
    userWallet: '',
    strategyType: 'twap',
    symbol: '',
    isActive: res.is_active,
    totalAmount: 0,
    executedAmount: 0,
    config: { duration_minutes: 0, interval_minutes: 0 } as TWAPConfig,
    createdAt: '',
    updatedAt: res.updated_at,
    errorCount: 0,
    progress: 0,
    remaining: 0,
  };
}

// Delete strategy
export async function deleteStrategy(id: string): Promise<{ success: boolean }> {
  const response = await fetch(`${API_URL}/api/strategies/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    try {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete strategy');
    } catch {
      throw new Error('Failed to delete strategy');
    }
  }

  return { success: true };
}

// Get strategy performance
export async function getStrategyPerformance(id: string): Promise<{
  strategy: Strategy;
  performance: {
    total_executions: number;
    filled_executions: number;
    failed_executions: number;
    success_rate: number;
    avg_entry_price: number;
    total_spent: number;
  };
  executions: Execution[];
}> {
  const response = await fetch(`${API_URL}/api/strategies/${id}/performance`);

  if (!response.ok) {
    try {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch strategy performance');
    } catch {
      throw new Error('Failed to fetch strategy performance');
    }
  }

  const data = await response.json();

  return {
    strategy: {
      id: String(data.strategy.id),
      userWallet: data.strategy.user_wallet || '',
      strategyType: data.strategy.strategy_type,
      symbol: data.strategy.symbol,
      isActive: data.strategy.is_active,
      totalAmount: parseFloat(data.strategy.total_amount),
      executedAmount: parseFloat(data.strategy.executed_amount),
      config: data.strategy.config || {},
      createdAt: data.strategy.created_at,
      updatedAt: data.strategy.updated_at || '',
      completedAt: data.strategy.completed_at,
      lastExecution: data.strategy.last_execution,
      errorCount: data.strategy.error_count || 0,
      lastError: data.strategy.last_error,
      progress: data.strategy.progress || 0,
      remaining: data.strategy.remaining || 0,
    },
    performance: data.performance,
    executions: data.executions.map((e: {
      id: string | number;
      executed_at: string;
      side: 'buy' | 'sell';
      size: number | string;
      price: number | string;
      amount: number | string;
      status: 'pending' | 'filled' | 'failed';
      error?: string;
    }) => ({
      id: String(e.id),
      executedAt: e.executed_at,
      side: e.side,
      size: parseFloat(String(e.size)),
      price: parseFloat(String(e.price)),
      amount: parseFloat(String(e.amount)),
      status: e.status,
      error: e.error,
    })),
  };
}
