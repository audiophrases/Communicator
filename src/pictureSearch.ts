// /create: photos (Pexels) and GIFs (GIPHY) for a button, found through PinPlay's search, which holds the keys.
// The picture the teacher chooses is downloaded here and then handled like an uploaded file.

const PINPLAY_API = 'https://pinplay-api.eugenime.workers.dev';

export type OnlineSource = 'photos' | 'gifs';
export type FoundPicture = { url: string; thumb: string; title: string };

// One request per search and session: GIPHY allows PinPlay 100 searches an hour.
const searches = new Map<string, Promise<FoundPicture[]>>();
export const searched = (source: OnlineSource, query: string) => searches.has(`${source}:${query}`);

export function searchPictures(source: OnlineSource, query: string): Promise<FoundPicture[]> {
    const key = `${source}:${query}`;
    let found = searches.get(key);
    if (!found) {
        const path = source === 'photos' ? '/api/images/search?count=24&q=' : '/api/gifs/search?limit=24&q=';
        found = fetch(PINPLAY_API + path + encodeURIComponent(query)).then(async response => {
            if (response.status === 429) throw new Error('Too many GIF searches this hour. Try again later, or choose a symbol.');
            if (!response.ok) throw new Error('Search is not working right now. Try again later.');
            const { items } = await response.json() as { items?: Partial<FoundPicture>[] };
            return (items ?? []).filter((item): item is FoundPicture => typeof item.url === 'string' && item.url.startsWith('https://')
                && typeof item.thumb === 'string' && item.thumb.startsWith('https://')).map(({ url, thumb, title }) => ({ url, thumb, title: String(title ?? '') }));
        }, () => { throw new Error('Could not search. Check the internet connection.'); });
        searches.set(key, found);
        found.catch(() => searches.delete(key)); // try again next time
    }
    return found;
}

// A button picture needs no more than 320 pixels: Pexels serves any size of a photo, as a JPEG.
function buttonSize(url: string) {
    const address = new URL(url);
    if (address.hostname === 'images.pexels.com') {
        for (const [name, value] of Object.entries({ dpr: '1', w: '320', h: '320', fm: 'jpg' })) address.searchParams.set(name, value);
        address.searchParams.delete('fit');
    }
    return address.href;
}

export async function downloadPicture(picture: FoundPicture): Promise<File> {
    try {
        const response = await fetch(buttonSize(picture.url));
        if (!response.ok) throw new Error();
        const data = await response.blob();
        return new File([data], 'picture', { type: data.type });
    } catch {
        throw new Error('That picture could not be downloaded. Choose another one.');
    }
}
