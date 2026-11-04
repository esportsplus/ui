import { component, html, type Attributes } from '@esportsplus/template';
import { flush, reactive } from '@esportsplus/reactivity';
import faces from '~/components/button/faces';
import dismiss from '~/shared/dismiss';
import { CHOICES, choice, glyph, radio, type A } from './shared';


type T = A & {
    [TOGGLE_OPTION]?: Attributes;
    [TOGGLE_TRIGGER]?: Attributes;
    onconnect?: never;
    ondocumentclick?: never;
    onkeydown?: never;
    onpointerenter?: never;
    onpointerleave?: never;
};


const TOGGLE_OPTION = Symbol.for('@esportsplus/ui/theme-picker.toggle.option');

const TOGGLE_TRIGGER = Symbol.for('@esportsplus/ui/theme-picker.toggle.trigger');


// The current choice's icon. Hovering or clicking morphs it into a row of every choice laid over the button, the
// current one where the button's icon was, the way a select menu opens over its value; picking one, clicking outside,
// Escape or the pointer leaving closes it again.
export default component(({ mode, ...attributes }: T) => {
    let options: HTMLElement[] = [],
        state = reactive({ active: false }),
        trigger: HTMLElement | undefined;

    function close(focus = false) {
        state.active = false;

        if (focus) {
            trigger?.focus();
        }
    }

    // A keyboard open moves focus into the row once it is no longer inert.
    function open(focus = false) {
        state.active = true;

        if (focus) {
            flush();
            options[CHOICES.indexOf(choice(mode))]?.focus();
        }
    }

    return html`
        <div
            class='theme-picker-toggle'
            ${attributes}
            ${{
                class: () => state.active && '--active',
                ondocumentclick: dismiss(() => state.active, () => close()),
                onkeydown: (event: KeyboardEvent) => {
                    if (!state.active) {
                        return;
                    }

                    if (event.key === 'Escape') {
                        event.stopPropagation();
                        close(true);
                        return;
                    }

                    let step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;

                    if (!step) {
                        return;
                    }

                    let i = options.indexOf(document.activeElement as HTMLElement),
                        n = options.length;

                    event.preventDefault();
                    options[((i === -1 ? CHOICES.indexOf(choice(mode)) : i) + step + n) % n]?.focus();
                },
                // Touch has no hover to leave, so a tap opens through the click alone.
                onpointerenter: (event: PointerEvent) => {
                    if (event.pointerType !== 'touch') {
                        open();
                    }
                },
                onpointerleave: (event: PointerEvent) => {
                    if (event.pointerType !== 'touch') {
                        close();
                    }
                },
                style: () => `--index: ${CHOICES.indexOf(choice(mode))};`
            }}
        >
            <button
                aria-haspopup='true'
                class='button button--feedback theme-picker-toggle-trigger'
                type='button'
                ${attributes[TOGGLE_TRIGGER]}
                ${{
                    'aria-expanded': () => state.active ? 'true' : 'false',
                    'aria-label': () => `Theme: ${choice(mode).label}`,
                    onclick: (event: MouseEvent) => {
                        if (state.active) {
                            close();
                        }
                        else {
                            open(event.detail === 0);
                        }
                    },
                    onconnect: (element: HTMLElement) => {
                        trigger = element;
                    }
                }}
            >
                ${faces(() => choice(mode).value, CHOICES.map((choice) => ({
                    content: glyph(choice.icon),
                    key: choice.value
                })))}
            </button>

            <div
                aria-label='Theme'
                class='theme-picker-toggle-menu'
                role='radiogroup'
                ${{ inert: () => !state.active }}
            >
                ${CHOICES.map((choice, i) => html`
                    <button
                        aria-label='${choice.label}'
                        class='theme-picker-toggle-option'
                        title='${choice.label}'
                        ${attributes[TOGGLE_OPTION]}
                        ${radio(mode, choice)}
                        ${{
                            onclick: () => {
                                mode.set(choice.value);
                                close(true);
                            },
                            onconnect: (element: HTMLElement) => {
                                options[i] = element;
                            }
                        }}
                    >
                        ${glyph(choice.icon)}
                    </button>
                `)}
            </div>
        </div>
    `;
}, { option: TOGGLE_OPTION, trigger: TOGGLE_TRIGGER });
