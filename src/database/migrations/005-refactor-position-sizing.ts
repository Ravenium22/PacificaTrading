import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  // Add new sizing fields
  await queryInterface.addColumn('copy_relationships', 'sizing_method', {
    type: DataTypes.ENUM('multiplier', 'fixed_usd', 'balance_percent'),
    allowNull: false,
    defaultValue: 'multiplier'
  });

  await queryInterface.addColumn('copy_relationships', 'sizing_value', {
    type: DataTypes.DECIMAL(10, 4),
    allowNull: false,
    defaultValue: 0.5
  });

  await queryInterface.addColumn('copy_relationships', 'max_position_cap', {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    defaultValue: null
  });

  // Migrate existing position_multiplier values to sizing_value
  await queryInterface.sequelize.query(`
    UPDATE copy_relationships
    SET sizing_value = position_multiplier
    WHERE position_multiplier IS NOT NULL
  `);

  console.log('[Migration 005] Migrated position_multiplier to sizing_value');

  // Remove old position_multiplier column
  await queryInterface.removeColumn('copy_relationships', 'position_multiplier');

  console.log('[Migration 005] Refactored position sizing to flexible methods');
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  // Add back position_multiplier column
  await queryInterface.addColumn('copy_relationships', 'position_multiplier', {
    type: DataTypes.DECIMAL(3, 2),
    allowNull: false,
    defaultValue: 0.5
  });

  // Migrate sizing_value back to position_multiplier (only for multiplier method)
  await queryInterface.sequelize.query(`
    UPDATE copy_relationships
    SET position_multiplier = sizing_value
    WHERE sizing_method = 'multiplier' AND sizing_value <= 1.0
  `);

  // Remove new columns
  await queryInterface.removeColumn('copy_relationships', 'max_position_cap');
  await queryInterface.removeColumn('copy_relationships', 'sizing_value');
  await queryInterface.removeColumn('copy_relationships', 'sizing_method');

  console.log('[Migration 005] Rolled back to position_multiplier');
}
