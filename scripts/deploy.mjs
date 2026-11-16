// Tests, builds and publishes Communicator to Cloudflare, sending the secrets from .dev.vars with it:
// the OpenAI key, the teacher password for /create (same as PinPlay's), and ACCESS_CODE if there is one.
// Secrets already online stay online when .dev.vars leaves them out.
//
//   node scripts/deploy.mjs             (deploy.bat runs this)
//   node scripts/deploy.mjs --dry-run   (everything except the upload)

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.join(import.meta.dirname, '..');
const wrangler = path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const dryRun = process.argv.includes('--dry-run');
const SECRETS = ['OPENAI_API_KEY', 'CREATE_PASSWORD_HASH', 'ACCESS_CODE'];

function step(title, command, args, options = {}) {
    console.log(`\n== ${title}`);
    const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', ...options });
    if (result.status !== 0) {
        console.error(`\n${title} failed.`);
        process.exit(1);
    }
}

function readVars(file) {
    const vars = {};
    if (!fs.existsSync(file)) return vars;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        const match = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
        if (match) vars[match[1]] = match[2].replace(/^(["'])(.*)\1$/, '$2');
    }
    return vars;
}

const vars = readVars(path.join(root, '.dev.vars'));
const secrets = Object.fromEntries(SECRETS.filter(name => vars[name]).map(name => [name, vars[name]]));
if (secrets.CREATE_PASSWORD_HASH && !/^[0-9a-f]{64}$/i.test(secrets.CREATE_PASSWORD_HASH)) {
    console.error('CREATE_PASSWORD_HASH in .dev.vars is not a SHA-256 hash (64 hex characters). See .dev.vars.example.');
    process.exit(1);
}

step('Testing', process.execPath, ['--test', 'worker/tests/*.test.mjs']);
step('Building', 'npm', ['run', 'build'], { shell: true });

// The secrets go in a file only this user can read, deleted straight after.
const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'communicator-'));
const secretsFile = path.join(folder, 'secrets.json');
try {
    fs.writeFileSync(secretsFile, JSON.stringify(secrets), { mode: 0o600 });
    console.log(`\nSending with the code: ${Object.keys(secrets).join(', ') || 'no secrets (the ones online stay as they are)'}`);
    step(dryRun ? 'Checking (dry run, nothing is uploaded)' : 'Deploying', process.execPath,
        [wrangler, 'deploy', '--secrets-file', secretsFile, ...(dryRun ? ['--dry-run'] : [])],
        { env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } });
} finally {
    fs.rmSync(folder, { recursive: true, force: true });
}
if (dryRun) process.exit(0);

// What is set online now, including secrets set earlier.
const list = spawnSync(process.execPath, [wrangler, 'secret', 'list', '--format', 'json'], { cwd: root, encoding: 'utf8' });
let online = [];
try { online = JSON.parse(list.stdout).map(secret => secret.name); } catch { /* the summary is only a help */ }
if (online.length || list.status === 0) {
    const has = name => online.includes(name);
    console.log('\nOnline:');
    console.log(`  ${has('OPENAI_API_KEY') ? 'yes' : 'NO '}  OpenAI key: Fix and the natural voice${has('OPENAI_API_KEY') ? '' : ' are off. Add OPENAI_API_KEY to .dev.vars and deploy again'}`);
    console.log(`  ${has('CREATE_PASSWORD_HASH') ? 'yes' : 'NO '}  Teacher password for /create${has('CREATE_PASSWORD_HASH') ? '' : '. Add CREATE_PASSWORD_HASH to .dev.vars and deploy again'}`);
    console.log(`  ${has('ACCESS_CODE') ? 'yes' : 'no '}  Access code${has('ACCESS_CODE') ? ': people type it once in Settings' : ': anyone with the link can use Fix and the voice (40 a minute each). To require one: npx wrangler secret put ACCESS_CODE'}`);
}
