import dotenv from 'dotenv';
import { connectDatabase, syncDatabase } from '../database/config';
import Trader from '../database/models/Trader';

dotenv.config();

async function testDatabaseOperations() {
  console.log('=== Database CRUD Test ===\n');

  try {
    // 1. Connect to database
    console.log('1. Connecting to database...');
    await connectDatabase();
    console.log('✓ Connected successfully\n');

    // 2. Sync models (create tables)
    console.log('2. Syncing database models...');
    await syncDatabase();
    console.log('✓ Models synced\n');

    // 3. CREATE - Insert a new trader
    console.log('3. Creating new trader...');
    const testWallet = `test_wallet_${Date.now()}`;
    const newTrader = await Trader.create({
      wallet_address: testWallet,
      is_approved: false
    });
    console.log('✓ Trader created:', {
      id: newTrader.id,
      wallet_address: newTrader.wallet_address,
      is_approved: newTrader.is_approved,
      created_at: newTrader.created_at
    });
    console.log('');

    // 4. READ - Find the trader
    console.log('4. Reading trader from database...');
    const foundTrader = await Trader.findOne({
      where: { wallet_address: testWallet }
    });
    console.log('✓ Trader found:', foundTrader?.toJSON());
    console.log('');

    // 5. UPDATE - Approve the trader
    console.log('5. Updating trader (approving)...');
    if (foundTrader) {
      foundTrader.is_approved = true;
      await foundTrader.save();
      console.log('✓ Trader updated:', {
        id: foundTrader.id,
        is_approved: foundTrader.is_approved
      });
    }
    console.log('');

    // 6. READ ALL - List all traders
    console.log('6. Reading all traders...');
    const allTraders = await Trader.findAll();
    console.log(`✓ Found ${allTraders.length} trader(s)`);
    allTraders.forEach((trader, index) => {
      console.log(`  ${index + 1}. ${trader.wallet_address} (approved: ${trader.is_approved})`);
    });
    console.log('');

    // 7. DELETE - Remove the test trader
    console.log('7. Deleting test trader...');
    if (foundTrader) {
      await foundTrader.destroy();
      console.log('✓ Trader deleted');
    }
    console.log('');

    // 8. Verify deletion
    console.log('8. Verifying deletion...');
    const deletedTrader = await Trader.findOne({
      where: { wallet_address: testWallet }
    });
    if (deletedTrader === null) {
      console.log('✓ Trader successfully deleted (not found in database)');
    } else {
      console.log('✗ Error: Trader still exists!');
    }
    console.log('');

    // 9. Test unique constraint
    console.log('9. Testing unique constraint...');
    const uniqueWallet = `unique_test_${Date.now()}`;
    await Trader.create({ wallet_address: uniqueWallet });
    console.log('✓ First trader with unique wallet created');

    try {
      await Trader.create({ wallet_address: uniqueWallet });
      console.log('✗ Error: Duplicate wallet should have failed!');
    } catch (error: any) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        console.log('✓ Unique constraint working (duplicate wallet rejected)');
      } else {
        console.log('✗ Unexpected error:', error.message);
      }
    }

    // Cleanup
    await Trader.destroy({ where: { wallet_address: uniqueWallet } });
    console.log('✓ Test data cleaned up\n');

    console.log('=== All Tests Passed ===');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Test failed with error:', error);
    process.exit(1);
  }
}

testDatabaseOperations();
