'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Strategy, getStrategies, updateStrategy, deleteStrategy } from '@/lib/api';
import { validateApiKey, getValidationStatus } from '@/utils/apiKeyValidation';
import { Navbar } from '@/components/navbar';
import { StrategyPresetCard } from '@/components/strategy-preset-card';
import { ActiveStrategyCard } from '@/components/active-strategy-card';
import { StrategyDetailModal } from '@/components/strategy-detail-modal';
import { TWAPDialog } from '@/components/strategy-dialogs/twap-dialog';
import { DCADialog } from '@/components/strategy-dialogs/dca-dialog';
import { TrailingStopDialog } from '@/components/strategy-dialogs/trailing-stop-dialog';
import { GridDialog } from '@/components/strategy-dialogs/grid-dialog';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Clock, Calendar, Grid3x3, TrendingUp, Sparkles, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

type DialogType = 'twap' | 'dca' | 'grid' | 'trailing_stop' | null;

export default function StrategiesPage() {
  const { publicKey, connected } = useWallet();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Dialog states
  const [openDialog, setOpenDialog] = useState<DialogType>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // API key state
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  useEffect(() => {
    if (connected && publicKey) {
      fetchStrategies();
    } else {
      setStrategies([]);
      setLoading(false);
    }

    // Poll for updates every 30 seconds
    const interval = setInterval(() => {
      if (connected && publicKey) {
        fetchStrategies();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [connected, publicKey, refreshTrigger]);

  const fetchStrategies = async () => {
    if (!publicKey) return;

    try {
      setError(null);
      const data = await getStrategies(publicKey.toBase58());
      setStrategies(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch strategies');
    } finally {
      setLoading(false);
    }
  };

  const handleConfigureStrategy = (type: DialogType) => {
    if (!apiKey && type !== null) {
      setShowApiKeyInput(true);
      toast.error('Please enter your Pacifica API key first');
      return;
    }
    setOpenDialog(type);
  };

  const handleSuccess = () => {
    setRefreshTrigger((prev) => prev + 1);
    toast.success('Strategy created successfully!');
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      await updateStrategy(id, { isActive: !currentActive });
      setRefreshTrigger((prev) => prev + 1);
      toast.success(currentActive ? 'Strategy paused' : 'Strategy resumed');
    } catch {
      toast.error('Failed to update strategy');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteStrategy(id);
      setRefreshTrigger((prev) => prev + 1);
      toast.success('Strategy deleted');
    } catch {
      toast.error('Failed to delete strategy');
    }
  };

  const handleViewDetails = (strategy: Strategy) => {
    setSelectedStrategy(strategy);
    setDetailModalOpen(true);
  };

  const handleSaveApiKey = () => {
    const validation = validateApiKey(apiKey);
    if (!validation.isValid) {
      toast.error(validation.error || 'Invalid API key format');
      return;
    }
    setShowApiKeyInput(false);
    toast.success('API key saved successfully');
  };

  const activeStrategiesCount = strategies.filter((s) => s.isActive).length;
  const validationStatus = getValidationStatus(apiKey);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <Navbar />
      <div className="max-w-7xl mx-auto py-12 px-4">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
                Automated Trading Strategies
              </h1>
              <p className="text-slate-400 mt-1">Set and forget - let strategies execute for you</p>
            </div>
          </div>

          {!connected && (
            <div className="mt-6">
              <WalletMultiButton className="!bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600" />
            </div>
          )}
        </div>

        {connected ? (
          <>
            {/* API Key Input (if needed) */}
            {showApiKeyInput && (
              <div className="mb-8">
                <Alert className="bg-amber-500/10 border-amber-500/50">
                  <AlertDescription>
                    <div className="space-y-3">
                      <p className="text-amber-300 text-sm">
                        Strategies require your Pacifica API key to execute trades on your behalf.
                      </p>
                      <div className="space-y-2">
                        <Label htmlFor="apiKey" className="text-slate-200">
                          Pacifica API Agent Key (Private Key)
                        </Label>
                        <div className="flex gap-2 items-start">
                          <div className="flex-1 space-y-2">
                            <div className="relative">
                              <Input
                                id="apiKey"
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="Paste your 87-88 character base58 private key"
                                className={`bg-slate-950 text-slate-100 pr-10 ${validationStatus.colorClass}`}
                              />
                              {validationStatus.status !== 'empty' && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                  {validationStatus.status === 'valid' ? (
                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                  ) : (
                                    <XCircle className="w-5 h-5 text-red-500" />
                                  )}
                                </div>
                              )}
                            </div>
                            {validationStatus.message && (
                              <p className={`text-xs ${validationStatus.status === 'valid' ? 'text-green-400' : 'text-red-400'}`}>
                                {validationStatus.message}
                              </p>
                            )}
                          </div>
                          <Button
                            onClick={handleSaveApiKey}
                            disabled={validationStatus.status !== 'valid'}
                            className="bg-purple-500 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Save
                          </Button>
                        </div>
                        <p className="text-xs text-slate-500">
                          64-byte base58 encoded string. Get from{' '}
                          <a
                            href="https://app.pacifica.fi/apikey"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-400 hover:text-purple-300 underline"
                          >
                            Pacifica → Settings → API Keys
                          </a>
                        </p>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* Two-column layout */}
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Left Column: Strategy Presets */}
              <div>
                <h2 className="text-2xl font-semibold text-slate-100 mb-6">Strategy Presets</h2>
                <div className="grid gap-4">
                  <StrategyPresetCard
                    type="twap"
                    title="TWAP"
                    description="Execute large orders without moving the market. Split orders across time intervals."
                    icon={Clock}
                    onConfigure={() => handleConfigureStrategy('twap')}
                  />
                  <StrategyPresetCard
                    type="dca"
                    title="DCA"
                    description="Buy consistently regardless of price. Perfect for long-term accumulation."
                    icon={Calendar}
                    onConfigure={() => handleConfigureStrategy('dca')}
                  />
                  <StrategyPresetCard
                    type="grid"
                    title="Grid Bot"
                    description="Trade price ranges automatically with buy and sell orders at multiple levels."
                    icon={Grid3x3}
                    onConfigure={() => handleConfigureStrategy('grid')}
                  />
                  <StrategyPresetCard
                    type="trailing_stop"
                    title="Trailing Stop"
                    description="Lock in profits and limit losses. Automatically sells if price drops X% from peak."
                    icon={TrendingUp}
                    onConfigure={() => handleConfigureStrategy('trailing_stop')}
                  />
                </div>
              </div>

              {/* Right Column: Active Strategies */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-semibold text-slate-100">Your Active Strategies</h2>
                  {activeStrategiesCount > 0 && (
                    <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/50">
                      {activeStrategiesCount} Active
                    </Badge>
                  )}
                </div>

                {loading ? (
                  <div className="text-center text-slate-400 py-12">
                    Loading strategies...
                  </div>
                ) : error ? (
                  <Alert className="bg-red-500/10 border-red-500/50">
                    <AlertDescription className="text-red-400">{error}</AlertDescription>
                  </Alert>
                ) : strategies.length === 0 ? (
                  <div className="rounded-xl bg-slate-900/50 backdrop-blur border-2 border-dashed border-slate-800 p-12 text-center">
                    <Sparkles className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400 mb-2">No strategies yet</p>
                    <p className="text-sm text-slate-500">
                      Configure a preset on the left to get started
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {strategies.map((strategy) => (
                      <ActiveStrategyCard
                        key={strategy.id}
                        strategy={strategy}
                        onToggleActive={handleToggleActive}
                        onDelete={handleDelete}
                        onViewDetails={handleViewDetails}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-20">
            <Sparkles className="w-16 h-16 text-slate-700 mx-auto mb-4" />
            <p className="text-xl text-slate-400 mb-6">Connect your wallet to get started with automated trading strategies</p>
            <WalletMultiButton className="!bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600" />
          </div>
        )}
      </div>

      {/* Dialogs */}
      <TWAPDialog
        open={openDialog === 'twap'}
        onOpenChange={(open) => !open && setOpenDialog(null)}
        onSuccess={handleSuccess}
        apiKey={apiKey}
      />
      <DCADialog
        open={openDialog === 'dca'}
        onOpenChange={(open) => !open && setOpenDialog(null)}
        onSuccess={handleSuccess}
        apiKey={apiKey}
      />
      <TrailingStopDialog
        open={openDialog === 'trailing_stop'}
        onOpenChange={(open) => !open && setOpenDialog(null)}
        onSuccess={handleSuccess}
        apiKey={apiKey}
      />
      <GridDialog
        open={openDialog === 'grid'}
        onOpenChange={(open) => !open && setOpenDialog(null)}
        onSuccess={handleSuccess}
        apiKey={apiKey}
      />

      {/* Detail Modal */}
      <StrategyDetailModal
        strategy={selectedStrategy}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        onUpdate={() => {
          setRefreshTrigger((prev) => prev + 1);
          setSelectedStrategy(null);
        }}
      />
    </div>
  );
}
