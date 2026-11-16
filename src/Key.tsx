import { symbolUrl, type Word } from '../shared/board.ts';

// A word's picture: its Mulberry symbol, or its emoji. A symbol that fails to load disappears and leaves the word.
export function Picture({ word, className = 'key-pic' }: { word: Pick<Word, 'e' | 's'>; className?: string }) {
    if (word.s) {
        return <img className={`${className} sym`} src={symbolUrl(word.s)} alt="" draggable={false} loading="lazy"
            onError={event => { event.currentTarget.style.display = 'none'; }} />;
    }
    return word.e ? <span className={className} aria-hidden="true">{word.e}</span> : null;
}

// A button grows 70% under the mouse (styles.css). At the edge of the board it grows inward, away from the edge,
// so it is not cut off. Read as the pointer arrives, before the growth has started.
const GROW = 0.35; // each side of a 1.7× button
function growInward(button: HTMLElement) {
    const box = button.getBoundingClientRect();
    const area = (button.closest('.board, .create-main') ?? document.documentElement).getBoundingClientRect();
    const bottom = Math.min(area.bottom, window.innerHeight);
    const x = box.left - area.left < box.width * GROW ? 'left' : area.right - box.right < box.width * GROW ? 'right' : 'center';
    const y = box.top - area.top < box.height * GROW ? 'top' : bottom - box.bottom < box.height * GROW ? 'bottom' : 'center';
    button.style.transformOrigin = `${x} ${y}`;
}

// One word button. An empty core slot keeps its place but shows nothing (the editor outlines it).
export function Key({ word, onTap, selected }: { word: Word; onTap: () => void; selected?: boolean }) {
    const className = `key k-${word.k}${word.w ? '' : ' blank'}${selected ? ' selected' : ''}`;
    if (!word.w) return <div className={className} aria-hidden="true" onClick={onTap} />;
    return (
        <button className={className} onClick={onTap} data-ca={word.ca || undefined}
            onPointerEnter={event => { if (event.pointerType === 'mouse') growInward(event.currentTarget); }}>
            <Picture word={word} />
            <span className={`key-word${word.w.length > 8 ? ' long' : ''}`}>{word.w}</span>
        </button>
    );
}
