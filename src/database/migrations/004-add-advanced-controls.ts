import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  // Add custom_leverage column
  await queryInterface.addColumn('copy_relationships', 'custom_leverage', {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null
  });

  // Add max_total_exposure column
  await queryInterface.addColumn('copy_relationships', 'max_total_exposure', {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    defaultValue: null
  });

  // Add symbol_multipliers column
  await queryInterface.addColumn('copy_relationships', 'symbol_multipliers', {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: null
  });

  console.log('[Migration 004] Added advanced control columns to copy_relationships');
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  // Remove columns in reverse order
  await queryInterface.removeColumn('copy_relationships', 'symbol_multipliers');
  await queryInterface.removeColumn('copy_relationships', 'max_total_exposure');
  await queryInterface.removeColumn('copy_relationships', 'custom_leverage');

  console.log('[Migration 004] Removed advanced control columns from copy_relationships');
}
