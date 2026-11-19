export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = { gif: 'image/gif', jpg: 'image/jpeg', png: 'image/png', svg: 'image/svg+xml' } as const;
export type ImageFormat = keyof typeof IMAGE_TYPES;

export function isUploadedImage(name: unknown): name is string {
    return typeof name === 'string' && /^upload_[a-f0-9]{64}\.(gif|jpg|png|svg)$/.test(name);
}

export function imageContentType(name: string) {
    return IMAGE_TYPES[name.slice(name.lastIndexOf('.') + 1) as ImageFormat];
}

// Identify the contents, since file pickers may supply an empty or incorrect MIME type.
export function imageFormat(bytes: Uint8Array): ImageFormat | null {
    if (bytes.length < 6 || bytes.length > MAX_IMAGE_BYTES) return null;
    if (bytes.length >= 33 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
        && String.fromCharCode(...bytes.subarray(12, 16)) === 'IHDR') return 'png';
    if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpg';
    const header = String.fromCharCode(...bytes.subarray(0, 6));
    if (bytes.length >= 13 && (header === 'GIF87a' || header === 'GIF89a')) return 'gif';
    const encoding = bytes[0] === 255 && bytes[1] === 254 ? 'utf-16le' : bytes[0] === 254 && bytes[1] === 255 ? 'utf-16be' : 'utf-8';
    let xml = new TextDecoder(encoding).decode(bytes).trimStart();
    // Skip common XML preambles without backtracking over the image body.
    while (!/^<(?:[\w.-]+:)?svg(?=[\s/>])/.test(xml)) {
        let close: string;
        if (xml.startsWith('<?')) close = '?>';
        else if (xml.startsWith('<!--')) close = '-->';
        else if (xml.startsWith('<!DOCTYPE')) close = /^[^>[]*\[/.test(xml) ? ']>' : '>';
        else return null;
        const end = xml.indexOf(close);
        if (end < 0) return null;
        xml = xml.slice(end + close.length).trimStart();
    }
    return 'svg';
}

export async function uploadedImageName(bytes: Uint8Array<ArrayBuffer>): Promise<string | null> {
    const format = imageFormat(bytes);
    if (!format) return null;
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    const hash = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
    return `upload_${hash}.${format}`;
}
