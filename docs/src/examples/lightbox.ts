import { lightbox } from '@esportsplus/ui';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';


type Shot = {
    alt: string;
    caption: string;
    src: string;
};


// Vector art so zooming shows crisp detail without shipping image assets.
function art(from: string, to: string, label: string) {
    let rings = '';

    for (let i = 1; i <= 12; i++) {
        rings += `<circle cx='800' cy='500' r='${i * 38}' fill='none' stroke='white' stroke-opacity='${(0.36 - i * 0.025).toFixed(3)}' stroke-width='2' />`;
    }

    return `data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 1000' width='1600' height='1000'>
            <defs>
                <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
                    <stop offset='0' stop-color='${from}' />
                    <stop offset='1' stop-color='${to}' />
                </linearGradient>
                <pattern id='p' width='40' height='40' patternUnits='userSpaceOnUse'>
                    <path d='M40 0H0V40' fill='none' stroke='white' stroke-opacity='0.08' />
                </pattern>
            </defs>
            <rect width='1600' height='1000' fill='url(#g)' />
            <rect width='1600' height='1000' fill='url(#p)' />
            ${rings}
            <text x='800' y='515' fill='white' font-family='system-ui, sans-serif' font-size='44' font-weight='600' text-anchor='middle'>${label}</text>
            <text x='800' y='560' fill='white' fill-opacity='0.6' font-family='system-ui, sans-serif' font-size='14' text-anchor='middle'>zoom in to read the fine print</text>
        </svg>`
    )}`;
}


let shots: Shot[] = [
    { alt: 'Aurora gradient', caption: 'Aurora — 1600 × 1000', from: '#4568ff', label: 'Aurora', to: '#12131a' },
    { alt: 'Ember gradient', caption: 'Ember — 1600 × 1000', from: '#ff6a3d', label: 'Ember', to: '#3a0b2e' },
    { alt: 'Lagoon gradient', caption: 'Lagoon — 1600 × 1000', from: '#1fc8a0', label: 'Lagoon', to: '#0b2440' },
    { alt: 'Orchid gradient', caption: 'Orchid — 1600 × 1000', from: '#b44dff', label: 'Orchid', to: '#1b1033' }
].map((shot) => ({ alt: shot.alt, caption: shot.caption, src: art(shot.from, shot.to, shot.label) }));


function gallery() {
    let active = reactive({ alt: shots[0].alt, caption: shots[0].caption, src: shots[0].src }),
        origin: HTMLElement | null = null,
        state = reactive({ active: false });

    return html`
        <div style='display: grid; gap: var(--size-400); grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); width: 100%;'>
            ${shots.map((shot) => html`
                <button
                    aria-label='Open ${shot.alt}'
                    style='aspect-ratio: 16 / 10; background: none; border: 0; border-radius: 9px; cursor: zoom-in; overflow: hidden; padding: 0;'
                    type='button'
                    ${{
                        onclick: function(this: HTMLElement) {
                            origin = this;
                            active.alt = shot.alt;
                            active.caption = shot.caption;
                            active.src = shot.src;
                            state.active = true;
                        }
                    }}
                >
                    <img alt='' src='${shot.src}' style='display: block; height: 100%; object-fit: cover; width: 100%;' />
                </button>
            `)}
        </div>

        ${lightbox({
            alt: () => active.alt,
            caption: () => active.caption,
            height: 1000,
            origin: () => origin,
            src: () => active.src,
            state,
            width: 1600
        })}
    `;
}

function single() {
    let origin: HTMLElement | null = null,
        state = reactive({ active: false });

    return html`
        <button
            aria-label='Open Aurora gradient'
            style='aspect-ratio: 16 / 10; background: none; border: 0; border-radius: 24px; cursor: zoom-in; overflow: hidden; padding: 0; width: 200px;'
            type='button'
            ${{
                onclick: function(this: HTMLElement) {
                    origin = this;
                    state.active = true;
                }
            }}
        >
            <img alt='' src='${shots[0].src}' style='display: block; height: 100%; object-fit: cover; width: 100%;' />
        </button>

        ${lightbox({
            alt: shots[0].alt,
            height: 1000,
            maxScale: 8,
            origin: () => origin,
            src: shots[0].src,
            state,
            width: 1600
        })}
    `;
}


export default {
    name: 'lightbox',
    variants: [
        {
            render: gallery,
            title: 'gallery'
        },
        {
            render: single,
            title: 'single image, 8× max zoom'
        }
    ]
};
