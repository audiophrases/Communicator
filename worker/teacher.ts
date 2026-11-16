// The teacher signs in at /create with the same password as PinPlay, HelloChat and Pixel Plaza
// (CREATE_PASSWORD_HASH: lowercase-hex SHA-256 of the trimmed, NFC-normalised password).
// A session is a signed expiry time, so nothing needs storing; changing the password ends every session.

const SESSION_MS = 12 * 60 * 60 * 1000;
const encoder = new TextEncoder();

export async function sha256Hex(input: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', encoder.encode(input));
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function same(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let difference = 0;
    for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return difference === 0;
}

export async function passwordMatches(password: unknown, hash: string | undefined): Promise<boolean> {
    const expected = (hash || '').trim().toLowerCase();
    if (!expected || typeof password !== 'string' || !password.trim()) return false;
    return same(await sha256Hex(password.trim().normalize('NFC')), expected);
}

async function sign(hash: string, expires: number): Promise<string> {
    const key = await crypto.subtle.importKey('raw', encoder.encode(hash.trim().toLowerCase()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`communicator-teacher:${expires}`));
    return [...new Uint8Array(signature)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function newSession(hash: string, now = Date.now()): Promise<string> {
    const expires = now + SESSION_MS;
    return `${expires}.${await sign(hash, expires)}`;
}

export async function sessionValid(token: string, hash: string | undefined, now = Date.now()): Promise<boolean> {
    if (!hash) return false;
    const [time, signature, extra] = token.split('.');
    const expires = Number(time);
    if (extra !== undefined || !signature || !Number.isSafeInteger(expires) || expires <= now || expires > now + SESSION_MS) return false;
    return same(signature, await sign(hash, expires));
}
