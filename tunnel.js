const localtunnel = require('localtunnel');
const fs = require('fs');

(async () => {
  try {
    const tunnel = await localtunnel({ port: 8081 });
    console.log('PUBLIC_LIVE_URL:', tunnel.url);
    fs.writeFileSync('LIVE_URL.txt', tunnel.url, 'utf8');

    tunnel.on('close', () => {
      console.log('Tunnel closed');
    });

    tunnel.on('error', (err) => {
      console.error('Tunnel error:', err);
    });
  } catch (err) {
    console.error('Failed to create tunnel:', err);
  }
})();
