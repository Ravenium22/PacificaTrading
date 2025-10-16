import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config';

interface TraderAttributes {
  id: number;
  wallet_address: string;
  is_approved: boolean;
  created_at: Date;
  requested_at: Date;
  approved_at: Date | null;
  notes: string | null;
}

interface TraderCreationAttributes extends Optional<TraderAttributes, 'id' | 'is_approved' | 'created_at' | 'requested_at' | 'approved_at' | 'notes'> {}

export class Trader extends Model<TraderAttributes, TraderCreationAttributes> implements TraderAttributes {
  public id!: number;
  public wallet_address!: string;
  public is_approved!: boolean;
  public created_at!: Date;
  public requested_at!: Date;
  public approved_at!: Date | null;
  public notes!: string | null;
}

Trader.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    wallet_address: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true
      }
    },
    is_approved: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    requested_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    approved_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null
    }
  },
  {
    sequelize,
    tableName: 'traders',
    timestamps: false
  }
);

export default Trader;
