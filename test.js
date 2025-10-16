const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:aZmhixZrkUunIYHwZdrLzzsiyhalELsp@mainline.proxy.rlwy.net:13284/railway'
});

client.connect()
  .then(() => {
    console.log('✅ Connected!');
    return client.query('SELECT NOW()');
  })
  .then(res => {
    console.log('✅ Query worked:', res.rows[0]);
    client.end();
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    client.end();
  });