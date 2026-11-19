// Runs Communicator on the teacher's laptop, with the shared board synced through Git.
//
//   npm run classroom      (classroom.bat runs this)
//
// PORT changes the port (8790, so Pixel Plaza can keep 8787); COMMUNICATOR_LAN_URL overrides the detected address.
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { startBoardSync } from './board-sync.mjs';
import { publishClassroomRelease } from './online-release.mjs';
import { ONLINE_BOARD_URL } from '../shared/options.ts';

const root = path.join(import.meta.dirname, '..');
const wrangler = path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const dev = process.argv.includes('--dev');
const port = Number(process.env.PORT || (dev ? 8787 : 8790));

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

const address = dev ? '' : lanAddress();
const lanUrl = process.env.COMMUNICATOR_LAN_URL || (address ? `http://${address}:${port}` : '');

console.log(`
  Communicator is running on this laptop.

  Students open (school Wi-Fi):  ${lanUrl || '(no network found: connect to the school Wi-Fi and restart)'}
  Students open (always online): ${ONLINE_BOARD_URL}
  Teacher editor (this laptop):  http://localhost:${port}/create

  The first time, Windows asks whether Node.js may use the network: allow it on private networks.
  Voices need this laptop to be online; without internet each device uses its own voice.
  Keep this window open during the lesson. Ctrl+C stops it.
`);

const sync = await startBoardSync(root);
let publishRetry;
async function publish() {
    try { await publishClassroomRelease(); }
    catch {
        console.warn('Could not check or publish the online app release. The classroom is available. Retrying in five minutes.');
        publishRetry = setTimeout(publish, 300_000);
    }
}
if (!dev) void publish();
const child = spawn(process.execPath, [wrangler, 'dev', '--ip', dev ? '127.0.0.1' : '0.0.0.0', '--port', String(port),
    ...(!dev ? ['--persist-to', path.join(root, '.wrangler', 'classroom')] : []), '--show-interactive-dev-session=false',
    '--var', `BOARD_SYNC_URL:${sync.url}`,
    ...(lanUrl ? ['--var', `LAN_URL:${lanUrl}`] : [])], {
    cwd: root, env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, stdio: 'inherit'
});
child.on('exit', code => { clearTimeout(publishRetry); sync.close(); process.exit(code ?? 0); });
