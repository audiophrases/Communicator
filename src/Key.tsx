import type { Word } from '../shared/board.ts';

// One word button. An empty core slot keeps its place but shows nothing (the editor outlines it).
export function Key({ word, onTap, selected }: { word: Word; onTap: () => void; selected?: boolean }) {
    const className = `key k-${word.k}${word.w ? '' : ' blank'}${selected ? ' selected' : ''}`;
    if (!word.w) return <div className={className} aria-hidden="true" onClick={onTap} />;
    return (
        <button className={className} onClick={onTap} data-ca={word.ca || undefined}>
            {word.e && <span className="key-pic" aria-hidden="true">{word.e}</span>}
            <span className={`key-word${word.w.length > 8 ? ' long' : ''}`}>{word.w}</span>
        </button>
    );
}
