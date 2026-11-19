// Publish the board and its selected pictures together. Keep pending offline edits reachable with a private Git ref.
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { boardImages, LIMITS, sanitizeBoard } from '../shared/board.ts';
import { isUploadedImage, MAX_IMAGE_BYTES, uploadedImageName } from '../shared/images.ts';

const branch = 'refs/heads/main';
const pending = 'refs/communicator/pending-board';
const upstream = 'refs/remotes/origin/main';
const file = 'classroom-board.json';
const imageDir = 'classroom-images';
const stagedImage = name => 'refs/communicator/images/' + name;

export function boardRepository(root) {
    function git(args, input, extraEnv = {}, binary = false) {
        return new Promise((resolve, reject) => {
            const child = execFile('git', args, { cwd: root, timeout: 12_000, maxBuffer: MAX_IMAGE_BYTES + 1024, windowsHide: true, encoding: binary ? 'buffer' : 'utf8',
                env: { ...process.env, ...extraEnv, LC_ALL: 'C', GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' }
            }, (error, stdout, stderr) => error ? reject(Object.assign(error, { gitMessage: stderr })) : resolve(binary ? stdout : stdout.trim()));
            child.stdin.on('error', () => {});
            child.stdin.end(input);
        });
    }
    async function head(ref) {
        try { return await git(['rev-parse', '--verify', '--quiet', ref]); }
        catch (error) { if (error.code === 1) return ''; throw error; }
    }
    let status = 'offline';
    let tail = Promise.resolve();
    function serialize(operation) {
        const next = tail.then(operation);
        tail = next.catch(() => {});
        return next;
    }
    async function mainHead() {
        return await head(upstream) || await head(branch);
    }
    async function boardBlob(commit) {
        if (!commit) return '';
        const entry = await git(['ls-tree', commit, '--', file]);
        return entry ? entry.split(/\s+/)[2] : '';
    }
    async function snapshot(commit) {
        const revision = await boardBlob(commit);
        const board = revision ? sanitizeBoard(JSON.parse(await git(['cat-file', 'blob', revision]))) : null;
        if (revision && !board) throw new Error('Invalid shared board.');
        return { board, revision, sync: status };
    }
    async function imageBlobs(commit) {
        const rows = await git(['ls-tree', '-r', commit, '--', imageDir]);
        const found = new Map();
        for (const row of rows.split('\n')) {
            const [info, filename] = row.split('\t');
            if (filename?.startsWith(imageDir + '/')) found.set(filename.slice(imageDir.length + 1), info.split(' ')[2]);
        }
        return found;
    }
    async function boardCommit(parent, blob, images, source) {
        // A separate index based on the remote tree preserves every unrelated file, even if the teacher
        // has a different branch checked out or changes staged in their own index.
        const dir = await mkdtemp(path.join(tmpdir(), 'communicator-index-'));
        const env = { GIT_INDEX_FILE: path.join(dir, 'index') };
        try {
            await git(['read-tree', parent], undefined, env);
            await git(['update-index', '--add', '--cacheinfo', '100644', blob, file], undefined, env);
            const tracked = await imageBlobs(parent);
            if (tracked.size) {
                const prior = (await snapshot(parent)).board;
                const keep = new Set(images);
                const removed = prior && boardImages(prior).filter(name => !keep.has(name));
                if (removed?.length) {
                    const paths = removed.map(name => `${imageDir}/${name}\n`).join('');
                    await git(['update-index', '--force-remove', '--stdin'], paths, env);
                }
            }
            if (images.length) {
                const known = source === parent ? tracked : await imageBlobs(source);
                const entries = [];
                for (const name of images) {
                    const image = known.get(name) || await head(stagedImage(name));
                    if (!image) throw Object.assign(new Error('A picture is missing. Choose its file again and save.'), { status: 400 });
                    entries.push(`100644 ${image}\t${imageDir}/${name}\n`);
                }
                await git(['update-index', '--index-info'], entries.join(''), env);
            }
            const tree = await git(['write-tree'], undefined, env);
            return await git(['-c', 'user.name=Communicator', '-c', 'user.email=board@communicator.local',
                'commit-tree', tree, '-p', parent, '-m', 'Update classroom board']);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    }
    async function publish(ours, remote) {
        const localBlob = await boardBlob(ours);
        const remoteBlob = await boardBlob(remote);
        if (localBlob !== remoteBlob) {
            const base = await head(ours + '^');
            if (await boardBlob(base) !== remoteBlob) return 'conflict';
            // New code commits can land while a laptop is offline. Replay only the board on top.
            const next = base === remote ? ours : await boardCommit(remote, localBlob, boardImages((await snapshot(ours)).board), ours);
            await git(['push', 'origin', next + ':' + branch]);
        }
        await git(['update-ref', '-d', pending, ours]);
        return 'synced';
    }
    async function reconcile() {
        try {
            await git(['fetch', '--quiet', '--no-tags', '--no-write-fetch-head', 'origin', branch + ':' + upstream]);
            const ours = await head(pending);
            status = ours ? await publish(ours, await head(upstream)) : 'synced';
        } catch {
            status = 'offline';
        }
        return status;
    }
    return {
        putImage: async (name, bytes) => {
            if (!isUploadedImage(name) || await uploadedImageName(bytes) !== name) throw Object.assign(new Error('Invalid image.'), { status: 400 });
            const blob = await git(['hash-object', '-w', '--stdin'], bytes);
            // A private ref keeps an unsaved draft available after a restart, without pushing it.
            await git(['update-ref', stagedImage(name), blob]);
        },
        getImage: async name => {
            if (!isUploadedImage(name)) return null;
            let blob = await head(stagedImage(name));
            if (!blob) {
                const tip = await head(pending) || await mainHead();
                if (tip) blob = await head(`${tip}:${imageDir}/${name}`);
            }
            return blob ? git(['cat-file', 'blob', blob], undefined, {}, true) : null;
        },
        read: async () => snapshot(await head(pending) || await mainHead()),
        refresh: () => serialize(reconcile),
        save: (value, revision, seed = false) => serialize(async () => {
            const board = sanitizeBoard(value);
            if (!board || JSON.stringify(board).length > LIMITS.json) throw Object.assign(new Error('Invalid board.'), { status: 400 });
            await reconcile();
            const previous = await head(pending);
            const tip = previous || await mainHead();
            const current = await snapshot(tip);
            if (seed && (current.board || current.sync !== 'synced')) return current;
            if (status === 'conflict') throw Object.assign(new Error('Both laptops have offline edits. Both versions are kept in Git. See Board sync in the README.'), { status: 409 });
            // A retry after a lost HTTP response is safe, even when the commit already exists.
            if (JSON.stringify(board) === JSON.stringify(current.board)) return current;
            if (revision !== current.revision) throw Object.assign(new Error('The board changed on another computer. Your draft is still here. Reload the shared board before saving.'), { status: 409 });
            const blob = await git(['hash-object', '-w', '--stdin'], JSON.stringify(board, null, 2) + '\n');
            const base = previous ? await head(previous + '^') : tip;
            if (!base) throw new Error('No local or remote main branch.');
            const commit = await boardCommit(base, blob, boardImages(board), tip);
            await git(['update-ref', '--create-reflog', pending, commit, previous]);
            if (status === 'synced') {
                try { status = await publish(commit, await head(upstream)); }
                catch { status = 'offline'; }
            }
            return { board, revision: blob, sync: status };
        })
    };
}

// Only the authenticated teacher endpoint can ask this loopback service to save a board.
export async function startBoardSync(root) {
    const repo = boardRepository(root);
    const secretPath = '/' + randomUUID();
    await repo.refresh();
    const server = createServer(async (request, response) => {
        const reply = (status, body) => {
            response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
            response.end(JSON.stringify(body));
        };
        const imagePath = secretPath + '/images/';
        const name = request.url?.startsWith(imagePath) ? request.url.slice(imagePath.length) : '';
        const image = isUploadedImage(name);
        if (request.url !== secretPath && !image) return reply(404, {});
        try {
            if (request.method === 'GET') {
                if (!image) return reply(200, await repo.read());
                const data = await repo.getImage(name);
                if (!data) return reply(404, { error: 'Image not found.' });
                response.writeHead(200, { 'Content-Type': 'application/octet-stream' });
                return response.end(data);
            }
            if (request.method !== (image ? 'PUT' : 'POST')) return reply(405, {});
            const chunks = [];
            let size = 0;
            const max = image ? MAX_IMAGE_BYTES : LIMITS.json * 4 + 1024;
            for await (const chunk of request) {
                size += chunk.length;
                if (size > max) return reply(413, { error: 'Request is too large.' });
                chunks.push(chunk);
            }
            const data = Buffer.concat(chunks);
            if (image) { await repo.putImage(name, data); return reply(200, { name }); }
            const { board, revision, seed } = JSON.parse(data.toString('utf8'));
            reply(200, await repo.save(board, revision, seed === true));
        } catch (error) {
            reply(error.status || 503, { error: error.status ? error.message : 'Could not access the Git board. Check Git on this laptop and try again.' });
        }
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const timer = setInterval(() => { void repo.refresh().catch(() => {}); }, 60_000);
    return { url: 'http://127.0.0.1:' + server.address().port + secretPath, close() { clearInterval(timer); server.close(); } };
}
