const net = require('net');

console.log('Server started. Testing connection to postgres...');

function checkPostgres() {
  const client = net.connect({ host: 'postgres', port: 5432 }, () => {
    console.log('Successfully connected to postgres:5432!');
    client.end();
  });

  client.on('error', (err) => {
    console.log('Waiting for postgres:5432...', err.message);
    setTimeout(checkPostgres, 2000);
  });
}

checkPostgres();

setInterval(() => {
  // keep process running
}, 10000);
