// Run by classroom.bat on every start; it only does something when .dev.vars is incomplete.
// The teacher password and OpenAI key are the same as in HelloChat and Pixel Plaza, so they are copied from
// one of those folders next to this one when possible, and asked for once otherwise. .dev.vars is not in git.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(import.meta.dirname, '..');
const file = path.join(root, '.dev.vars');

// Typed characters show as *, as in a password box.
function askHidden(question) {
    return new Promise(resolve => {
        const stdin = process.stdin;
        process.stdout.write(question);
        stdin.setRawMode(true);
        stdin.setEncoding('utf8');
        stdin.resume();
        let value = '';
        const onData = chunk => {
            for (const character of chunk) {
                if (character === '\u0003') process.exit(1); // Ctrl+C
                if (character === '\r' || character === '\n') {
                    stdin.setRawMode(false);
                    stdin.pause();
                    stdin.off('data', onData);
                    process.stdout.write('\n');
                    return resolve(value);
                }
                if (character === '\b' || character === '\u007f') {
                    if (value) { value = value.slice(0, -1); process.stdout.write('\b \b'); }
                    continue;
                }
                value += character;
                process.stdout.write('*');
            }
        };
        stdin.on('data', onData);
    });
}

// The value of NAME= in a .dev.vars text; undefined when there is no such line.
function readVar(text, name) {
    const match = text.match(new RegExp(`^\\s*${name}\\s*=(.*)$`, 'm'));
    return match?.[1].trim().replace(/^(["'])(.*)\1$/, '$2');
}

// NAME from a sibling project's .dev.vars, e.g. HelloChat or Pixel Plaza.
function fromSibling(name, valid = () => true) {
    const parent = path.dirname(root);
    for (const folder of ['HelloChat', 'Pixel Plaza', ...fs.readdirSync(parent)]) {
        const dir = path.join(parent, folder);
        if (dir === root) continue;
        try {
            const value = readVar(fs.readFileSync(path.join(dir, '.dev.vars'), 'utf8'), name);
            if (value && valid(value)) return { value, from: folder };
        } catch { /* no .dev.vars there */ }
    }
    return null;
}

const add = line => {
    const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '# Made by classroom.bat. Not in git: it holds secrets.\n';
    fs.writeFileSync(file, `${text}${text.endsWith('\n') ? '' : '\n'}${line}\n`);
};
const current = name => fs.existsSync(file) ? readVar(fs.readFileSync(file, 'utf8'), name) : undefined;

if (!current('CREATE_PASSWORD_HASH')) {
    const found = fromSibling('CREATE_PASSWORD_HASH', value => /^[0-9a-f]{64}$/i.test(value));
    if (found) {
        add(`CREATE_PASSWORD_HASH=${found.value}`);
        console.log(`Teacher password: the same as ${found.from}.`);
    } else {
        console.log('\nFirst time on this laptop. Choose the teacher password for /create: use the same');
        console.log('one as PinPlay. It is saved only as a hash, in .dev.vars.\n');
        let password = '';
        for (;;) {
            password = (await askHidden('Teacher password: ')).trim();
            if (!password) { console.log('The password cannot be empty.'); continue; }
            if ((await askHidden('Type it again:    ')).trim() === password) break;
            console.log('The two did not match. Try again.\n');
        }
        add(`CREATE_PASSWORD_HASH=${crypto.createHash('sha256').update(password.normalize('NFC')).digest('hex')}`);
        console.log('Saved.\n');
    }
}

// An OPENAI_API_KEY line that is present but empty means "asked, and the teacher chose to run without Fix".
if (current('OPENAI_API_KEY') === undefined) {
    const found = fromSibling('OPENAI_API_KEY');
    if (found) {
        add(`OPENAI_API_KEY=${found.value}`);
        console.log(`Fix (AI): using the OpenAI key from ${found.from}.`);
    } else if (process.stdin.isTTY) {
        console.log('\nFix corrects students\' sentences with OpenAI. Paste a key (it starts with sk-) and press Enter,');
        console.log('or just press Enter to run without Fix. Right-click pastes.\n');
        const key = (await askHidden('OpenAI key: ')).trim();
        add(`OPENAI_API_KEY=${key}`);
        console.log(key ? 'Fix is set up.\n' : 'Running without Fix. To add a key later, fill in OPENAI_API_KEY= in .dev.vars.\n');
    }
}
