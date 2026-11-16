// With a mouse, the word button under the pointer is shown 70% bigger, so a small picture is easy to make out.
// The big one is only a picture of the button, laid over it: clicks pass through to the real buttons underneath.
// (When the button itself grew, it covered half of its neighbours and took their clicks: aiming at "want" under an
// enlarged "I" pressed "I".) Moving onto a neighbour shows that one instead. Touch screens are left alone.

const GROW = 0.35; // each side of a 1.7× button

let copy: HTMLElement | null = null;
let source: HTMLElement | null = null;

// Where the button is drawn now: its big copy while it has one. The Catalan tooltip goes above that.
export function shownRect(element: Element): DOMRect {
    return element === source && copy ? copy.getBoundingClientRect() : element.getBoundingClientRect();
}

// At the edge of the board the copy grows inward, away from the edge, so it is not cut off.
function origin(button: HTMLElement, box: DOMRect): string {
    const area = (button.closest('.board, .create-main') ?? document.documentElement).getBoundingClientRect();
    const bottom = Math.min(area.bottom, window.innerHeight);
    const x = box.left - area.left < box.width * GROW ? 'left' : area.right - box.right < box.width * GROW ? 'right' : 'center';
    const y = box.top - area.top < box.height * GROW ? 'top' : bottom - box.bottom < box.height * GROW ? 'bottom' : 'center';
    return `${x} ${y}`;
}

function hide() {
    copy?.remove();
    copy = null;
    source = null;
}

function show(button: HTMLElement) {
    hide();
    const box = button.getBoundingClientRect();
    const big = button.cloneNode(true) as HTMLElement;
    big.classList.add('magnifier');
    big.removeAttribute('data-ca');
    big.setAttribute('aria-hidden', 'true');
    big.tabIndex = -1;
    Object.assign(big.style, {
        left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px`, transformOrigin: origin(button, box)
    });
    // Next to the button, so it keeps the page's styles (the editor's smaller type, for example).
    (button.closest('.create, .app') ?? document.body).append(big);
    copy = big;
    source = button;
    requestAnimationFrame(() => big.classList.add('on'));
}

export function installMagnifier() {
    window.addEventListener('pointerover', event => {
        if (event.pointerType !== 'mouse') return;
        const button = event.target instanceof Element ? event.target.closest<HTMLElement>('button.key:not(.blank):not(.magnifier)') : null;
        if (button === source) return;
        if (button) show(button);
        else hide();
    });
    window.addEventListener('pointerout', event => {
        if (event.pointerType === 'mouse' && source && !source.contains(event.relatedTarget as Node | null)) hide();
    });
    // Pressing shows on the big one too.
    window.addEventListener('pointerdown', event => { if (copy && source?.contains(event.target as Node)) copy.classList.add('pressed'); });
    window.addEventListener('pointerup', () => copy?.classList.remove('pressed'));
    // A click can change the page (another tab, the editor's panel): drop a copy whose button has gone.
    window.addEventListener('click', () => setTimeout(() => { if (source && !source.isConnected) hide(); }), true);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('blur', hide);
}
