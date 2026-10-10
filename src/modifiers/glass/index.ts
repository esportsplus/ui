import './scss/index.scss';


type GlassMode = 'uniform' | 'progressive';


// Uniform glass uses one full-strength layer; progressive glass uses seven masked layers.
function createOverlay(element: HTMLElement, mode: GlassMode = 'uniform', className = '') {
    let overlay = element.ownerDocument.createElement('div');

    overlay.className = className ? `--glass-blur ${className}` : '--glass-blur';
    overlay.setAttribute('aria-hidden', 'true');

    if (mode === 'progressive') {
        overlay.classList.add('--glass-blur-progressive');
    }

    for (let i = 0, count = mode === 'progressive' ? 7 : 1; i < count; i++) {
        overlay.appendChild(element.ownerDocument.createElement('span'));
    }

    return overlay;
}


export default (mode: GlassMode = 'uniform') => ({
    class: mode === 'progressive' ? ['--glass', '--glass-progressive'] : ['--glass'],
    onconnect: (element: HTMLElement) => {
        let overlay = element.querySelector(':scope > .--glass-blur');

        if (!overlay) {
            element.appendChild(createOverlay(element, mode));
        }
        else if (overlay.classList.contains('--glass-blur-progressive') !== (mode === 'progressive')) {
            overlay.replaceWith(createOverlay(element, mode));
        }
    }
});


export { createOverlay };
export type { GlassMode };
