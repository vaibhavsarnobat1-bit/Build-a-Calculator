const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');
const localtunnel = require('localtunnel');

const PORT = 8081;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon'
};

let primaryLiveUrl = '';
let backupLiveUrl = '';
let publicIp = '';
let sshProcess = null;

// 1. Static HTTP File Server
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  let safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(__dirname, safePath === '/' || safePath === '\\' ? 'index.html' : safePath);

  // If path has no extension and doesn't exist, check index.html
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(__dirname, 'index.html');
  }

  let ext = path.extname(filePath).toLowerCase();
  let contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(err.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
      });
      res.end(content);
    }
  });
});

function updateLiveUrlFile() {
  const timeStr = new Date().toLocaleString();
  let content = `=====================================================
 NeoCalc Pro - Live Website Links
=====================================================

1. Primary Live Link (Direct access, no password needed):
   ${primaryLiveUrl || 'Starting...'}

2. Backup Live Link (Localtunnel):
   ${backupLiveUrl || 'Starting...'}
   ${publicIp ? `Tunnel Password (if asked): ${publicIp}` : ''}

3. Local Link (On this PC):
   http://localhost:${PORT}

Status: Active & Online
Last Updated: ${timeStr}
=====================================================
`;
  try {
    fs.writeFileSync(path.join(__dirname, 'LIVE_URL.txt'), content, 'utf8');
  } catch (e) {
    console.error('Error writing LIVE_URL.txt:', e);
  }
}

// Fetch Public IP for Localtunnel password reminder
async function getPublicIp() {
  return new Promise((resolve) => {
    const req = https.get('https://api.ipify.org', { timeout: 5000 }, (resp) => {
      let data = '';
      resp.on('data', (c) => data += c);
      resp.on('end', () => resolve(data.trim()));
    });
    req.on('error', () => resolve(''));
    req.on('timeout', () => { req.destroy(); resolve(''); });
  });
}

// Start SSH Tunnel to localhost.run (Primary, no password needed!)
function startSshTunnel() {
  console.log('[Tunnel] Starting primary tunnel via localhost.run...');
  
  sshProcess = spawn('ssh', [
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'ServerAliveInterval=30',
    '-o', 'ServerAliveCountMax=3',
    '-R', `80:localhost:${PORT}`,
    'nokey@localhost.run'
  ]);

  const handleData = (chunk) => {
    const str = chunk.toString();
    // Look for https://....lhr.life
    const match = str.match(/https:\/\/[a-zA-Z0-9-]+\.lhr\.life/);
    if (match) {
      primaryLiveUrl = match[0];
      console.log('\n=====================================================');
      console.log('>>> PRIMARY LIVE URL (DIRECT ACCESS):', primaryLiveUrl);
      console.log('=====================================================\n');
      updateLiveUrlFile();
    }
  };

  sshProcess.stdout.on('data', handleData);
  sshProcess.stderr.on('data', handleData);

  sshProcess.on('close', (code) => {
    console.log(`[Tunnel] SSH tunnel closed with code ${code}. Reconnecting in 3s...`);
    primaryLiveUrl = '';
    updateLiveUrlFile();
    setTimeout(startSshTunnel, 3000);
  });

  sshProcess.on('error', (err) => {
    console.error('[Tunnel] SSH process error:', err.message);
  });
}

// Start Localtunnel (Backup tunnel)
async function startLocaltunnel() {
  try {
    console.log('[Tunnel] Starting backup tunnel via localtunnel...');
    const tunnel = await localtunnel({ port: PORT });
    backupLiveUrl = tunnel.url;
    console.log('\n-----------------------------------------------------');
    console.log('>>> BACKUP LIVE URL (Localtunnel):', backupLiveUrl);
    if (publicIp) console.log('>>> Localtunnel Password:', publicIp);
    console.log('-----------------------------------------------------\n');
    updateLiveUrlFile();

    tunnel.on('close', () => {
      console.log('[Tunnel] Localtunnel closed. Reconnecting in 5s...');
      backupLiveUrl = '';
      updateLiveUrlFile();
      setTimeout(startLocaltunnel, 5000);
    });

    tunnel.on('error', (err) => {
      console.error('[Tunnel] Localtunnel error:', err);
    });
  } catch (err) {
    console.error('[Tunnel] Localtunnel start failed:', err.message);
  }
}

// Start everything
server.listen(PORT, async () => {
  console.log(`\n=====================================================`);
  console.log(` NeoCalc Pro Server is running on http://localhost:${PORT}`);
  console.log(`=====================================================\n`);

  publicIp = await getPublicIp();
  updateLiveUrlFile();

  startSshTunnel();
  startLocaltunnel();
});

// Clean shutdown
process.on('SIGINT', () => {
  if (sshProcess) sshProcess.kill();
  server.close(() => {
    process.exit(0);
  });
});
process.on('SIGTERM', () => {
  if (sshProcess) sshProcess.kill();
  server.close(() => {
    process.exit(0);
  });
});
