import { useState } from 'react';
import type { Word } from '../shared/board.ts';
import { usePictureUrl } from './uploadImage.ts';

// A teacher can set both an SVG and an emoji. Use the emoji if the SVG cannot load.
export function Picture({ word, className = 'key-pic' }: { word: Pick<Word, 'e' | 's'>; className?: string }) {
    const [failed, setFailed] = useState<string>();
    const src = usePictureUrl(word.s);
    if (word.s && word.s !== failed) {
        const name = word.s;
        return <img className={`${className} sym`} src={src} alt="" draggable={false} loading="lazy"
            onError={() => setFailed(name)} />;
    }
    return word.e ? <span className={className} aria-hidden="true">{word.e}</span> : null;
}

// One word button (shown bigger under the mouse by magnifier.ts). An empty core slot keeps its place but shows nothing (the editor outlines it).
export function Key({ word, onTap, selected }: { word: Word; onTap: () => void; selected?: boolean }) {
    const className = `key k-${word.k}${word.w ? '' : ' blank'}${selected ? ' selected' : ''}`;
    if (!word.w) return <div className={className} aria-hidden="true" onClick={onTap} />;
    return (
        <button className={className} onClick={onTap} data-ca={word.ca || undefined}>
            <Picture word={word} />
            <span className={`key-word${word.w.length > 8 ? ' long' : ''}${word.w === '?' ? ' mark' : ''}`}>{word.w}</span>
        </button>
    );
}
