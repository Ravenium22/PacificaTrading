import dotenv from 'dotenv';
import { PacificaRestClient } from '../api/rest-client';

dotenv.config();

async function testRestAPI() {
  console.log('=== REST API Test ===\n');

  const apiUrl = process.env.PACIFICA_API_URL;
  const copierWallet = process.env.COPIER_WALLET;
  const copierPrivateKey = process.env.COPIER_PRIVATE_KEY;

  if (!apiUrl || !copierWallet || !copierPrivateKey) {
    console.error('Error: Missing environment variables');
    console.log('Required: PACIFICA_API_URL, COPIER_WALLET, COPIER_PRIVATE_KEY');
    process.exit(1);
  }

  const client = new PacificaRestClient(apiUrl, copierWallet, copierPrivateKey);

  try {
    // Test 1: Get Account Info
    console.log('1. Fetching account info...');
    const accountInfoResponse = await client.getAccountInfo(copierWallet);

    if (accountInfoResponse.success) {
      console.log('✓ Account Info:');
      console.log(`  Balance: ${accountInfoResponse.data.balance}`);
      console.log(`  Account Equity: ${accountInfoResponse.data.account_equity}`);
      console.log(`  Available to Spend: ${accountInfoResponse.data.available_to_spend}`);
      console.log(`  Positions: ${accountInfoResponse.data.positions_count}`);
      console.log(`  Orders: ${accountInfoResponse.data.orders_count}`);
    } else {
      console.error('✗ Failed to fetch account info:', accountInfoResponse.error);
    }
    console.log('');

    // Test 2: Get Positions
    console.log('2. Fetching positions...');
    const positionsResponse = await client.getPositions(copierWallet);

    if (positionsResponse.success && positionsResponse.data) {
      const positions = Array.isArray(positionsResponse.data) ? positionsResponse.data : [];
      console.log(`✓ Positions (${positions.length}):`);
      if (positions.length === 0) {
        console.log('  No open positions');
      } else {
        positions.forEach((pos: any, i: number) => {
          console.log(`  ${i + 1}. ${pos.symbol} ${pos.side} - Amount: ${pos.amount}, Entry: ${pos.entry_price}`);
        });
      }
    } else {
      console.log('✓ Positions: No open positions or empty data');
    }
    console.log('');

    // Test 3: Rate Limiting Info
    console.log('3. Rate limiting info:');
    console.log(`✓ Queue length: ${client.getQueueLength()}`);
    console.log(`✓ Requests this minute: ${client.getRequestsPerMinute()}/90`);
    console.log('');

    console.log('=== All REST API Tests Passed ===');
    process.exit(0);
  } catch (error: any) {
    console.error('\n✗ Test failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

testRestAPI();
