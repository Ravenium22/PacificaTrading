import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  // Add requested_at column
  await queryInterface.addColumn('traders', 'requested_at', {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  });

  // Add approved_at column
  await queryInterface.addColumn('traders', 'approved_at', {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null
  });

  // Add notes column
  await queryInterface.addColumn('traders', 'notes', {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.removeColumn('traders', 'requested_at');
  await queryInterface.removeColumn('traders', 'approved_at');
  await queryInterface.removeColumn('traders', 'notes');
}
