// Puts text on the clipboard without showing anything. Call it from the key press that asked for it.
// The school Wi-Fi address is plain HTTP, where browsers hide navigator.clipboard, so there the browser's own copy
// command carries the words: the copy event it fires gets them in place of the (empty) page selection.
export function copyText(text: string) {
    if (window.isSecureContext && navigator.clipboard) {
        navigator.clipboard.writeText(text).catch(() => {});
        return;
    }
    const onCopy = (event: ClipboardEvent) => {
        event.clipboardData?.setData('text/plain', text);
        event.preventDefault();
    };
    document.addEventListener('copy', onCopy);
    try { document.execCommand('copy'); } catch { /* the clipboard stays as it was */ }
    document.removeEventListener('copy', onCopy);
}
