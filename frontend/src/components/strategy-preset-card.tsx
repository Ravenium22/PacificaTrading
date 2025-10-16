'use client';

import { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export type StrategyType = 'twap' | 'dca' | 'grid' | 'trailing_stop';

interface PresetCardProps {
  type: StrategyType;
  title: string;
  description: string;
  icon: LucideIcon;
  onConfigure: () => void;
  disabled?: boolean;
}

const typeColors: Record<StrategyType, string> = {
  twap: 'from-blue-500 to-blue-600',
  dca: 'from-green-500 to-green-600',
  grid: 'from-purple-500 to-purple-600',
  trailing_stop: 'from-orange-500 to-orange-600',
};

const typeBorderColors: Record<StrategyType, string> = {
  twap: 'border-blue-500/50',
  dca: 'border-green-500/50',
  grid: 'border-purple-500/50',
  trailing_stop: 'border-orange-500/50',
};

export function StrategyPresetCard({
  type,
  title,
  description,
  icon: Icon,
  onConfigure,
  disabled = false,
}: PresetCardProps) {
  return (
    <Card
      className={`bg-slate-900/50 backdrop-blur border-2 ${typeBorderColors[type]} p-6 rounded-xl transition-all hover:scale-105 hover:shadow-lg ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      }`}
      onClick={disabled ? undefined : onConfigure}
    >
      <div className="flex flex-col h-full">
        {/* Icon */}
        <div
          className={`w-12 h-12 rounded-lg bg-gradient-to-br ${typeColors[type]} flex items-center justify-center mb-4`}
        >
          <Icon className="w-6 h-6 text-white" />
        </div>

        {/* Content */}
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-slate-100 mb-2">{title}</h3>
          <p className="text-sm text-slate-400 mb-4">{description}</p>
        </div>

        {/* Button */}
        <Button
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) onConfigure();
          }}
          disabled={disabled}
          className={`w-full bg-gradient-to-r ${typeColors[type]} hover:opacity-90`}
        >
          {disabled ? 'Coming Soon' : 'Configure'}
        </Button>
      </div>
    </Card>
  );
}
