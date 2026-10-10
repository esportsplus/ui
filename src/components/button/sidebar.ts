import { component, html, type Attributes } from '@esportsplus/template';
import { effect, reactive } from '@esportsplus/reactivity';


type A = Attributes & {
    'aria-expanded'?: never;
    onconnect?: never;
    onfocusout?: never;
    onpointerleave?: never;
    // Whether the panel the button toggles is showing.
    open: boolean | (() => boolean);
    // The edge the panel sits on; the glyph mirrors for 'right'.
    side?: 'left' | 'right' | (() => 'left' | 'right');
};


function read<T>(value: T | (() => T)) {
    return typeof value === 'function' ? (value as () => T)() : value;
}


// A frame with an inset panel pill that thins to a line while the panel is hidden, and previews the next state on
// hover and focus. Colors and sizing come from the caller's attributes.
export default component(
    ({ open, side = 'left', ...attributes }: A) => {
        let state = reactive({ held: false });

        return html`
            <button
                class='button button-sidebar'
                type='button'
                ${attributes}
                ${{
                    'aria-expanded': () => String(read(open)),
                    class: () => `${read(side) === 'right' ? 'button-sidebar--right' : ''} ${state.held ? 'button-sidebar--held' : ''}`,
                    // A toggle under the pointer or focus would otherwise flip straight to previewing the state it
                    // just left, so the glyph holds the new state until the pointer or focus leaves.
                    onconnect: (element: HTMLElement) => {
                        let current = read(open);

                        effect(() => {
                            let next = read(open);

                            if (next === current) {
                                return;
                            }

                            current = next;

                            if (element.matches(':hover, :focus-visible')) {
                                state.held = true;
                            }
                        });
                    },
                    onfocusout: () => {
                        state.held = false;
                    },
                    onpointerleave: () => {
                        state.held = false;
                    }
                }}
            >
                <span aria-hidden='true' class='icon button-sidebar-icon'>
                    <svg class='button-sidebar-graphic' fill='none' focusable='false' stroke='currentColor' stroke-width='1.5' viewBox='0 0 16 16'>
                        <path class='button-sidebar-panel' d='M5.5 5.5v5' stroke-linecap='round' />
                        <rect x='2.25' y='2.25' width='11.5' height='11.5' rx='2.75' />
                    </svg>
                </span>
            </button>
        `;
    }
);
