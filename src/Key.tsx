import { symbolUrl, type Word } from '../shared/board.ts';

// A word's picture: its Mulberry symbol, or its emoji. A symbol that fails to load disappears and leaves the word.
export function Picture({ word, className = 'key-pic' }: { word: Pick<Word, 'e' | 's'>; className?: string }) {
    if (word.s) {
        return <img className={`${className} sym`} src={symbolUrl(word.s)} alt="" draggable={false} loading="lazy"
            onError={event => { event.currentTarget.style.display = 'none'; }} />;
    }
    return word.e ? <span className={className} aria-hidden="true">{word.e}</span> : null;
}

// One word button. An empty core slot keeps its place but shows nothing (the editor outlines it).
export function Key({ word, onTap, selected }: { word: Word; onTap: () => void; selected?: boolean }) {
    const className = `key k-${word.k}${word.w ? '' : ' blank'}${selected ? ' selected' : ''}`;
    if (!word.w) return <div className={className} aria-hidden="true" onClick={onTap} />;
    return (
        <button className={className} onClick={onTap} data-ca={word.ca || undefined}>
            <Picture word={word} />
            <span className={`key-word${word.w.length > 8 ? ' long' : ''}`}>{word.w}</span>
        </button>
    );
}
