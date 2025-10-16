import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  // Create strategies table
  await queryInterface.createTable('strategies', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_wallet: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    strategy_type: {
      type: DataTypes.ENUM('twap', 'dca', 'grid', 'trailing_stop'),
      allowNull: false,
    },
    symbol: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    total_amount: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
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
    },
    last_error: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  });

  // Add indexes
  await queryInterface.addIndex('strategies', ['user_wallet']);
  await queryInterface.addIndex('strategies', ['is_active']);
  await queryInterface.addIndex('strategies', ['strategy_type']);

  // Create executions table
  await queryInterface.createTable('executions', {
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
      type: DataTypes.ENUM('pending', 'filled', 'failed'),
      defaultValue: 'pending',
    },
    error: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  });

  // Add indexes
  await queryInterface.addIndex('executions', ['strategy_id']);
  await queryInterface.addIndex('executions', ['executed_at']);

  console.log('[Migration 006] Created strategies and executions tables');
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('executions');
  await queryInterface.dropTable('strategies');
  console.log('[Migration 006] Dropped strategies and executions tables');
}
