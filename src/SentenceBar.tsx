import { useRef, useState, type ReactElement } from 'react';
import { Picture } from './Key.tsx';

export type Token = { id: number; w: string; s?: string; e?: string; typed?: boolean };

// A gap belongs to the nearest row, then to the left or right half of its nearest word.
function gapAt(bar: HTMLElement, x: number, y: number): number {
    const chips = bar.querySelectorAll<HTMLElement>('button.chip');
    let gap = 0, nearestRow = Infinity, nearestWord = Infinity;
    for (const [index, chip] of chips.entries()) {
        const r = chip.getBoundingClientRect();
        const dy = Math.max(r.top - y, 0, y - r.bottom);
        const dx = Math.max(r.left - x, 0, x - r.right);
        if (dy < nearestRow || (dy === nearestRow && dx < nearestWord)) {
            nearestRow = dy;
            nearestWord = dx;
            gap = x < (r.left + r.right) / 2 ? index : index + 1;
        }
    }
    return gap;
}

type Props = {
    words: Token[]; cursor: number; selected: number | null; input: ReactElement;
    select: (index: number, after: boolean) => void;
    edit: (index: number) => void;
    move: (index: number, gap: number) => void;
    insert: (gap: number, text?: string) => void;
    remove: (index: number) => void;
};

export function SentenceBar({ words, cursor, selected, input, select, edit, move, insert, remove }: Props) {
    const bar = useRef<HTMLDivElement>(null);
    const pointer = useRef<{ id: number; x: number; y: number; dragging: boolean } | null>(null);
    const lastTap = useRef<{ word: Token; time: number } | null>(null);
    const suppressClick = useRef(false);
    const [drop, setDrop] = useState<{ from: number; gap: number | null; left: number; top: number; width: number } | null>(null);
    const marker = drop ? drop.gap : selected !== null ? cursor : null;
    const pieces = words.map((word, index) => (
        <button key={word.id} className={word.w === '?' ? 'chip mark' : 'chip'}
            aria-label={`Word ${index + 1}: ${word.w}`} aria-pressed={selected === index}
            data-edge={marker === index ? 'before' : marker === words.length && index === marker - 1 ? 'after' : undefined}
            data-dragging={drop?.from === index || undefined}
            onPointerDown={e => {
                if (!e.isPrimary || e.button !== 0) return;
                pointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY, dragging: false };
                suppressClick.current = false;
                e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={e => {
                const p = pointer.current, el = bar.current;
                if (!p || p.id !== e.pointerId || !el) return;
                if (!p.dragging && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 6) return;
                p.dragging = true;
                const r = el.getBoundingClientRect();
                if (e.clientY < r.top + 12) el.scrollTop -= 12;
                if (e.clientY > r.bottom - 12) el.scrollTop += 12;
                const inside = el.contains(document.elementFromPoint(e.clientX, e.clientY));
                const source = e.currentTarget.getBoundingClientRect();
                setDrop({ from: index, gap: inside ? gapAt(el, e.clientX, e.clientY) : null,
                    left: source.left + e.clientX - p.x, top: source.top + e.clientY - p.y, width: source.width });
            }}
            onPointerUp={e => {
                if (pointer.current?.id !== e.pointerId) return;
                if (pointer.current.dragging) {
                    suppressClick.current = true;
                    lastTap.current = null;
                    const el = bar.current;
                    if (el?.contains(document.elementFromPoint(e.clientX, e.clientY))) move(index, gapAt(el, e.clientX, e.clientY));
                }
                pointer.current = null;
                setDrop(null);
            }}
            onLostPointerCapture={() => { pointer.current = null; setDrop(null); }}
            onClick={e => {
                if (suppressClick.current && e.detail) return;
                const now = performance.now();
                if (e.detail && lastTap.current?.word === word && (e.detail === 2 || now - lastTap.current.time < 400)) {
                    lastTap.current = null;
                    edit(index);
                } else {
                    lastTap.current = { word, time: now };
                    e.currentTarget.focus({ preventScroll: true });
                    const r = e.currentTarget.getBoundingClientRect();
                    select(index, !e.detail || e.clientX >= (r.left + r.right) / 2);
                }
            }}
            onKeyDown={e => {
                if (e.nativeEvent.isComposing || e.ctrlKey || e.metaKey) return;
                if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                    move(index, e.key === 'ArrowLeft' ? Math.max(0, index - 1) : Math.min(words.length, index + 2));
                } else if (e.altKey || e.shiftKey && e.key === 'Enter') return;
                else if (e.key === 'Delete' || e.key === 'Backspace') remove(index);
                else if (e.key === 'Enter' || e.key === 'F2') edit(index);
                else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') insert(index + Number(e.key === 'ArrowRight'));
                else if (e.key.length === 1 && e.key !== ' ') insert(selected === index ? cursor : index + 1, e.key);
                else return;
                e.preventDefault();
            }}>
            <Picture word={word} className="chip-pic" />{word.w}
        </button>
    ));
    pieces.splice(cursor, 0, input);
    return <div className="bar" ref={bar} onClick={e => {
        if (e.target === e.currentTarget) insert(gapAt(e.currentTarget, e.clientX, e.clientY));
    }}>{pieces}
        {drop && words[drop.from] && <span className="chip drag-copy" aria-hidden="true"
            style={{ left: drop.left, top: drop.top, width: drop.width }}>
            <Picture word={words[drop.from]} className="chip-pic" />{words[drop.from].w}
        </span>}
    </div>;
}
