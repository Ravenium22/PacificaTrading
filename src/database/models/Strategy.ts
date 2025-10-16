import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config';

// Strategy configuration types
export interface TWAPConfig {
  duration_minutes: number;
  interval_minutes: number;
}

export interface DCAConfig {
  buy_amount: number;
  frequency_hours: number;
  next_execution?: Date;
}

export interface GridConfig {
  lower_price: number;
  upper_price: number;
  grid_levels: number;
  orders?: Array<{ price: number; size: number; side: 'buy' | 'sell'; orderId?: string }>;
}

export interface TrailingStopConfig {
  trigger_price: number;
  trail_percent: number;
  highest_price?: number;
  triggered?: boolean;
}

export type StrategyConfig = TWAPConfig | DCAConfig | GridConfig | TrailingStopConfig;

export interface StrategyAttributes {
  id: number;
  user_wallet: string;
  strategy_type: 'twap' | 'dca' | 'grid' | 'trailing_stop';
  symbol: string;
  is_active: boolean;
  total_amount: number; // total USD to deploy
  executed_amount: number; // how much executed so far
  config: StrategyConfig;
  api_key_encrypted: string; // encrypted API key for executing trades
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
  last_execution?: Date;
  error_count: number;
  last_error?: string;
}

export interface StrategyCreationAttributes extends Optional<StrategyAttributes, 'id' | 'executed_amount' | 'is_active' | 'created_at' | 'updated_at' | 'completed_at' | 'last_execution' | 'error_count' | 'last_error'> {}

export class Strategy extends Model<StrategyAttributes, StrategyCreationAttributes> implements StrategyAttributes {
  public id!: number;
  public user_wallet!: string;
  public strategy_type!: 'twap' | 'dca' | 'grid' | 'trailing_stop';
  public symbol!: string;
  public is_active!: boolean;
  public total_amount!: number;
  public executed_amount!: number;
  public config!: StrategyConfig;
  public api_key_encrypted!: string;
  public created_at!: Date;
  public updated_at!: Date;
  public completed_at?: Date;
  public last_execution?: Date;
  public error_count!: number;
  public last_error?: string;

  // Helper methods
  public getRemainingAmount(): number {
    return this.total_amount - this.executed_amount;
  }

  public getProgress(): number {
    if (this.total_amount === 0) return 0;
    return (this.executed_amount / this.total_amount) * 100;
  }

  public isCompleted(): boolean {
    return this.executed_amount >= this.total_amount;
  }

  public shouldPause(): boolean {
    return this.error_count >= 3;
  }
}

Strategy.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_wallet: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    strategy_type: {
      type: DataTypes.ENUM('twap', 'dca', 'grid', 'trailing_stop'),
      allowNull: false,
    },
    symbol: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    total_amount: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      validate: {
        min: 10, // Minimum $10
      },
    },
    executed_amount: {
      type: DataTypes.DECIMAL(20, 8),
      defaultValue: 0,
    },
    config: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    api_key_encrypted: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_execution: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    error_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    last_error: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'strategies',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['user_wallet'],
      },
      {
        fields: ['is_active'],
      },
      {
        fields: ['strategy_type'],
      },
    ],
  }
);

// Execution history model for tracking individual trades
export interface ExecutionAttributes {
  id: number;
  strategy_id: number;
  executed_at: Date;
  symbol: string;
  side: 'buy' | 'sell';
  size: number;
  price: number;
  amount: number; // USD value
  order_id?: string;
  status: 'pending' | 'open' | 'filled' | 'failed' | 'cancelled';
  error?: string;
}

export interface ExecutionCreationAttributes extends Optional<ExecutionAttributes, 'id' | 'executed_at' | 'status' | 'error' | 'order_id'> {}

export class Execution extends Model<ExecutionAttributes, ExecutionCreationAttributes> implements ExecutionAttributes {
  public id!: number;
  public strategy_id!: number;
  public executed_at!: Date;
  public symbol!: string;
  public side!: 'buy' | 'sell';
  public size!: number;
  public price!: number;
  public amount!: number;
  public order_id?: string;
  public status!: 'pending' | 'open' | 'filled' | 'failed' | 'cancelled';
  public error?: string;
}

Execution.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    strategy_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'strategies',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    executed_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    symbol: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    side: {
      type: DataTypes.ENUM('buy', 'sell'),
      allowNull: false,
    },
    size: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
    },
    price: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
    },
    order_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('pending', 'open', 'filled', 'failed', 'cancelled'),
      defaultValue: 'pending',
    },
    error: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'executions',
    underscored: true,
    timestamps: false,
    indexes: [
      {
        fields: ['strategy_id'],
      },
      {
        fields: ['executed_at'],
      },
    ],
  }
);

// Define associations
Strategy.hasMany(Execution, { foreignKey: 'strategy_id', as: 'executions' });
Execution.belongsTo(Strategy, { foreignKey: 'strategy_id', as: 'strategy' });

export { Strategy as default };
