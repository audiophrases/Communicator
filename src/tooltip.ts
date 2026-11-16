// Catalan tooltips for every button with a data-ca attribute: hover with a mouse, or press and hold
// on a touch screen. Holding shows the Catalan without pressing the button, so a learner can check a word
// without adding it to the message.

import { shownRect } from './magnifier.ts';

const HOVER_MS = 1000; // with a mouse: the button is shown bigger at once (magnifier.ts), then its Catalan
const HOLD_MS = 450;
const TOUCH_SHOW_MS = 2500;

let bubble: HTMLDivElement | null = null;
let current: HTMLElement | null = null;
let held: HTMLElement | null = null; // a hold showed the tip: the click that follows is swallowed
let showTimer = 0;
let hideTimer = 0;

const withTip = (target: EventTarget | null) => (target instanceof Element ? target.closest<HTMLElement>('[data-ca]') : null);

function show(element: HTMLElement) {
    const text = element.dataset.ca;
    if (!text || !element.isConnected) return;
    if (!bubble) {
        bubble = document.createElement('div');
        bubble.className = 'tip';
        bubble.lang = 'ca';
        bubble.setAttribute('role', 'tooltip');
        document.body.append(bubble);
    }
    bubble.textContent = text;
    bubble.hidden = false;
    const target = shownRect(element); // above the big copy of a word button, when it has one
    const box = bubble.getBoundingClientRect();
    const left = Math.min(Math.max(8, target.left + target.width / 2 - box.width / 2), window.innerWidth - box.width - 8);
    const top = target.top - box.height - 8 >= 8 ? target.top - box.height - 8 : target.bottom + 8;
    bubble.style.left = `${left}px`;
    bubble.style.top = `${top}px`;
}

function hide() {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    current = null;
    if (bubble) bubble.hidden = true;
}

export function installTooltips() {
    window.addEventListener('pointerover', event => {
        if (event.pointerType !== 'mouse') return;
        const element = withTip(event.target);
        if (element === current) return;
        hide();
        if (!element) return;
        current = element;
        showTimer = window.setTimeout(() => show(element), HOVER_MS);
    });
    window.addEventListener('pointerout', event => {
        if (event.pointerType === 'mouse' && current && !current.contains(event.relatedTarget as Node | null)) hide();
    });

    window.addEventListener('pointerdown', event => {
        if (event.pointerType === 'mouse') return;
        hide();
        held = null;
        const element = withTip(event.target);
        if (!element) return;
        current = element;
        showTimer = window.setTimeout(() => {
            show(element);
            held = element;
            navigator.vibrate?.(15);
            hideTimer = window.setTimeout(hide, TOUCH_SHOW_MS);
        }, HOLD_MS);
    });
    const release = () => clearTimeout(showTimer); // a tip already showing stays for a moment
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', () => { release(); held = null; });

    window.addEventListener('click', event => {
        if (held && held.contains(event.target as Node)) {
            event.preventDefault();
            event.stopPropagation();
        }
        held = null;
    }, true);
    // A long press would otherwise open the browser's menu on Android.
    window.addEventListener('contextmenu', event => { if (withTip(event.target)) event.preventDefault(); }, true);
    // A shown tip would float away from its button. One about to show is placed when it shows, so it stays.
    window.addEventListener('scroll', () => { if (bubble && !bubble.hidden) hide(); }, true);
    window.addEventListener('keydown', hide);
}
