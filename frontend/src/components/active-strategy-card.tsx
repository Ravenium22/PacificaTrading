'use client';

import { useState } from 'react';
import { Strategy } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Clock, Calendar, Grid3x3, TrendingUp, AlertCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface ActiveStrategyCardProps {
  strategy: Strategy;
  onToggleActive: (id: string, currentActive: boolean) => void;
  onDelete: (id: string) => void;
  onViewDetails: (strategy: Strategy) => void;
}

const strategyIcons: Record<string, LucideIcon> = {
  twap: Clock,
  dca: Calendar,
  grid: Grid3x3,
  trailing_stop: TrendingUp,
};

const strategyColors: Record<string, { bg: string; text: string; border: string }> = {
  twap: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/50' },
  dca: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/50' },
  grid: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/50' },
  trailing_stop: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/50' },
};

const strategyNames: Record<string, string> = {
  twap: 'TWAP',
  dca: 'DCA',
  grid: 'Grid',
  trailing_stop: 'Trailing Stop',
};

export function ActiveStrategyCard({ strategy, onToggleActive, onDelete, onViewDetails }: ActiveStrategyCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const Icon = strategyIcons[strategy.strategyType] || Clock;
  const colors = strategyColors[strategy.strategyType];
  const name = strategyNames[strategy.strategyType] || strategy.strategyType;

  const getConfigSummary = () => {
    const config = strategy.config;
    switch (strategy.strategyType) {
      case 'twap':
        return `${'duration_minutes' in config ? (config.duration_minutes / 60) : 0}h duration, ${'interval_minutes' in config ? config.interval_minutes : 0}m intervals`;
      case 'dca':
        return `$${'buy_amount' in config ? config.buy_amount : 0} every ${'frequency_hours' in config ? config.frequency_hours : 0}h`;
      case 'grid':
        return `${'grid_levels' in config ? config.grid_levels : 0} levels, $${'lower_price' in config ? config.lower_price : 0}-$${'upper_price' in config ? config.upper_price : 0}`;
      case 'trailing_stop':
        return `${'trail_percent' in config ? config.trail_percent : 0}% trail from $${'trigger_price' in config ? config.trigger_price : 0}`;
      default:
        return '';
    }
  };

  const getStatusBadge = () => {
    if (strategy.completedAt) {
      return (
        <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/50">
          Completed
        </Badge>
      );
    }

    if (strategy.errorCount >= 3) {
      return (
        <Badge className="bg-red-500/20 text-red-400 border-red-500/50">
          <AlertCircle className="w-3 h-3 mr-1" />
          Error
        </Badge>
      );
    }

    if (strategy.isActive) {
      return (
        <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
          <span className="flex items-center">
            <span className="w-2 h-2 rounded-full bg-green-400 mr-1.5 animate-pulse" />
            Active
          </span>
        </Badge>
      );
    }

    return (
      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50">
        Paused
      </Badge>
    );
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this strategy? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete(strategy.id);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="bg-slate-900/50 backdrop-blur border-slate-800 p-6 rounded-xl hover:border-slate-700 transition-colors">
      <div className="flex items-start justify-between mb-4">
        {/* Left: Strategy Info */}
        <div className="flex items-start gap-3 flex-1">
          {/* Icon */}
          <div className={`w-10 h-10 rounded-lg ${colors.bg} border ${colors.border} flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-5 h-5 ${colors.text}`} />
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h4 className="text-lg font-semibold text-slate-100">{name}</h4>
              <Badge variant="outline" className="text-xs">
                {strategy.symbol}
              </Badge>
              {getStatusBadge()}
            </div>
            <p className="text-sm text-slate-400 mb-2">{getConfigSummary()}</p>
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2 ml-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Active</span>
            <Switch
              checked={strategy.isActive}
              onCheckedChange={() => onToggleActive(strategy.id, strategy.isActive)}
              disabled={!!strategy.completedAt}
            />
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-slate-400">Progress</span>
          <span className="text-slate-300 font-medium">
            ${strategy.executedAmount.toFixed(2)} / ${strategy.totalAmount.toFixed(2)} ({strategy.progress.toFixed(1)}%)
          </span>
        </div>
        <Progress value={strategy.progress} className="h-2" />
      </div>

      {/* Error Message */}
      {strategy.lastError && (
        <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 p-3">
          <p className="text-xs text-red-400">
            <AlertCircle className="w-3 h-3 inline mr-1" />
            {strategy.lastError}
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onViewDetails(strategy)}
          className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
        >
          View Details
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDelete}
          disabled={isDeleting}
          className="border-red-500/50 text-red-400 hover:bg-red-500/10"
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </Button>
      </div>
    </Card>
  );
}
