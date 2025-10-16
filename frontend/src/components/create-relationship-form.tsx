'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { createRelationship } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CreateRelationshipFormProps {
  onSuccess?: () => void;
  initialMasterWallet?: string;
}

const POPULAR_SYMBOLS = ['BTC-USD', 'ETH-USD', 'SOL-USD', 'BNB-USD', 'XRP-USD', 'ADA-USD'];

export function CreateRelationshipForm({ onSuccess, initialMasterWallet }: CreateRelationshipFormProps) {
  const { publicKey } = useWallet();
  const [masterWallet, setMasterWallet] = useState(initialMasterWallet || '');
  useEffect(() => {
    if (initialMasterWallet) {
      setMasterWallet(initialMasterWallet);
    }
  }, [initialMasterWallet]);
  const [apiKey, setApiKey] = useState('');
  const [sizingMethod, setSizingMethod] = useState<'multiplier' | 'fixed_usd' | 'balance_percent'>('multiplier');
  const [sizingValue, setSizingValue] = useState([0.5]);
  const [maxPositionCap, setMaxPositionCap] = useState<string>('');
  const [symbols, setSymbols] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Advanced settings state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customLeverage, setCustomLeverage] = useState<number | null>(null);
  const [maxExposure, setMaxExposure] = useState<string>('');
  const [symbolMultipliers, setSymbolMultipliers] = useState<Record<string, number>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    // Client-side validation for API key
    const trimmedApiKey = apiKey.trim();
    if (trimmedApiKey.length < 32) {
      setError('Invalid API key format. The key appears too short.');
      setLoading(false);
      return;
    }

    if (apiKey !== trimmedApiKey) {
      setError('Invalid API key format. Please remove leading/trailing spaces.');
      setLoading(false);
      return;
    }

    // Check for common copy-paste issues
    if (apiKey.includes(' ') || apiKey.includes('\n') || apiKey.includes('\t')) {
      setError('Invalid API key format. Please check for extra spaces or hidden characters.');
      setLoading(false);
      return;
    }

    try {
      const symbolFilter = symbols
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      await createRelationship({
        followerWallet: publicKey.toBase58(),
        masterWallet,
        apiKey: trimmedApiKey,
        sizingMethod,
        sizingValue: sizingValue[0],
        maxPositionCap: maxPositionCap ? parseFloat(maxPositionCap) : null,
        symbolFilter: symbolFilter.length > 0 ? symbolFilter : undefined,
        customLeverage: customLeverage,
        maxTotalExposure: maxExposure ? parseFloat(maxExposure) : null,
        symbolMultipliers: Object.keys(symbolMultipliers).length > 0 ? symbolMultipliers : null,
      });

      setSuccess(true);
      // Reset form
      setMasterWallet('');
      setApiKey('');
      setSizingMethod('multiplier');
      setSizingValue([0.5]);
      setMaxPositionCap('');
      setSymbols('');
      setCustomLeverage(null);
      setMaxExposure('');
      setSymbolMultipliers({});
      setShowAdvanced(false);

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      // Map backend errors to user-friendly messages
      const message = err instanceof Error ? err.message : 'Failed to create relationship';

      if (message.includes('Invalid API agent key')) {
        setError('Invalid API key format. Please copy the entire private key from Pacifica without any modifications.');
      } else if (message.includes('base58')) {
        setError('Invalid API key encoding. Please ensure you copied the key correctly from Pacifica.');
      } else if (message.includes('decrypt')) {
        setError('Could not decrypt API key. Please try creating a new relationship with a fresh key.');
      } else if (message.includes('approved')) {
        setError('Your wallet must be approved first. Please request approval and wait for confirmation.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleSymbol = (symbol: string) => {
    const currentSymbols = symbols.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
    if (currentSymbols.includes(symbol)) {
      setSymbols(currentSymbols.filter((s) => s !== symbol).join(', '));
    } else {
      setSymbols([...currentSymbols, symbol].join(', '));
    }
  };

  return (
    <Card className="bg-slate-900/50 backdrop-blur border-slate-800 p-6 rounded-xl">
      <h3 className="text-xl font-semibold text-slate-100 mb-4">Create Copy Relationship</h3>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="masterWallet" className="text-slate-200">
            Master Wallet Address
          </Label>
          <Input
            id="masterWallet"
            value={masterWallet}
            onChange={(e) => setMasterWallet(e.target.value)}
            placeholder="Enter the trader's wallet address"
            required
            className="bg-slate-950 border-slate-700 text-slate-100 focus:border-purple-500"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="apiKey" className="text-slate-200">
            Pacifica API Agent Key (Private Key)
          </Label>
          <Input
            id="apiKey"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Paste your API agent private key"
            required
            className="bg-slate-950 border-slate-700 text-slate-100 focus:border-purple-500"
          />
          <div className="space-y-1">
            <p className="text-xs text-slate-500">
              Get from{' '}
              <a
                href="https://app.pacifica.fi/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 underline"
              >
                Pacifica → Settings → API Keys
              </a>
            </p>
            <p className="text-xs text-amber-400/80">
              ⚠️ Keep this key secure. Anyone with this key can trade on your behalf.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-slate-200">Position Sizing Method</Label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setSizingMethod('multiplier');
                  setSizingValue([0.5]);
                }}
                className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  sizingMethod === 'multiplier'
                    ? 'bg-purple-500/20 text-purple-400 border-2 border-purple-500/50'
                    : 'bg-slate-800 text-slate-400 border-2 border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="text-center">
                  <div className="font-semibold">Multiplier</div>
                  <div className="text-xs opacity-75">Scale by ratio</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSizingMethod('fixed_usd');
                  setSizingValue([100]);
                }}
                className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  sizingMethod === 'fixed_usd'
                    ? 'bg-purple-500/20 text-purple-400 border-2 border-purple-500/50'
                    : 'bg-slate-800 text-slate-400 border-2 border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="text-center">
                  <div className="font-semibold">Fixed USD</div>
                  <div className="text-xs opacity-75">Set $ amount</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSizingMethod('balance_percent');
                  setSizingValue([5]);
                }}
                className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  sizingMethod === 'balance_percent'
                    ? 'bg-purple-500/20 text-purple-400 border-2 border-purple-500/50'
                    : 'bg-slate-800 text-slate-400 border-2 border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="text-center">
                  <div className="font-semibold">Balance %</div>
                  <div className="text-xs opacity-75">% of balance</div>
                </div>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-200">
              {sizingMethod === 'multiplier' && `Position Multiplier: ${sizingValue[0].toFixed(2)}x`}
              {sizingMethod === 'fixed_usd' && `Fixed Amount: $${sizingValue[0].toFixed(0)}`}
              {sizingMethod === 'balance_percent' && `Balance Percentage: ${sizingValue[0].toFixed(1)}%`}
            </Label>
            <Slider
              value={sizingValue}
              onValueChange={setSizingValue}
              min={sizingMethod === 'multiplier' ? 0.1 : sizingMethod === 'fixed_usd' ? 10 : 0.5}
              max={sizingMethod === 'multiplier' ? 1.0 : sizingMethod === 'fixed_usd' ? 10000 : 50}
              step={sizingMethod === 'multiplier' ? 0.05 : sizingMethod === 'fixed_usd' ? 10 : 0.5}
              className="py-4"
            />
            <p className="text-xs text-slate-500">
              {sizingMethod === 'multiplier' && 'Scale copied positions relative to the master trader (0.1x - 1.0x)'}
              {sizingMethod === 'fixed_usd' && 'Use a fixed USD amount for each position ($10 - $10,000)'}
              {sizingMethod === 'balance_percent' && 'Use a percentage of your available balance (0.5% - 50%)'}
            </p>
          </div>

          {sizingMethod !== 'multiplier' && (
            <div className="space-y-2">
              <Label htmlFor="maxPositionCap" className="text-slate-200">
                Max Position Cap (USD) {maxPositionCap && `($${parseFloat(maxPositionCap).toFixed(0)})`}
              </Label>
              <Input
                id="maxPositionCap"
                type="number"
                value={maxPositionCap}
                onChange={(e) => setMaxPositionCap(e.target.value)}
                placeholder="e.g., 1000"
                className="bg-slate-950 border-slate-700 text-slate-100 focus:border-purple-500"
              />
              <p className="text-xs text-slate-500">
                Optional: Limit individual position size. Useful to prevent oversized positions.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-slate-200">Symbol Filter (Optional)</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            {POPULAR_SYMBOLS.map((symbol) => (
              <button
                key={symbol}
                type="button"
                onClick={() => toggleSymbol(symbol)}
                className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                  symbols.split(',').map((s) => s.trim()).includes(symbol)
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                    : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                }`}
              >
                {symbol}
              </button>
            ))}
          </div>
          <Input
            id="symbols"
            value={symbols}
            onChange={(e) => setSymbols(e.target.value)}
            placeholder="BTC-USD, ETH-USD (comma separated)"
            className="bg-slate-950 border-slate-700 text-slate-100 focus:border-purple-500"
          />
          <p className="text-xs text-slate-500">
            Leave empty to copy all symbols, or specify which pairs to copy
          </p>
        </div>

        {/* Advanced Settings Accordion */}
        <div className="space-y-2 border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center justify-between w-full text-slate-200 text-sm font-medium hover:text-purple-400 transition"
          >
            <span>⚙️ Advanced Settings (Optional)</span>
            <span className="text-xs">{showAdvanced ? '▲' : '▼'}</span>
          </button>

          {showAdvanced && (
            <div className="space-y-4 mt-4 p-4 bg-slate-950/50 rounded-lg border border-slate-800">
              {/* Custom Leverage */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="customLeverage" className="text-slate-200">
                    Custom Leverage {customLeverage && `(${customLeverage}x)`}
                  </Label>
                  {customLeverage && (
                    <button
                      type="button"
                      onClick={() => setCustomLeverage(null)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <Slider
                  value={[customLeverage || 10]}
                  onValueChange={(val) => setCustomLeverage(val[0])}
                  min={1}
                  max={50}
                  step={1}
                  className="py-4"
                />
                <p className="text-xs text-slate-500">
                  Limit position size based on your available balance (1x-50x). Leave empty for no limit.
                </p>
              </div>

              {/* Max Total Exposure */}
              <div className="space-y-2">
                <Label htmlFor="maxExposure" className="text-slate-200">
                  Max Total Exposure (USD)
                </Label>
                <Input
                  id="maxExposure"
                  type="number"
                  value={maxExposure}
                  onChange={(e) => setMaxExposure(e.target.value)}
                  placeholder="e.g., 5000"
                  className="bg-slate-950 border-slate-700 text-slate-100 focus:border-purple-500"
                />
                <p className="text-xs text-slate-500">
                  Stop copying if total position value exceeds this amount. Leave empty for no limit.
                </p>
              </div>

              {/* Symbol Multipliers */}
              <div className="space-y-2">
                <Label className="text-slate-200">Symbol-Specific Multipliers</Label>
                <div className="space-y-2">
                  {Object.entries(symbolMultipliers).map(([symbol, mult]) => (
                    <div key={symbol} className="flex items-center gap-2">
                      <span className="text-sm text-slate-300 w-24">{symbol}</span>
                      <Slider
                        value={[mult]}
                        onValueChange={(val) =>
                          setSymbolMultipliers((prev) => ({ ...prev, [symbol]: val[0] }))
                        }
                        min={0.1}
                        max={1.0}
                        step={0.05}
                        className="flex-1 py-2"
                      />
                      <span className="text-xs text-slate-400 w-12">{mult.toFixed(2)}x</span>
                      <button
                        type="button"
                        onClick={() => {
                          const newMults = { ...symbolMultipliers };
                          delete newMults[symbol];
                          setSymbolMultipliers(newMults);
                        }}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <select
                  onChange={(e) => {
                    if (e.target.value && !symbolMultipliers[e.target.value]) {
                      setSymbolMultipliers((prev) => ({ ...prev, [e.target.value]: 0.5 }));
                    }
                    e.target.value = '';
                  }}
                  className="w-full bg-slate-950 border-slate-700 text-slate-100 rounded px-3 py-2 text-sm"
                >
                  <option value="">+ Add Symbol Override</option>
                  {POPULAR_SYMBOLS.filter((s) => !symbolMultipliers[s]).map((symbol) => (
                    <option key={symbol} value={symbol}>
                      {symbol}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500">
                  Override the default multiplier for specific symbols. Useful for lower risk on volatile assets.
                </p>
              </div>
            </div>
          )}
        </div>

        {success && (
          <Alert className="bg-green-500/10 border-green-500/50">
            <AlertDescription className="text-green-400">
              Copy relationship created successfully!
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert className="bg-red-500/10 border-red-500/50">
            <AlertDescription className="text-red-400">{error}</AlertDescription>
          </Alert>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
        >
          {loading ? 'Creating...' : 'Create Relationship'}
        </Button>
      </form>
    </Card>
  );
}
