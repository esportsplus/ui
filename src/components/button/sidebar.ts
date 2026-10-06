import { component, html, type Attributes } from '@esportsplus/template';


type A = Attributes & {
    'aria-expanded'?: never;
    // Whether the panel the button toggles is showing.
    open: boolean | (() => boolean);
    // The edge the panel sits on; the glyph mirrors for 'right'.
    side?: 'left' | 'right' | (() => 'left' | 'right');
};


let uid = 0;


function read<T>(value: T | (() => T)) {
    return typeof value === 'function' ? (value as () => T)() : value;
}


// A panel glyph whose divider slides out of the frame while the panel is hidden, and previews the next state on hover
// and focus. Colors and sizing come from the caller's attributes.
export default component(
    ({ open, side = 'left', ...attributes }: A) => {
        let clip = `button-sidebar-${++uid}`;

        return html`
            <button
                class='button button-sidebar'
                type='button'
                ${attributes}
                ${{
                    'aria-expanded': () => String(read(open)),
                    class: () => read(side) === 'right' && 'button-sidebar--right'
                }}
            >
                <span aria-hidden='true' class='icon button-sidebar-icon'>
                    <svg class='button-sidebar-graphic' fill='none' focusable='false' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 16 16'>
                        <defs>
                            <clipPath ${{ id: clip }}>
                                <rect x='2.25' y='2.75' width='11.5' height='11' rx='1.5' />
                            </clipPath>
                        </defs>
                        <g class='button-sidebar-shadow'>
                            <path fill='currentColor' stroke='none' d='M3.75 2.75h2.5v11h-2.5a1.5 1.5 0 0 1-1.5-1.5v-7a1.5 1.5 0 0 1 1.5-1.5Z' />
                            <path d='M6.25 2.75v11' />
                        </g>
                        <g ${{ 'clip-path': `url(#${clip})` }}>
                            <g class='button-sidebar-divider'>
                                <path fill='currentColor' stroke='none' d='M3.75 2.75h2.5v11h-2.5a1.5 1.5 0 0 1-1.5-1.5v-7a1.5 1.5 0 0 1 1.5-1.5Z' />
                                <path d='M6.25 2.75v11' />
                            </g>
                        </g>
                        <rect x='2.25' y='2.75' width='11.5' height='11' rx='1.5' />
                    </svg>
                </span>
            </button>
        `;
    }
);
