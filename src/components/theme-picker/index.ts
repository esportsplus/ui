import { component, html, type Attributes } from '@esportsplus/template';
import { flush, reactive } from '@esportsplus/reactivity';
import faces from '~/components/button/faces';
import dismiss from '~/shared/dismiss';
import monitor from '@esportsplus/ui/svg/monitor.svg';
import moon from '@esportsplus/ui/svg/moon.svg';
import sun from '@esportsplus/ui/svg/sun.svg';
import type { Mode, Preference } from '~/components/theme';
import '~/components/button/scss/index.scss';
import './scss/index.scss';


const TOGGLE_OPTION = Symbol.for('@esportsplus/ui/theme-picker.toggle.option');

const TOGGLE_TRIGGER = Symbol.for('@esportsplus/ui/theme-picker.toggle.trigger');


type A = Attributes & {
    mode: Theme;
};

type Choice = {
    icon: string;
    label: string;
    value: Preference;
};

type T = A & {
    [TOGGLE_OPTION]?: Attributes;
    [TOGGLE_TRIGGER]?: Attributes;
    onconnect?: never;
    ondocumentclick?: never;
    onkeydown?: never;
    onpointerenter?: never;
    onpointerleave?: never;
};

// The slice of a 'theme()' instance the pickers read and drive.
type Theme = {
    readonly mode: Mode;
    readonly preference: Preference;
    set(preference: Preference): void;
};


const CHOICES: Choice[] = [
    { icon: sun, label: 'Light', value: 'light' },
    { icon: moon, label: 'Dark', value: 'dark' },
    { icon: monitor, label: 'System', value: 'system' }
];


function choice(mode: Theme) {
    return CHOICES.find((choice) => choice.value === mode.preference) ?? CHOICES[2];
}

function icon(id: string) {
    return html`<svg aria-hidden='true' class='theme-picker-icon'><use href='#${id}' /></svg>`;
}

// Chosen-ness lives in 'aria-checked' alone: '--active' on a tooltip trigger means its tooltip is showing.
function radio(mode: Theme, choice: Choice) {
    return {
        'aria-checked': () => mode.preference === choice.value ? 'true' : 'false',
        onclick: () => mode.set(choice.value),
        role: 'radio',
        type: 'button'
    };
}


// Miniature pages, System split diagonally between the two.
const cards = component(({ mode, ...attributes }: A) => html`
    <div aria-label='Theme' class='theme-picker-cards' role='radiogroup' ${attributes}>
        ${CHOICES.map((choice) => html`
            <button class='theme-picker-cards-option' ${radio(mode, choice)}>
                <span class='theme-picker-cards-preview theme-picker-cards-preview--${choice.value}'>
                    <span class='theme-picker-cards-preview-bar'></span>
                    <span class='theme-picker-cards-preview-line'></span>
                    <span class='theme-picker-cards-preview-line theme-picker-cards-preview-line--short'></span>
                </span>
                <span class='theme-picker-cards-label'>${choice.label}</span>
            </button>
        `)}
    </div>
`);

// Round swatches, System split down the middle.
const swatches = component(({ mode, ...attributes }: A) => html`
    <div aria-label='Theme' class='theme-picker-swatches' role='radiogroup' ${attributes}>
        ${CHOICES.map((choice) => html`
            <button class='theme-picker-swatches-option' ${radio(mode, choice)}>
                <span class='theme-picker-swatches-circle theme-picker-swatches-circle--${choice.value}'></span>
                <span class='theme-picker-swatches-label'>${choice.label}</span>
            </button>
        `)}
    </div>
`);

// The current choice's icon. Hovering or clicking morphs it into a row of every choice laid over the button, the
// current one where the button's icon was, the way a select menu opens over its value; picking one, clicking outside,
// Escape or the pointer leaving closes it again.
const toggle = component(({ mode, ...attributes }: T) => {
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
                    content: '',
                    icon: () => icon(choice.icon),
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
                        ${icon(choice.icon)}
                    </button>
                `)}
            </div>
        </div>
    `;
}, { option: TOGGLE_OPTION, trigger: TOGGLE_TRIGGER });


export default { cards, swatches, toggle };
export type { Theme };
