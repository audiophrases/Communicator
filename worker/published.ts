import { sanitizeBoard, type Board } from '../shared/board.ts';
import { isUploadedImage, uploadedImageName } from '../shared/images.ts';
import { BOARD_REFRESH_MS } from '../shared/options.ts';

export type PublishedBoard = { board: Board; revision: string };

// GitHub caches branch URLs for several minutes. Each check has a fresh URL,
// shared by all readers in the same interval. Picture names are content hashes.
function publishedUrl(repository: string, file: string) {
    return `https://raw.githubusercontent.com/${repository}/main/${file}?check=${Math.floor(Date.now() / BOARD_REFRESH_MS)}`;
}

export async function readPublishedBoard(repository: string): Promise<PublishedBoard> {
    const response = await fetch(publishedUrl(repository, 'classroom-board.json'), { signal: AbortSignal.timeout(4500) });
    if (!response.ok) throw new Error('Published board unavailable');
    const bytes = new Uint8Array(await response.arrayBuffer());
    const board = sanitizeBoard(JSON.parse(new TextDecoder().decode(bytes)));
    if (!board) throw new Error('Invalid published board');
    // Match the Git blob ID returned by the laptop, including the original whitespace and UTF-8 byte length.
    const header = new TextEncoder().encode(`blob ${bytes.length}\0`);
    const blob = new Uint8Array(header.length + bytes.length);
    blob.set(header);
    blob.set(bytes, header.length);
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-1', blob));
    const revision = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
    return { board, revision };
}

export async function readPublishedImage(repository: string, name: string): Promise<ArrayBuffer | null> {
    if (!isUploadedImage(name)) return null;
    const response = await fetch(publishedUrl(repository, 'classroom-images/' + name), { signal: AbortSignal.timeout(8000) });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('Published picture unavailable');
    const bytes = await response.arrayBuffer();
    if (await uploadedImageName(new Uint8Array(bytes)) !== name) throw new Error('Invalid published picture');
    return bytes;
}
