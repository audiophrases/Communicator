import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { uploadedImageName } from '../../shared/images.ts';
import { readPublishedBoard, readPublishedImage } from '../published.ts';

test('the hosted mirror reports the same Git revision as the laptop for a UTF-8 board', async t => {
    const board = { core: [{ w: 'tree', k: 'noun', e: '🌳', ca: 'arbre' }], pages: [], quick: [] };
    const file = JSON.stringify(board, null, 2) + '\n';
    t.mock.method(globalThis, 'fetch', url => {
        assert.equal(new URL(url).pathname, '/school/board/main/classroom-board.json');
        return Promise.resolve(new Response(file));
    });
    const revision = createHash('sha1').update(`blob ${Buffer.byteLength(file)}\0`).update(file).digest('hex');
    assert.deepEqual(await readPublishedBoard('school/board'), { board, revision });
});

test('only a valid published board can replace the stored copy', async t => {
    const request = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 503 }));
    await assert.rejects(readPublishedBoard('school/board'), /unavailable/);
    request.mock.mockImplementation(async () => Response.json({ error: 'try again' }));
    await assert.rejects(readPublishedBoard('school/board'), /Invalid published board/);
});

test('hosted pictures match the name uploaded on the laptop, including after a failed lookup', async t => {
    const bytes = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>');
    const name = await uploadedImageName(bytes);
    const request = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 404 }));
    assert.equal(await readPublishedImage('school/board', '../draft'), null);
    assert.equal(request.mock.callCount(), 0);
    assert.equal(await readPublishedImage('school/board', name), null);
    request.mock.mockImplementation(async () => new Response('<svg/>'));
    await assert.rejects(readPublishedImage('school/board', name), /Invalid published picture/);
    request.mock.mockImplementation(async () => new Response(bytes));
    assert.deepEqual(Buffer.from(await readPublishedImage('school/board', name)), bytes);
});
