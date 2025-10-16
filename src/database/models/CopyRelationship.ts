import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config';

interface CopyRelationshipAttributes {
  id: number;
  user_wallet: string;
  encrypted_api_key: string;
  master_wallet: string;
  sizing_method: 'multiplier' | 'fixed_usd' | 'balance_percent';
  sizing_value: number;
  max_position_cap: number | null;
  symbols: string[];
  is_active: boolean;
  custom_leverage: number | null;
  max_total_exposure: number | null;
  symbol_multipliers: Record<string, number> | null;
  created_at: Date;
  updated_at: Date;
}

interface CopyRelationshipCreationAttributes
  extends Optional<CopyRelationshipAttributes, 'id' | 'symbols' | 'is_active' | 'custom_leverage' | 'max_total_exposure' | 'symbol_multipliers' | 'max_position_cap' | 'created_at' | 'updated_at'> {}

export class CopyRelationship
  extends Model<CopyRelationshipAttributes, CopyRelationshipCreationAttributes>
  implements CopyRelationshipAttributes {
  public id!: number;
  public user_wallet!: string;
  public encrypted_api_key!: string;
  public master_wallet!: string;
  public sizing_method!: 'multiplier' | 'fixed_usd' | 'balance_percent';
  public sizing_value!: number;
  public max_position_cap!: number | null;
  public symbols!: string[];
  public is_active!: boolean;
  public custom_leverage!: number | null;
  public max_total_exposure!: number | null;
  public symbol_multipliers!: Record<string, number> | null;
  public created_at!: Date;
  public updated_at!: Date;
}

CopyRelationship.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    user_wallet: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    encrypted_api_key: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    master_wallet: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    sizing_method: {
      type: DataTypes.ENUM('multiplier', 'fixed_usd', 'balance_percent'),
      allowNull: false,
      defaultValue: 'multiplier'
    },
    sizing_value: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: false,
      defaultValue: 0.5,
      validate: {
        min: 0.01
      }
    },
    max_position_cap: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      defaultValue: null,
      validate: {
        min: 0
      }
    },
    symbols: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: []
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    custom_leverage: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      validate: {
        min: 1,
        max: 50
      }
    },
    max_total_exposure: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      defaultValue: null,
      validate: {
        min: 0
      }
    },
    symbol_multipliers: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    sequelize,
    tableName: 'copy_relationships',
    underscored: true,
    timestamps: true
  }
);

export default CopyRelationship;
