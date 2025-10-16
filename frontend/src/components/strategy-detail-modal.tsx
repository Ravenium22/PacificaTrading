'use client';

import { useEffect, useState } from 'react';
import { Strategy, Execution, getStrategyPerformance, updateStrategy, deleteStrategy } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, Calendar, Grid3x3, TrendingUp, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface StrategyDetailModalProps {
  strategy: Strategy | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

const strategyIcons: Record<string, LucideIcon> = {
  twap: Clock,
  dca: Calendar,
  grid: Grid3x3,
  trailing_stop: TrendingUp,
};

const strategyNames: Record<string, string> = {
  twap: 'TWAP Strategy',
  dca: 'DCA Strategy',
  grid: 'Grid Strategy',
  trailing_stop: 'Trailing Stop Strategy',
};

interface PerformanceData {
  total_executions: number;
  filled_executions: number;
  failed_executions: number;
  success_rate: number;
  avg_entry_price: number;
  total_spent: number;
}

export function StrategyDetailModal({ strategy, open, onOpenChange, onUpdate }: StrategyDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (open && strategy) {
      fetchPerformance();
    }
  }, [open, strategy]);

  const fetchPerformance = async () => {
    if (!strategy) return;

    setLoading(true);
    setError(null);

    try {
      const data = await getStrategyPerformance(strategy.id);
      setPerformance(data.performance);
      setExecutions(data.executions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch performance');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async () => {
    if (!strategy) return;

    setActionLoading(true);
    try {
      await updateStrategy(strategy.id, { isActive: !strategy.isActive });
      onUpdate();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update strategy');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!strategy) return;

    if (!confirm('Are you sure you want to delete this strategy? This action cannot be undone.')) {
      return;
    }

    setActionLoading(true);
    try {
      await deleteStrategy(strategy.id);
      onUpdate();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete strategy');
    } finally {
      setActionLoading(false);
    }
  };

  if (!strategy) return null;

  const Icon = strategyIcons[strategy.strategyType] || Clock;
  const name = strategyNames[strategy.strategyType] || strategy.strategyType;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Icon className="w-6 h-6 text-purple-400" />
            <div>
              <DialogTitle className="text-xl">{name}</DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline">{strategy.symbol}</Badge>
                <Badge className={strategy.isActive ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}>
                  {strategy.isActive ? 'Active' : 'Paused'}
                </Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-slate-950/50">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="history">Execution History</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* Progress */}
            <div>
              <h4 className="text-sm font-medium text-slate-300 mb-3">Progress</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Executed</span>
                  <span className="text-slate-200 font-medium">
                    ${strategy.executedAmount.toFixed(2)} / ${strategy.totalAmount.toFixed(2)}
                  </span>
                </div>
                <Progress value={strategy.progress} className="h-3" />
                <div className="text-center text-sm text-slate-400">
                  {strategy.progress.toFixed(1)}% Complete
                </div>
              </div>
            </div>

            {/* Configuration */}
            <div>
              <h4 className="text-sm font-medium text-slate-300 mb-3">Configuration</h4>
              <div className="rounded-lg bg-slate-950/50 border border-slate-800 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Strategy Type</span>
                  <span className="text-slate-200">{name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Symbol</span>
                  <span className="text-slate-200">{strategy.symbol}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Total Amount</span>
                  <span className="text-slate-200">${strategy.totalAmount.toFixed(2)}</span>
                </div>

                {/* Strategy-specific config */}
                {strategy.strategyType === 'twap' && 'duration_minutes' in strategy.config && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Duration</span>
                      <span className="text-slate-200">{strategy.config.duration_minutes / 60}h</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Interval</span>
                      <span className="text-slate-200">{strategy.config.interval_minutes}m</span>
                    </div>
                  </>
                )}

                {strategy.strategyType === 'dca' && 'buy_amount' in strategy.config && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Buy Amount</span>
                      <span className="text-slate-200">${strategy.config.buy_amount}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Frequency</span>
                      <span className="text-slate-200">Every {strategy.config.frequency_hours}h</span>
                    </div>
                  </>
                )}

                {strategy.strategyType === 'trailing_stop' && 'trigger_price' in strategy.config && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Trigger Price</span>
                      <span className="text-slate-200">${strategy.config.trigger_price}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Trail Percent</span>
                      <span className="text-slate-200">{strategy.config.trail_percent}%</span>
                    </div>
                  </>
                )}

                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Created</span>
                  <span className="text-slate-200">{new Date(strategy.createdAt).toLocaleString()}</span>
                </div>

                {strategy.lastExecution && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Last Execution</span>
                    <span className="text-slate-200">{new Date(strategy.lastExecution).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Status */}
            {strategy.completedAt && (
              <Alert className="bg-green-500/10 border-green-500/50">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <AlertDescription className="text-green-400">
                  Strategy completed on {new Date(strategy.completedAt).toLocaleString()}
                </AlertDescription>
              </Alert>
            )}

            {strategy.lastError && (
              <Alert className="bg-red-500/10 border-red-500/50">
                <XCircle className="w-4 h-4 text-red-400" />
                <AlertDescription className="text-red-400">
                  Error: {strategy.lastError}
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          {/* Execution History Tab */}
          <TabsContent value="history" className="mt-6">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
              </div>
            ) : executions.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                No executions yet
              </div>
            ) : (
              <div className="rounded-lg border border-slate-800 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-950/50">
                      <TableHead className="text-slate-300">Time</TableHead>
                      <TableHead className="text-slate-300">Side</TableHead>
                      <TableHead className="text-slate-300">Size</TableHead>
                      <TableHead className="text-slate-300">Price</TableHead>
                      <TableHead className="text-slate-300">Amount</TableHead>
                      <TableHead className="text-slate-300">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {executions.map((exec) => (
                      <TableRow key={exec.id} className="border-slate-800">
                        <TableCell className="text-slate-300 text-sm">
                          {new Date(exec.executedAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge className={exec.side === 'buy' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
                            {exec.side}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-300 text-sm">{exec.size.toFixed(4)}</TableCell>
                        <TableCell className="text-slate-300 text-sm">${exec.price.toFixed(2)}</TableCell>
                        <TableCell className="text-slate-300 text-sm">${exec.amount.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              exec.status === 'filled'
                                ? 'bg-green-500/20 text-green-400'
                                : exec.status === 'failed'
                                ? 'bg-red-500/20 text-red-400'
                                : 'bg-yellow-500/20 text-yellow-400'
                            }
                          >
                            {exec.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="mt-6">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
              </div>
            ) : performance ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-slate-950/50 border border-slate-800 p-4">
                  <p className="text-sm text-slate-400 mb-1">Total Executions</p>
                  <p className="text-2xl font-semibold text-slate-100">{performance.total_executions}</p>
                </div>
                <div className="rounded-lg bg-slate-950/50 border border-slate-800 p-4">
                  <p className="text-sm text-slate-400 mb-1">Success Rate</p>
                  <p className="text-2xl font-semibold text-green-400">{performance.success_rate.toFixed(1)}%</p>
                </div>
                <div className="rounded-lg bg-slate-950/50 border border-slate-800 p-4">
                  <p className="text-sm text-slate-400 mb-1">Avg Entry Price</p>
                  <p className="text-2xl font-semibold text-slate-100">${performance.avg_entry_price.toFixed(2)}</p>
                </div>
                <div className="rounded-lg bg-slate-950/50 border border-slate-800 p-4">
                  <p className="text-sm text-slate-400 mb-1">Total Spent</p>
                  <p className="text-2xl font-semibold text-purple-400">${performance.total_spent.toFixed(2)}</p>
                </div>
                <div className="rounded-lg bg-slate-950/50 border border-slate-800 p-4">
                  <p className="text-sm text-slate-400 mb-1">Filled Orders</p>
                  <p className="text-2xl font-semibold text-green-400">{performance.filled_executions}</p>
                </div>
                <div className="rounded-lg bg-slate-950/50 border border-slate-800 p-4">
                  <p className="text-sm text-slate-400 mb-1">Failed Orders</p>
                  <p className="text-2xl font-semibold text-red-400">{performance.failed_executions}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                No performance data available
              </div>
            )}
          </TabsContent>
        </Tabs>

        {error && (
          <Alert className="bg-red-500/10 border-red-500/50 mt-4">
            <AlertDescription className="text-red-400">{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleToggleActive}
            disabled={actionLoading || !!strategy.completedAt}
            className="border-slate-700"
          >
            {actionLoading ? 'Loading...' : strategy.isActive ? 'Pause' : 'Resume'}
          </Button>
          <Button
            variant="outline"
            onClick={handleDelete}
            disabled={actionLoading}
            className="border-red-500/50 text-red-400 hover:bg-red-500/10"
          >
            {actionLoading ? 'Deleting...' : 'Delete'}
          </Button>
          <Button onClick={() => onOpenChange(false)} className="bg-purple-500 hover:bg-purple-600">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
