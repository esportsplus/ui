import { html } from '@esportsplus/template';
import './scss/index.scss';


type GlassMode = 'uniform' | 'progressive';


// Uniform glass uses one full-strength layer; progressive glass uses seven masked layers.
const overlay = (mode: GlassMode = 'uniform', classes = '') => mode === 'progressive'
    ? html`
        <div aria-hidden='true' class='--glass-blur --glass-blur-progressive ${classes}'>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
        </div>
    `
    : html`
        <div aria-hidden='true' class='--glass-blur ${classes}'>
            <span></span>
        </div>
    `;


export default (mode: GlassMode = 'uniform') => ({
    class: mode === 'progressive' ? ['--glass', '--glass-progressive'] : ['--glass'],
    onconnect: (element: HTMLElement) => {
        let container = element.querySelector(':scope > .--glass-blur');

        if (!container) {
            element.appendChild( overlay(mode) );
        }
        else if (container.classList.contains('--glass-blur-progressive') !== (mode === 'progressive')) {
            container.replaceWith( overlay(mode) );
        }
    }
});


export { overlay };
export type { GlassMode };
