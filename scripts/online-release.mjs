import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { ONLINE_BOARD_URL } from '../shared/options.ts';
const exec = promisify(execFile);
const root = path.join(import.meta.dirname, '..');
const manifest = path.join(root, 'dist', 'release.json');
const inputs = ['src', 'worker', 'shared', 'bliss-symbols', 'scene-symbols', 'mulberry-symbols', 'own-symbols',
    'index.html', 'package.json', 'package-lock.json', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json',
    'tsconfig.worker.json', 'vite.config.ts', 'wrangler.jsonc', 'scripts/online-release.mjs'];
const git = async args => (await exec('git', args, { cwd: root, windowsHide: true, timeout: 15_000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' } })).stdout.trim();

async function fingerprint(ref) {
    // A top-level tree ID covers every nested file, including all the symbol SVGs.
    const tree = await git(['ls-tree', ref, '--', ...inputs]);
    return createHash('sha256').update(tree).digest('hex');
}

async function checkoutRelease() {
    if (await git(['status', '--porcelain', '--untracked-files=all', '--', ...inputs])) return null;
    return fingerprint('HEAD');
}

async function stamp() {
    const release = await checkoutRelease().catch(() => null);
    await writeFile(manifest, JSON.stringify({ release }) + '\n');
}

// A signed-in laptop publishes the same build it is starting for class. Never roll back the
// online board from an older checkout or publish a developer's draft. Board-only Git commits
// have the same fingerprint and take the separate, live board-sync path.
export async function publishClassroomRelease() {
    const { release } = JSON.parse(await readFile(manifest, 'utf8'));
    if (!release || await git(['branch', '--show-current']) !== 'main') return;
    const remote = await git(['remote', 'get-url', 'origin']);
    if (!/^(?:https:\/\/github\.com\/|git@github\.com:)audiophrases\/Communicator(?:\.git)?$/i.test(remote)) return;
    const response = await fetch(ONLINE_BOARD_URL + '/release.json', { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    if (response.ok && (await response.json().catch(() => null))?.release === release) return;
    const [tip] = (await git(['ls-remote', '--exit-code', 'origin', 'refs/heads/main'])).split(/\s+/);
    if (release !== await fingerprint(tip) || release !== await checkoutRelease()) return;
    console.log('Publishing this classroom release to ' + ONLINE_BOARD_URL);
    const wrangler = path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
    await exec(process.execPath, [wrangler, 'deploy', '--env', 'online'], {
        cwd: root, timeout: 240_000, windowsHide: true, env: { ...process.env, CI: 'true' }
    });
    console.log('Online classroom release published.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href && process.argv[2] === 'stamp') await stamp();
