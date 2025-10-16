import { sequelize } from './config';
import { up as createTradersTable, down as dropTradersTable } from './migrations/001-create-traders-table';
import { up as addApprovalFields, down as removeApprovalFields } from './migrations/002-add-approval-fields';
import { up as createCopyRelationshipsTable } from './migrations/003-create-copy-relationships-table';
import { up as addAdvancedControls } from './migrations/004-add-advanced-controls';
import { up as refactorPositionSizing } from './migrations/005-refactor-position-sizing';
import { up as createStrategiesTable } from './migrations/006-create-strategies-table';

async function runMigrations() {
  try {
    console.log('[Migration] Connecting to database...');
    await sequelize.authenticate();

    const queryInterface = sequelize.getQueryInterface();

    // Check if traders table exists
    const tables = await queryInterface.showAllTables();
    const tradersExists = tables.includes('traders');

    if (!tradersExists) {
      console.log('[Migration] Running migration: 001-create-traders-table');
      await createTradersTable(queryInterface);
    } else {
      console.log('[Migration] Skipping 001-create-traders-table (already exists)');
    }

    // Check if approval fields exist
    const tableDescription = await queryInterface.describeTable('traders');
    const hasApprovalFields = 'requested_at' in tableDescription;

    if (!hasApprovalFields) {
      console.log('[Migration] Running migration: 002-add-approval-fields');
      await addApprovalFields(queryInterface);
    } else {
      console.log('[Migration] Skipping 002-add-approval-fields (already exists)');
    }

    // Check if copy_relationships table exists
    const copyRelationshipsExists = tables.includes('copy_relationships');

    if (!copyRelationshipsExists) {
      console.log('[Migration] Running migration: 003-create-copy-relationships-table');
      await createCopyRelationshipsTable(queryInterface);
    } else {
      console.log('[Migration] Skipping 003-create-copy-relationships-table (already exists)');
    }

    // Check if advanced controls exist
    if (copyRelationshipsExists) {
      const copyRelDescription = await queryInterface.describeTable('copy_relationships');
      const hasAdvancedControls = 'custom_leverage' in copyRelDescription;

      if (!hasAdvancedControls) {
        console.log('[Migration] Running migration: 004-add-advanced-controls');
        await addAdvancedControls(queryInterface);
      } else {
        console.log('[Migration] Skipping 004-add-advanced-controls (already exists)');
      }

      // Check if position sizing refactor has been applied
      const hasSizingMethod = 'sizing_method' in copyRelDescription;

      if (!hasSizingMethod) {
        console.log('[Migration] Running migration: 005-refactor-position-sizing');
        await refactorPositionSizing(queryInterface);
      } else {
        console.log('[Migration] Skipping 005-refactor-position-sizing (already exists)');
      }
    }

    // Check if strategies table exists
    const strategiesExists = tables.includes('strategies');

    if (!strategiesExists) {
      console.log('[Migration] Running migration: 006-create-strategies-table');
      await createStrategiesTable(queryInterface);
    } else {
      console.log('[Migration] Skipping 006-create-strategies-table (already exists)');
    }

    console.log('[Migration] All migrations completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('[Migration] Error:', error);
    process.exit(1);
  }
}

async function rollbackMigrations() {
  try {
    console.log('[Rollback] Connecting to database...');
    await sequelize.authenticate();

    const queryInterface = sequelize.getQueryInterface();

    console.log('[Rollback] Rolling back: 002-add-approval-fields');
    await removeApprovalFields(queryInterface);

    console.log('[Rollback] Rolling back: 001-create-traders-table');
    await dropTradersTable(queryInterface);

    console.log('[Rollback] All migrations rolled back successfully');
    process.exit(0);
  } catch (error) {
    console.error('[Rollback] Error:', error);
    process.exit(1);
  }
}

const command = process.argv[2];

if (command === 'up') {
  runMigrations();
} else if (command === 'down') {
  rollbackMigrations();
} else {
  console.log('Usage: ts-node src/database/migrate.ts [up|down]');
  process.exit(1);
}
