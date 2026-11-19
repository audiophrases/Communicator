import { createContext, useContext } from 'react';
import { imageFormat, IMAGE_TYPES, MAX_IMAGE_BYTES } from '../shared/images.ts';
import { symbolUrl } from '../shared/board.ts';

export type DraftImage = { file: Blob; preview: string; name?: string };
export const DraftImages = createContext<ReadonlyMap<string, DraftImage>>(new Map());
export function usePictureUrl(name?: string) {
    const images = useContext(DraftImages);
    return name ? images.get(name)?.preview ?? symbolUrl(name) : undefined;
}

export async function previewImage(file: File) {
    if (file.size > MAX_IMAGE_BYTES) throw new Error('Choose an image of 5 MiB or less.');
    const format = imageFormat(new Uint8Array(await file.arrayBuffer()));
    if (!format) throw new Error('Choose a GIF, JPG, PNG or SVG image.');
    const data = file.slice(0, file.size, IMAGE_TYPES[format]);
    const url = URL.createObjectURL(data);
    try {
        // An SVG opened directly from the preview must also have an opaque origin.
        const source = format === 'svg' ? await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(data);
        }) : url;
        const preview = new Image();
        preview.src = source;
        await preview.decode();
        return { url, file: data, preview: source };
    } catch {
        URL.revokeObjectURL(url);
        throw new Error('This image could not be opened. Choose another file.');
    }
}
