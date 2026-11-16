// Runs Communicator on the teacher's laptop, reachable from the school Wi-Fi. Nothing goes online:
// the board, the teacher's buttons and the Fix switch are kept on this laptop in .wrangler/classroom.
//
//   npm run classroom      (classroom.bat runs this)
//
// PORT changes the port (8790, so Pixel Plaza can keep 8787); COMMUNICATOR_LAN_URL overrides the detected address.
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = path.join(import.meta.dirname, '..');
const wrangler = path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const port = Number(process.env.PORT || 8790);

// The school network address: a private IPv4 address, Wi-Fi or cable.
function lanAddress() {
    const addresses = Object.values(os.networkInterfaces()).flat()
        .filter(item => item && item.family === 'IPv4' && !item.internal).map(item => item.address);
    return addresses.find(address => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address)) || addresses[0];
}

// A second copy on the same port starts but never answers, so stop early and say why.
const busy = await new Promise(resolve => {
    const socket = net.connect({ host: '127.0.0.1', port }, () => { socket.destroy(); resolve(true); });
    socket.on('error', () => resolve(false));
    socket.setTimeout(1500, () => { socket.destroy(); resolve(false); });
});
if (busy) {
    console.error(`\n  Port ${port} is already in use. Is Communicator already running in another window?`);
    console.error(`  Close that window (or the program using port ${port}) and start again.\n`);
    process.exit(1);
}

const address = lanAddress();
const lanUrl = process.env.COMMUNICATOR_LAN_URL || (address ? `http://${address}:${port}` : '');

console.log(`
  Communicator is running on this laptop.

  Students open (school Wi-Fi):  ${lanUrl || '(no network found: connect to the school Wi-Fi and restart)'}
  Teacher editor (this laptop):  http://localhost:${port}/create

  The first time, Windows asks whether Node.js may use the network: allow it on private networks.
  Voices need this laptop to be online; without internet each device uses its own voice.
  Keep this window open during the lesson. Ctrl+C stops it.
`);

const child = spawn(process.execPath, [wrangler, 'dev', '--ip', '0.0.0.0', '--port', String(port),
    '--persist-to', path.join(root, '.wrangler', 'classroom'), '--show-interactive-dev-session=false',
    ...(lanUrl ? ['--var', `LAN_URL:${lanUrl}`] : [])], {
    cwd: root, env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, stdio: 'inherit'
});
child.on('exit', code => process.exit(code ?? 0));
