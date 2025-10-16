'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { createStrategy } from '@/lib/api';
import { useSymbols } from '@/hooks/useSymbols';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar, Loader2 } from 'lucide-react';

interface DCADialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  apiKey: string;
}

const FREQUENCY_OPTIONS = [
  { value: 1, label: 'Every Hour' },
  { value: 4, label: 'Every 4 Hours' },
  { value: 12, label: 'Every 12 Hours' },
  { value: 24, label: 'Daily' },
  { value: 168, label: 'Weekly' },
];

export function DCADialog({ open, onOpenChange, onSuccess, apiKey }: DCADialogProps) {
  const { publicKey } = useWallet();
  const { symbols, loading: symbolsLoading } = useSymbols();
  const [symbol, setSymbol] = useState('BTC-USD');
  const [buyAmount, setBuyAmount] = useState('100');
  const [frequency, setFrequency] = useState('24');
  const [totalBudget, setTotalBudget] = useState('1000');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey) return;

    const amount = parseFloat(buyAmount);
    const budget = parseFloat(totalBudget);

    if (isNaN(amount) || amount < 10) {
      setError('Buy amount must be at least $10');
      return;
    }

    if (isNaN(budget) || budget < amount) {
      setError('Total budget must be at least equal to buy amount');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createStrategy({
        userWallet: publicKey.toBase58(),
        strategyType: 'dca',
        symbol,
        totalAmount: budget,
        config: {
          buy_amount: amount,
          frequency_hours: parseInt(frequency),
        },
        apiKey,
      });

      // Reset form
      setSymbol('BTC-USD');
      setBuyAmount('100');
      setFrequency('24');
      setTotalBudget('1000');

      onSuccess();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create strategy');
    } finally {
      setLoading(false);
    }
  };

  const estimatedExecutions = Math.floor(parseFloat(totalBudget) / parseFloat(buyAmount));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl">DCA Strategy</DialogTitle>
              <DialogDescription className="text-slate-400">
                Dollar Cost Averaging - Buy consistently at fixed intervals
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Symbol Selection */}
          <div className="space-y-2">
            <Label htmlFor="symbol" className="text-slate-200">
              Symbol
            </Label>
            <Select value={symbol} onValueChange={setSymbol} disabled={symbolsLoading}>
              <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100">
                {symbolsLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Loading symbols...</span>
                  </div>
                ) : (
                  <SelectValue />
                )}
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700 max-h-[300px]">
                {symbols.map((s) => (
                  <SelectItem key={s} value={s} className="text-slate-100">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">
              {symbols.length} symbols available
            </p>
          </div>

          {/* Buy Amount */}
          <div className="space-y-2">
            <Label htmlFor="buyAmount" className="text-slate-200">
              Amount Per Buy (USD)
            </Label>
            <Input
              id="buyAmount"
              type="number"
              value={buyAmount}
              onChange={(e) => setBuyAmount(e.target.value)}
              min="10"
              step="10"
              required
              className="bg-slate-950 border-slate-700 text-slate-100"
            />
            <p className="text-xs text-slate-500">How much to buy each time (minimum $10)</p>
          </div>

          {/* Frequency */}
          <div className="space-y-2">
            <Label htmlFor="frequency" className="text-slate-200">
              Frequency
            </Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                {FREQUENCY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={String(opt.value)} className="text-slate-100">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">How often to execute buys</p>
          </div>

          {/* Total Budget */}
          <div className="space-y-2">
            <Label htmlFor="totalBudget" className="text-slate-200">
              Total Budget (USD)
            </Label>
            <Input
              id="totalBudget"
              type="number"
              value={totalBudget}
              onChange={(e) => setTotalBudget(e.target.value)}
              min={buyAmount}
              step="10"
              required
              className="bg-slate-950 border-slate-700 text-slate-100"
            />
            <p className="text-xs text-slate-500">Total amount to allocate to this strategy</p>
          </div>

          {/* Preview */}
          <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-4">
            <p className="text-sm text-green-300 font-medium mb-2">Preview</p>
            <p className="text-sm text-slate-300">
              Will buy <span className="font-semibold text-green-400">${buyAmount}</span> worth of{' '}
              <span className="font-semibold text-green-400">{symbol}</span>{' '}
              {FREQUENCY_OPTIONS.find((f) => String(f.value) === frequency)?.label.toLowerCase()}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Estimated {estimatedExecutions} executions until budget is depleted
            </p>
          </div>

          {/* Note */}
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
            <p className="text-xs text-amber-300">
              Note: Strategy will automatically stop when total budget is spent or you manually pause it.
            </p>
          </div>

          {error && (
            <Alert className="bg-red-500/10 border-red-500/50">
              <AlertDescription className="text-red-400">{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="border-slate-700 text-slate-300"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-green-500 to-green-600 hover:opacity-90"
            >
              {loading ? 'Creating...' : 'Create Strategy'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
