import { useState, type CSSProperties } from 'react';
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

// How wide an emoji picture is, in multiples of its font size, so it is drawn as big as the button allows:
// an emoji about 1.25, a Latin letter or digit 0.7 ("💬EN" 2.65), anything else 1.
const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter() : null;
function pictureWidth(text: string): number {
    const characters = segmenter ? [...segmenter.segment(text)].map(part => part.segment) : Array.from(text);
    return characters.reduce((width, character) => width
        + (/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(character) ? 1.25 : /^[\x20-\x7e]$/.test(character) ? 0.7 : 1), 0);
}

// One word button (shown bigger under the mouse by magnifier.ts). An empty core slot keeps its place but shows nothing (the editor outlines it).
// The picture fills whatever room the word leaves: some students cannot read and go by the pictures.
export function Key({ word, onTap, selected }: { word: Word; onTap: () => void; selected?: boolean }) {
    const className = `key k-${word.k}${word.w ? '' : ' blank'}${selected ? ' selected' : ''}`;
    if (!word.w) return <div className={className} aria-hidden="true" onClick={onTap} />;
    return (
        <button className={className} onClick={onTap} data-ca={word.ca || undefined}>
            {(word.s || word.e) && <span className="key-art" style={{ '--picture-width': pictureWidth(word.e ?? '') || 1.25 } as CSSProperties}>
                <Picture word={word} />
            </span>}
            <span className={`key-word${word.w.length > 8 ? ' long' : ''}${word.w === '?' ? ' mark' : ''}`}>{word.w}</span>
        </button>
    );
}
