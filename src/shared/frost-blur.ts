// The masks and radii live in %frost-blur; every overlay uses the same seven layers.
export default function frostBlur(element: HTMLElement, className: string) {
    let overlay = element.ownerDocument.createElement('div');

    overlay.className = className;
    overlay.setAttribute('aria-hidden', 'true');

    for (let i = 0; i < 7; i++) {
        overlay.appendChild(element.ownerDocument.createElement('span'));
    }

    return overlay;
}
