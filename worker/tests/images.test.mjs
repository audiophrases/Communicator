import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boardImages, sanitizeBoard, symbolUrl } from '../../shared/board.ts';
import { imageContentType, imageFormat, MAX_IMAGE_BYTES, uploadedImageName } from '../../shared/images.ts';

test('SVGs with an XML preamble get a stable name usable on core and topic buttons', async () => {
    const svg = Buffer.from('<?xml version="1.0"?><!-- drawing --><!DOCTYPE svg><svg xmlns="http://www.w3.org/2000/svg"/>');
    const name = await uploadedImageName(svg);
    assert.match(name, /^upload_[0-9a-f]{64}\.svg$/);
    assert.equal(await uploadedImageName(svg), name);
    assert.equal(imageContentType(name), 'image/svg+xml');
    assert.equal(symbolUrl(name), '/api/images/' + name);
    const word = { w: 'picture', k: 'noun', s: name };
    const board = sanitizeBoard({ core: [word], pages: [{ id: 'home', name: 'Home', words: [word] }], quick: [] });
    assert.deepEqual(board.core[0], word);
    assert.deepEqual(board.pages[0].words[0], word);
    assert.deepEqual(boardImages(board), [name]);
});

test('only supported image data and permanent picture names survive validation', () => {
    assert.equal(imageFormat(Buffer.from('<html><svg/></html>')), null);
    assert.equal(imageFormat(Buffer.from('<!-- incomplete')), null);
    assert.equal(imageFormat(Buffer.alloc(MAX_IMAGE_BYTES + 1)), null);
    for (const s of ['blob:local-draft', 'https://example.org/photo.jpg', 'upload_bad.png', '../image.svg']) {
        const board = sanitizeBoard({ core: [{ w: 'picture', k: 'noun', s }], pages: [], quick: [] });
        assert.equal(board.core[0].s, undefined);
    }
});
