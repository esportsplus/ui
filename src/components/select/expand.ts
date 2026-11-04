import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import { flush, onCleanup, reactive } from '@esportsplus/reactivity';
import faces from '~/components/button/faces';
import form from '~/components/form';
import { morph, shape } from '~/components/tooltip/utilities';
import dismiss from '~/shared/dismiss';
import '~/components/button/scss/index.scss';
import '~/components/tooltip/scss/index.scss';


type A = Attributes & {
    [EXPAND_OPTION]?: Attributes;
    [EXPAND_TRIGGER]?: Attributes;
    label: string;
    name?: string;
    onconnect?: never;
    ondocumentclick?: never;
    onkeydown?: never;
    onpointerenter?: never;
    onpointerleave?: never;
    openOn?: 'click' | 'hover';
    options: Option[];
} & ({ selected?: string; state?: never } | { selected?: never; state: State });

type Option = {
    // Factory because it renders twice: as the trigger's face and as the option in the row.
    content: () => Renderable<unknown>;
    label: string;
    value: string;
};

type State = {
    error: string;
    selected?: string;
};


const EXPAND_OPTION = Symbol.for('@esportsplus/ui/select.expand.option');

const EXPAND_TRIGGER = Symbol.for('@esportsplus/ui/select.expand.trigger');


// The current option on a button. Opening morphs it into a row of every option laid over the button, the current one
// where the button's content was, the way a select menu opens over its value. Picking one folds the row back around it
// onto the button; clicking outside or Escape closes it where it opened, as does the pointer leaving when it opens on
// hover.
function template({
    label,
    name,
    openOn = 'click',
    options,
    selected: initial,
    state = reactive<State>({ error: '', selected: initial ?? options[0]?.value }),
    ...attributes
}: A) {
    let elements: HTMLElement[] = [],
        menu: HTMLElement | undefined,
        opening: VoidFunction | undefined,
        status = reactive({ active: false, landing: false, pinned: null as number | null }),
        trigger: HTMLElement | undefined;

    function close(focus = false) {
        opening?.();
        opening = undefined;
        status.active = false;

        if (focus) {
            trigger?.focus();
        }
    }

    // The row is placed by the option it opened on and holds there until it has fully closed, so a pick doesn't slide
    // it sideways mid-close, and reopening mid-close picks up where it is.
    function index() {
        return status.pinned ?? selected();
    }

    // Placed before the morph measures it, which seeds the close onto the trigger from that same box. A keyboard open
    // moves focus into the row once it is no longer inert.
    function open(focus = false) {
        if (!menu || !trigger || opening || status.active) {
            return;
        }

        if (getComputedStyle(menu).visibility === 'hidden') {
            status.landing = false;
            status.pinned = selected();
            flush();
        }

        opening = morph(trigger, () => {
            opening = undefined;
            status.active = true;

            if (focus) {
                flush();
                elements[selected()]?.focus();
            }
        }, menu, trigger);
    }

    // The close lands on a trigger-sized box around the picked option, as insets on the row's own box, while the row
    // slides that option onto the trigger, so the button seems to fold back around the choice.
    function pick(i: number) {
        let element = elements[i];

        state.selected = options[i].value;

        if (!element || !menu || !trigger) {
            close(true);
            return;
        }

        let box = menu.getBoundingClientRect(),
            rect = element.getBoundingClientRect(),
            scale = box.width / menu.offsetWidth || 1,
            size = trigger.getBoundingClientRect(),
            target = shape(menu),
            x = (rect.left + rect.right - size.width) / 2,
            y = (rect.top + rect.bottom - size.height) / 2;

        target.bottom = `${(box.bottom - y - size.height) / scale}px`;
        target.left = `${(x - box.left) / scale}px`;
        target.right = `${(box.right - x - size.width) / scale}px`;
        target.top = `${(y - box.top) / scale}px`;
        status.landing = true;
        status.pinned = i;
        close(true);
    }

    function selected() {
        let value = state.selected;

        for (let i = 0, n = options.length; i < n; i++) {
            if (options[i].value === value) {
                return i;
            }
        }

        return 0;
    }

    onCleanup(() => {
        opening?.();
    });

    let hover = openOn === 'hover';

    return html`
        <div
            class='select-expand tooltip'
            ${attributes}
            ${{
                class: [
                    () => status.active && '--active',
                    () => status.landing && 'select-expand--landing'
                ],
                ondocumentclick: dismiss(() => status.active, () => close()),
                onkeydown: (event: KeyboardEvent) => {
                    if (!status.active) {
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

                    let i = elements.indexOf(document.activeElement as HTMLElement),
                        n = elements.length;

                    event.preventDefault();
                    elements[((i === -1 ? selected() : i) + step + n) % n]?.focus();
                },
                // Touch has no hover to leave, so a tap opens through the click alone.
                onpointerenter: hover ? ((event: PointerEvent) => {
                    if (event.pointerType !== 'touch') {
                        open();
                    }
                }) : undefined,
                onpointerleave: hover ? ((event: PointerEvent) => {
                    if (event.pointerType !== 'touch') {
                        close();
                    }
                }) : undefined,
                style: () => `--count: ${options.length}; --index: ${index()};`
            }}
        >
            <button
                aria-haspopup='true'
                class='button button--feedback select-expand-trigger'
                type='button'
                ${attributes[EXPAND_TRIGGER]}
                ${{
                    'aria-expanded': () => status.active ? 'true' : 'false',
                    'aria-label': () => `${label}: ${options[selected()]?.label ?? ''}`,
                    onclick: (event: MouseEvent) => {
                        if (status.active || opening) {
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
                ${faces(() => options[selected()]?.value ?? '', options.map((option) => ({
                    content: option.content(),
                    key: option.value
                })))}
            </button>

            <div
                aria-label='${label}'
                class='select-expand-menu tooltip-content tooltip-content--c tooltip-content--morph'
                role='radiogroup'
                ${{
                    inert: () => !status.active,
                    onconnect: (element: HTMLElement) => {
                        menu = element;
                    }
                }}
            >
                ${options.map((option, i) => html`
                    <button
                        aria-label='${option.label}'
                        class='select-expand-option'
                        role='radio'
                        title='${option.label}'
                        type='button'
                        ${attributes[EXPAND_OPTION]}
                        ${{
                            'aria-checked': () => state.selected === option.value ? 'true' : 'false',
                            onclick: () => pick(i),
                            onconnect: (element: HTMLElement) => {
                                elements[i] = element;
                            }
                        }}
                    >
                        ${option.content()}
                    </button>
                `)}
            </div>

            ${name && html`
                <input
                    type='hidden'
                    ${{
                        name,
                        onconnect: form.input.onconnect(state),
                        value: () => state.selected
                    }}
                />
            `}
        </div>
    `;
}


export default component(template, { option: EXPAND_OPTION, trigger: EXPAND_TRIGGER });
export { EXPAND_OPTION, EXPAND_TRIGGER };
export type { A, Option, State };
