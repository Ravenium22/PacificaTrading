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
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, Loader2 } from 'lucide-react';

interface TWAPDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  apiKey: string;
}

export function TWAPDialog({ open, onOpenChange, onSuccess, apiKey }: TWAPDialogProps) {
  const { publicKey } = useWallet();
  const { symbols, loading: symbolsLoading } = useSymbols();
  const [symbol, setSymbol] = useState('BTC-USD');
  const [totalAmount, setTotalAmount] = useState('100');
  const [durationMinutes, setDurationMinutes] = useState([1440]); // 24 hours default
  const [intervalMinutes, setIntervalMinutes] = useState([60]); // 1 hour default
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey) return;

    const amount = parseFloat(totalAmount);
    if (isNaN(amount) || amount < 10) {
      setError('Total amount must be at least $10');
      return;
    }

    if (intervalMinutes[0] >= durationMinutes[0]) {
      setError('Interval must be less than duration');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createStrategy({
        userWallet: publicKey.toBase58(),
        strategyType: 'twap',
        symbol,
        totalAmount: amount,
        config: {
          duration_minutes: durationMinutes[0],
          interval_minutes: intervalMinutes[0],
        },
        apiKey,
      });

      // Reset form
      setSymbol('BTC-USD');
      setTotalAmount('100');
      setDurationMinutes([1440]);
      setIntervalMinutes([60]);

      onSuccess();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create strategy');
    } finally {
      setLoading(false);
    }
  };

  const intervals = Math.floor(durationMinutes[0] / intervalMinutes[0]);
  const amountPerInterval = parseFloat(totalAmount) / intervals;
  const durationHours = durationMinutes[0] / 60;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl">TWAP Strategy</DialogTitle>
              <DialogDescription className="text-slate-400">
                Time-Weighted Average Price - Execute large orders gradually
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

          {/* Total Amount */}
          <div className="space-y-2">
            <Label htmlFor="totalAmount" className="text-slate-200">
              Total Amount (USD)
            </Label>
            <Input
              id="totalAmount"
              type="number"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              min="10"
              step="10"
              required
              className="bg-slate-950 border-slate-700 text-slate-100"
            />
            <p className="text-xs text-slate-500">Minimum $10</p>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label className="text-slate-200">
              Duration: {durationHours < 1 ? `${durationMinutes[0]} minutes` : `${durationHours.toFixed(1)} hours`}
            </Label>
            <Slider
              value={durationMinutes}
              onValueChange={setDurationMinutes}
              min={60}
              max={1440}
              step={60}
              className="py-4"
            />
            <p className="text-xs text-slate-500">Total time to complete all orders (1h - 24h)</p>
          </div>

          {/* Interval */}
          <div className="space-y-2">
            <Label className="text-slate-200">
              Interval: {intervalMinutes[0] < 60 ? `${intervalMinutes[0]} minutes` : `${(intervalMinutes[0] / 60).toFixed(1)} hours`}
            </Label>
            <Slider
              value={intervalMinutes}
              onValueChange={setIntervalMinutes}
              min={1}
              max={Math.min(60, durationMinutes[0] - 1)}
              step={1}
              className="py-4"
            />
            <p className="text-xs text-slate-500">Time between each order (1m - 1h)</p>
          </div>

          {/* Preview */}
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-4">
            <p className="text-sm text-blue-300 font-medium mb-2">Preview</p>
            <p className="text-sm text-slate-300">
              Will buy <span className="font-semibold text-blue-400">${amountPerInterval.toFixed(2)}</span> worth of{' '}
              <span className="font-semibold text-blue-400">{symbol}</span> every{' '}
              <span className="font-semibold text-blue-400">{intervalMinutes[0]} minutes</span> for{' '}
              <span className="font-semibold text-blue-400">{durationHours.toFixed(1)} hours</span>
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Total: {intervals} orders
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
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:opacity-90"
            >
              {loading ? 'Creating...' : 'Create Strategy'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
