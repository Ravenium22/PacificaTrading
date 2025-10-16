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
import { Grid3x3, Loader2 } from 'lucide-react';

interface GridDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  apiKey: string;
}

export function GridDialog({ open, onOpenChange, onSuccess, apiKey }: GridDialogProps) {
  const { publicKey } = useWallet();
  const { symbols, loading: symbolsLoading } = useSymbols();
  const [symbol, setSymbol] = useState('BTC-USD');
  const [totalAmount, setTotalAmount] = useState('1000');
  const [lowerPrice, setLowerPrice] = useState('40000');
  const [upperPrice, setUpperPrice] = useState('50000');
  const [gridLevels, setGridLevels] = useState([10]); // 10 levels default
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey) return;

    const amount = parseFloat(totalAmount);
    const lower = parseFloat(lowerPrice);
    const upper = parseFloat(upperPrice);
    const levels = gridLevels[0];
  const amountPerGrid = amount / levels;

    // Validation
    if (isNaN(amount) || amount < 100) {
      setError('Total amount must be at least $100');
      return;
    }

    if (isNaN(lower) || lower <= 0) {
      setError('Lower price must be greater than 0');
      return;
    }

    if (isNaN(upper) || upper <= lower) {
      setError('Upper price must be greater than lower price');
      return;
    }

    if (levels < 3) {
      setError('Grid must have at least 3 levels');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createStrategy({
        userWallet: publicKey.toBase58(),
        strategyType: 'grid',
        symbol,
        totalAmount: amount,
        config: {
          lower_price: lower,
          upper_price: upper,
          grid_levels: levels,
          amount_per_grid: amountPerGrid,
        },
        apiKey,
      });

      // Reset form
      setSymbol('BTC-USD');
      setTotalAmount('1000');
      setLowerPrice('40000');
      setUpperPrice('50000');
      setGridLevels([10]);

      onSuccess();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create strategy');
    } finally {
      setLoading(false);
    }
  };

  const priceRange = parseFloat(upperPrice) - parseFloat(lowerPrice);
  const levelSpacing = priceRange / (gridLevels[0] - 1);
  const amountPerLevel = parseFloat(totalAmount) / gridLevels[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
              <Grid3x3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl">Grid Trading Strategy</DialogTitle>
              <DialogDescription className="text-slate-400">
                Automated buy low, sell high with multiple price levels
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
              Total Budget (USD)
            </Label>
            <Input
              id="totalAmount"
              type="number"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              min="100"
              step="100"
              required
              className="bg-slate-950 border-slate-700 text-slate-100"
            />
            <p className="text-xs text-slate-500">Total capital to allocate across all grid levels (minimum $100)</p>
          </div>

          {/* Price Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lowerPrice" className="text-slate-200">
                Lower Price
              </Label>
              <Input
                id="lowerPrice"
                type="number"
                value={lowerPrice}
                onChange={(e) => setLowerPrice(e.target.value)}
                min="0"
                step="0.01"
                required
                className="bg-slate-950 border-slate-700 text-slate-100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="upperPrice" className="text-slate-200">
                Upper Price
              </Label>
              <Input
                id="upperPrice"
                type="number"
                value={upperPrice}
                onChange={(e) => setUpperPrice(e.target.value)}
                min="0"
                step="0.01"
                required
                className="bg-slate-950 border-slate-700 text-slate-100"
              />
            </div>
          </div>

          {/* Grid Levels */}
          <div className="space-y-2">
            <Label className="text-slate-200">
              Grid Levels: {gridLevels[0]}
            </Label>
            <Slider
              value={gridLevels}
              onValueChange={setGridLevels}
              min={3}
              max={50}
              step={1}
              className="py-4"
            />
            <p className="text-xs text-slate-500">Number of buy/sell orders to place (3 - 50)</p>
          </div>

          {/* Preview */}
          <div className="rounded-lg bg-purple-500/10 border border-purple-500/30 p-4">
            <p className="text-sm text-purple-300 font-medium mb-2">Grid Preview</p>
            <ul className="text-sm text-slate-300 space-y-1">
              <li>• Price range: <span className="font-semibold text-purple-400">${lowerPrice} - ${upperPrice}</span></li>
              <li>• Grid levels: <span className="font-semibold text-purple-400">{gridLevels[0]}</span></li>
              <li>• Level spacing: <span className="font-semibold text-purple-400">${levelSpacing.toFixed(2)}</span></li>
              <li>• Amount per level: <span className="font-semibold text-purple-400">${amountPerLevel.toFixed(2)}</span></li>
            </ul>
          </div>

          {/* How it works */}
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-3">
            <p className="text-xs text-blue-300 font-medium mb-2">How Grid Trading Works</p>
            <ul className="text-xs text-slate-300 space-y-1">
              <li>• Places buy orders below current price</li>
              <li>• Places sell orders above current price</li>
              <li>• When price falls, buys at lower levels</li>
              <li>• When price rises, sells at higher levels</li>
              <li>• Automatically rebalances as orders fill</li>
            </ul>
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
              className="bg-gradient-to-r from-purple-500 to-purple-600 hover:opacity-90"
            >
              {loading ? 'Creating...' : 'Create Strategy'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
