import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('copy_relationships', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    user_wallet: {
      type: DataTypes.STRING,
      allowNull: false
    },
    encrypted_api_key: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    master_wallet: {
      type: DataTypes.STRING,
      allowNull: false
    },
    position_multiplier: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: false,
      defaultValue: 0.5
    },
    symbols: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: '[]'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
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
  });

  // Create indexes for faster lookups
  await queryInterface.addIndex('copy_relationships', ['user_wallet'], {
    name: 'copy_relationships_user_wallet_idx'
  });

  await queryInterface.addIndex('copy_relationships', ['master_wallet'], {
    name: 'copy_relationships_master_wallet_idx'
  });

  await queryInterface.addIndex('copy_relationships', ['is_active'], {
    name: 'copy_relationships_is_active_idx'
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('copy_relationships');
}
