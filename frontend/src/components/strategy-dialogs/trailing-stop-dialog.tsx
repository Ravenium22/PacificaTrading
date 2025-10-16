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
import { TrendingUp, Loader2 } from 'lucide-react';

interface TrailingStopDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  apiKey: string;
}

export function TrailingStopDialog({ open, onOpenChange, onSuccess, apiKey }: TrailingStopDialogProps) {
  const { publicKey } = useWallet();
  const { symbols, loading: symbolsLoading } = useSymbols();
  const [symbol, setSymbol] = useState('BTC-USD');
  const [totalAmount, setTotalAmount] = useState('1000');
  const [triggerPrice, setTriggerPrice] = useState('45000');
  const [trailPercent, setTrailPercent] = useState([5]); // 5% default
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey) return;

    const amount = parseFloat(totalAmount);
    const price = parseFloat(triggerPrice);

    if (isNaN(amount) || amount < 10) {
      setError('Total amount must be at least $10');
      return;
    }

    if (isNaN(price) || price <= 0) {
      setError('Trigger price must be greater than 0');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createStrategy({
        userWallet: publicKey.toBase58(),
        strategyType: 'trailing_stop',
        symbol,
        totalAmount: amount,
        config: {
          trigger_price: price,
          trail_percent: trailPercent[0],
        },
        apiKey,
      });

      // Reset form
      setSymbol('BTC-USD');
      setTotalAmount('1000');
      setTriggerPrice('45000');
      setTrailPercent([5]);

      onSuccess();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create strategy');
    } finally {
      setLoading(false);
    }
  };

  const stopLossPrice = (parseFloat(triggerPrice) * (1 - trailPercent[0] / 100)).toFixed(2);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl">Trailing Stop Strategy</DialogTitle>
              <DialogDescription className="text-slate-400">
                Lock in profits - Sell if price drops X% from peak
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
              Position Size (USD)
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
            <p className="text-xs text-slate-500">Value of position to protect (minimum $10)</p>
          </div>

          {/* Trigger Price */}
          <div className="space-y-2">
            <Label htmlFor="triggerPrice" className="text-slate-200">
              Starting Price
            </Label>
            <Input
              id="triggerPrice"
              type="number"
              value={triggerPrice}
              onChange={(e) => setTriggerPrice(e.target.value)}
              min="0"
              step="0.01"
              required
              className="bg-slate-950 border-slate-700 text-slate-100"
            />
            <p className="text-xs text-slate-500">Current or entry price to start tracking from</p>
          </div>

          {/* Trail Percent */}
          <div className="space-y-2">
            <Label className="text-slate-200">
              Trail Distance: {trailPercent[0]}%
            </Label>
            <Slider
              value={trailPercent}
              onValueChange={setTrailPercent}
              min={1}
              max={20}
              step={0.5}
              className="py-4"
            />
            <p className="text-xs text-slate-500">Sell if price drops this % from peak (1% - 20%)</p>
          </div>

          {/* Preview */}
          <div className="rounded-lg bg-orange-500/10 border border-orange-500/30 p-4">
            <p className="text-sm text-orange-300 font-medium mb-2">How it works</p>
            <ul className="text-sm text-slate-300 space-y-1">
              <li>• Tracks <span className="font-semibold text-orange-400">{symbol}</span> price starting from <span className="font-semibold text-orange-400">${triggerPrice}</span></li>
              <li>• As price rises, stop loss follows {trailPercent[0]}% below peak</li>
              <li>• If price drops {trailPercent[0]}% from peak, sells entire position</li>
              <li>• Current stop loss would be at <span className="font-semibold text-orange-400">${stopLossPrice}</span></li>
            </ul>
          </div>

          {/* Warning */}
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
            <p className="text-xs text-amber-300">
              Note: This strategy monitors price continuously and will trigger a market sell order when the stop loss is hit.
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
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:opacity-90"
            >
              {loading ? 'Creating...' : 'Create Strategy'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
