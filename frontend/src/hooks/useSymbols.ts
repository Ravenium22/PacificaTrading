'use client';

import { useState, useEffect } from 'react';

interface SymbolInfo {
  symbol: string;
  base_currency: string;
  quote_currency: string;
  min_order_size: number;
  max_order_size: number;
  price_precision: number;
  size_precision: number;
}

interface UseSymbolsResult {
  symbols: string[];
  symbolsInfo: SymbolInfo[];
  loading: boolean;
  error: string | null;
}

// Use Next.js rewrite proxy to avoid CORS and keep base configurable
// See frontend/next.config.ts rewrites for /pacifica -> PACIFICA_API_URL
const PACIFICA_PROXY_BASE = '/pacifica';

export function useSymbols(): UseSymbolsResult {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [symbolsInfo, setSymbolsInfo] = useState<SymbolInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSymbols() {
      try {
        setLoading(true);
        setError(null);

        // Match backend pattern: just /info endpoint via the proxy
        const response = await fetch(`${PACIFICA_PROXY_BASE}/info`, {
          // Avoid caching stale market info during development
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch symbols from Pacifica');
        }

        const result = await response.json();

        // Unwrap data if needed (matches backend pattern in src/index.ts line 705)
        const markets = result?.data ?? result;

        // Check if markets is an array
        if (Array.isArray(markets)) {
          setSymbolsInfo(markets);
          setSymbols(markets.map((m: SymbolInfo) => m.symbol));
          console.log(`[useSymbols] Fetched ${markets.length} symbols from Pacifica`);
        } else {
          console.warn('[useSymbols] API response is not an array, using fallback');
          // Fallback to popular symbols if API structure is different
          const fallbackSymbols = [
            'BTC-USD', 'ETH-USD', 'SOL-USD', 'BNB-USD', 'XRP-USD',
            'ADA-USD', 'DOGE-USD', 'MATIC-USD', 'DOT-USD', 'AVAX-USD',
            'LINK-USD', 'UNI-USD', 'ATOM-USD', 'LTC-USD', 'BCH-USD',
            'NEAR-USD', 'APT-USD', 'ARB-USD', 'OP-USD', 'SUI-USD'
          ];
          setSymbols(fallbackSymbols);
        }
      } catch (err) {
        console.error('[useSymbols] Error fetching symbols:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch symbols');

        // Use fallback symbols on error
        const fallbackSymbols = [
          'BTC-USD', 'ETH-USD', 'SOL-USD', 'BNB-USD', 'XRP-USD',
          'ADA-USD', 'DOGE-USD', 'MATIC-USD', 'DOT-USD', 'AVAX-USD',
          'LINK-USD', 'UNI-USD', 'ATOM-USD', 'LTC-USD', 'BCH-USD',
          'NEAR-USD', 'APT-USD', 'ARB-USD', 'OP-USD', 'SUI-USD'
        ];
        setSymbols(fallbackSymbols);
      } finally {
        setLoading(false);
      }
    }

    fetchSymbols();
  }, []);

  return { symbols, symbolsInfo, loading, error };
}
