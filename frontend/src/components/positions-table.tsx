'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { getPositions, Position } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function PositionsTable() {
  const { publicKey } = useWallet();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchPositions = async () => {
    if (!publicKey) return;

    try {
      setError(null);
      const data = await getPositions(publicKey.toBase58());
      setPositions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch positions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();

    if (autoRefresh) {
      const interval = setInterval(fetchPositions, 10000);
      return () => clearInterval(interval);
    }
  }, [publicKey, autoRefresh]);

  const formatNumber = (num: number, decimals: number = 2) => {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  const formatPnl = (pnl: number) => {
    const formatted = formatNumber(Math.abs(pnl), 2);
    const sign = pnl >= 0 ? '+' : '-';
    return `${sign}$${formatted}`;
  };

  if (!publicKey) {
    return (
      <Card className="bg-slate-900/50 backdrop-blur border-slate-800 p-6 rounded-xl">
        <Alert className="bg-slate-900/50 border-slate-800">
          <AlertDescription className="text-slate-400">
            Please connect your wallet to view positions.
          </AlertDescription>
        </Alert>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-900/50 backdrop-blur border-slate-800 rounded-xl overflow-hidden">
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-slate-100">Your Positions</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Auto-refresh (10s)</span>
            <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-400">Loading positions...</div>
      ) : error ? (
        <div className="p-6">
          <Alert className="bg-red-500/10 border-red-500/50">
            <AlertDescription className="text-red-400">{error}</AlertDescription>
          </Alert>
        </div>
      ) : positions.length === 0 ? (
        <div className="p-8 text-center text-slate-400">
          No open positions. Start copy trading to see positions here!
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-slate-900/50">
                <TableHead className="text-slate-300">Symbol</TableHead>
                <TableHead className="text-slate-300">Side</TableHead>
                <TableHead className="text-slate-300 text-right">Size</TableHead>
                <TableHead className="text-slate-300 text-right">Entry</TableHead>
                <TableHead className="text-slate-300 text-right">Mark</TableHead>
                <TableHead className="text-slate-300 text-right">Leverage</TableHead>
                <TableHead className="text-slate-300 text-right">PnL</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.map((position, index) => (
                <TableRow key={index} className="border-slate-800 hover:bg-slate-900/50">
                  <TableCell className="font-medium text-slate-100">
                    {position.symbol}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={position.side === 'long' ? 'default' : 'destructive'}
                      className={
                        position.side === 'long'
                          ? 'bg-green-500/20 text-green-400 border-green-500/50'
                          : 'bg-red-500/20 text-red-400 border-red-500/50'
                      }
                    >
                      {position.side === 'long' ? (
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 12 12">
                            <path d="M6 2L6 10M6 2L3 5M6 2L9 5" stroke="currentColor" strokeWidth="2" fill="none"/>
                          </svg>
                          Long
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 12 12">
                            <path d="M6 10L6 2M6 10L3 7M6 10L9 7" stroke="currentColor" strokeWidth="2" fill="none"/>
                          </svg>
                          Short
                        </span>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-slate-300">
                    {formatNumber(position.size, 4)}
                  </TableCell>
                  <TableCell className="text-right text-slate-300">
                    ${formatNumber(position.entryPrice)}
                  </TableCell>
                  <TableCell className="text-right text-slate-300">
                    ${formatNumber(position.markPrice)}
                  </TableCell>
                  <TableCell className="text-right text-slate-300">
                    {position.leverage}x
                  </TableCell>
                  <TableCell
                    className={`text-right font-semibold ${
                      position.unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {formatPnl(position.unrealizedPnl)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
