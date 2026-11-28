import { effect, onCleanup, reactive, signal, write } from '@esportsplus/reactivity';
import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import check from '@esportsplus/ui/svg/check.svg';
import chevron from '@esportsplus/ui/svg/chevron.svg';
import chevrons from '@esportsplus/ui/svg/chevrons-up-down.svg';
import form from '~/components/form';
import highlight from '~/components/highlight';
import icon from '~/components/icon';
import overlay from '~/components/overlay';
import scrollbar from '~/modifiers/scrollbar';
import { clamp } from '~/shared/clamp';
import { follow } from '~/shared/follow';
import expand from './expand';
import place, { ROWS } from './placement';
import './scss/index.scss';


type A = Attributes & {
    onanimationcancel?: never;
    onanimationend?: never;
    onanimationstart?: never;
    onclick?: never;
    ondocumentclick?: never;
    ontransitioncancel?: never;
    ontransitionend?: never;
    ontransitionrun?: never;
    [SELECT_ARROW]?: Attributes;
    [SELECT_OPTION]?: Attributes;
    [SELECT_PANEL]?: Attributes;
    [SELECT_TRIGGER]?: Attributes;
    label?: string;
    name?: string;
    options: Option[] | Record<number | string, Renderable<unknown> | { content: Renderable<unknown>, icon?: string, selected?: Renderable<unknown> }>;
} & ({ selected?: number | string; state?: never } | { selected?: never; state: State });

type Option = {
    // Replaces the whole row (check, icon, label and detail); a '.select-menu-option-label' inside it keeps the open
    // panel's text aligned with the trigger's, and a '.select-menu-check' still shows on the chosen row.
    content?: Renderable<unknown>;
    detail?: string;
    // A sprite href, as 'icon' takes, shown before the label in its row and in the trigger while chosen.
    icon?: string;
    label: Renderable<unknown>;
    selected?: Renderable<unknown>;
    text?: string;
    value: string;
};

type Parts = {
    // The first option and its label; every option shares their size and inset.
    label?: HTMLElement;
    layer?: HTMLElement;
    option?: HTMLElement;
    panel?: HTMLElement;
    scroller?: HTMLElement;
    trigger?: HTMLElement;
    value?: HTMLElement;
};

type State = {
    active: boolean;
    error: string;
    render?: boolean;
    selected?: number | string;
};


// Scroll-button speed while hovered, in px per second.
const SCROLL_SPEED = 280;

const SELECT_ARROW = Symbol.for('@esportsplus/ui/select.arrow');

const SELECT_OPTION = Symbol.for('@esportsplus/ui/select.option');

const SELECT_PANEL = Symbol.for('@esportsplus/ui/select.panel');

const SELECT_TRIGGER = Symbol.for('@esportsplus/ui/select.trigger');

// Letters typed within this window extend the search instead of restarting it.
const TYPEAHEAD_RESET = 500;


let uid = 0;


function edges(menu: { down: boolean; up: boolean }, scroller: HTMLElement) {
    menu.down = scroller.scrollTop < scroller.scrollHeight - scroller.clientHeight - 1;
    menu.up = scroller.scrollTop > 1;
}

function template(
    this: { attributes?: Partial<A> } | void,
    {
        label,
        name,
        options: choices,
        selected: initial,
        state = reactive<State>({ active: false, error: '', render: false, selected: initial ?? (Array.isArray(choices) ? choices[0]?.value : Object.keys(choices)[0]) }),
        ...attributes
    }: A,
    content: (state: State) => Renderable<unknown>
) {
    let defaults = this?.attributes,
        ariaLabel = attributes['aria-label'] ?? defaults?.['aria-label'],
        options: Option[] = Array.isArray(choices) ? choices : Object.entries(choices).map(([value, choice]) => {
            if (choice !== null && typeof choice === 'object' && 'content' in choice) {
                return { value, icon: choice.icon, label: choice.content, selected: choice.selected, text: typeof choice.content === 'string' ? choice.content : value };
            }

            return { value, label: choice, text: typeof choice === 'string' ? choice : value };
        }),
        // Once any option has an icon every row and the trigger hold its slot, so the text lines up across them.
        iconic = options.some((option) => option.icon),
        // Private mirrors the options select on, so a move or a pick restyles two options rather than every one.
        chosen = signal(''),
        following: VoidFunction | undefined,
        frame = 0,
        highlighted = signal(0),
        id = `select-menu-${++uid}`,
        last = { x: -1, y: -1 },
        menu = reactive({ down: false, highlight: 0, hover: false, placement: '', up: false }),
        parts: Parts = {},
        query = '',
        texts: string[] | undefined,
        timer: ReturnType<typeof setTimeout> | undefined,
        // The select's border box in the viewport, which the layer covers while it's in the top layer.
        view = reactive({
            height: undefined as number | undefined,
            left: undefined as number | undefined,
            top: undefined as number | undefined,
            width: undefined as number | undefined
        });

    function choose(index: number) {
        if (!options[index]) {
            return;
        }

        state.selected = options[index].value;
        close();
    }

    function close() {
        state.active = false;
    }

    // Placed before the text in both the rows and the trigger, which share one gap, so lining up their text, as the
    // panel's placement does, lines up the icons too. An option without one keeps an empty box of the same size.
    function glyph(option?: Option) {
        if (!iconic) {
            return;
        }

        if (option?.icon) {
            return icon({ 'aria-hidden': 'true', class: 'select-menu-icon' }, option.icon);
        }

        return html`<span aria-hidden='true' class='icon select-menu-icon'></span>`;
    }

    // Keyboard moves keep the highlight in view; pointer moves never scroll.
    function move(index: number) {
        if (!options.length) {
            return;
        }

        let next = clamp(index, 0, options.length - 1),
            scroller = parts.scroller;

        menu.highlight = next;

        if (!scroller) {
            return;
        }

        let item = parts.option?.offsetHeight ?? 0,
            pad = parseFloat(getComputedStyle(scroller).paddingTop) || 0,
            top = pad + next * item;

        if (top < scroller.scrollTop + pad) {
            scroller.scrollTop = top - pad;
        }
        else if (top + item > scroller.scrollTop + scroller.clientHeight - pad) {
            scroller.scrollTop = top + item - scroller.clientHeight + pad;
        }
    }

    function onkeydown(e: KeyboardEvent) {
        let typing = query !== '';

        if (!state.active) {
            if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key) && !(e.key === ' ' && typing)) {
                e.preventDefault();
                open();
                return;
            }
        }
        else {
            let active = menu.highlight,
                page = ROWS - 1,
                moves: Record<string, number> = {
                    ArrowDown: active + 1,
                    ArrowUp: active - 1,
                    End: options.length - 1,
                    Home: 0,
                    PageDown: active + page,
                    PageUp: active - page
                };

            if (e.key === 'ArrowUp' && e.altKey) {
                e.preventDefault();
                choose(active);
                return;
            }

            if (e.key in moves) {
                e.preventDefault();
                move(moves[e.key]);
                return;
            }

            if (e.key === 'Enter' || (e.key === ' ' && !typing)) {
                e.preventDefault();
                choose(active);
                return;
            }

            if (e.key === 'Escape') {
                e.preventDefault();
                close();
                return;
            }

            // Tab commits the highlighted option and moves on, per the APG pattern.
            if (e.key === 'Tab') {
                choose(active);
                return;
            }
        }

        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            search(e.key);
        }
    }

    // Into the top layer and placed before it turns active, so the panel lays out to be measured and its entrance
    // starts from the closed styles.
    function open() {
        let { label, layer, option, panel, scroller, trigger, value } = parts,
            index = selected();

        menu.highlight = index;
        state.render = true;

        if (layer && !layer.matches(':popover-open')) {
            layer.showPopover();
        }

        track();

        if (layer?.parentElement) {
            following ??= follow(layer.parentElement, track);
        }

        if (label && option && panel && scroller && trigger && value) {
            let placed = place({ label, option, panel, scroller, trigger, value }, options.length, index);

            menu.placement = placed.style;
            scroller.scrollTop = placed.scroll;
            edges(menu, scroller);
        }

        state.active = true;
    }

    function scroll(direction: 1 | -1, e: PointerEvent) {
        if (e.pointerType === 'touch') {
            return;
        }

        let previous = performance.now();

        stop();

        function tick(now: number) {
            if (!parts.scroller) {
                return;
            }

            parts.scroller.scrollTop += (direction * SCROLL_SPEED * (now - previous)) / 1000;
            previous = now;
            frame = requestAnimationFrame(tick);
        }

        frame = requestAnimationFrame(tick);
    }

    function search(character: string) {
        clearTimeout(timer);
        query += character.toLowerCase();
        timer = setTimeout(() => {
            query = '';
        }, TYPEAHEAD_RESET);

        // Pressing the same letter again cycles through its matches.
        let repeated = [...query].every((c) => c === query[0]),
            from = state.active ? menu.highlight : selected(),
            needle = repeated ? query[0] : query,
            start = repeated ? from + 1 : from;

        if (!texts) {
            texts = [];

            for (let i = 0, n = options.length; i < n; i++) {
                let option = options[i];

                texts.push((option.text ?? (typeof option.label === 'string' ? option.label : '')).toLowerCase());
            }
        }

        for (let i = 0, n = options.length; i < n; i++) {
            let index = (start + i) % n;

            if (!texts[index].startsWith(needle)) {
                continue;
            }

            // Closed, it changes the value directly, like a native select.
            if (state.active) {
                move(index);
            }
            else {
                state.selected = options[index].value;
            }

            return;
        }
    }

    function selected() {
        let value = String(state.selected ?? '');

        for (let i = 0, n = options.length; i < n; i++) {
            if (options[i].value === value) {
                return i;
            }
        }

        return 0;
    }

    function stop() {
        cancelAnimationFrame(frame);
    }

    // Lays the layer over the select's box as it stands now.
    function track() {
        let root = parts.layer?.parentElement;

        if (!root) {
            return;
        }

        let bounds = root.getBoundingClientRect();

        view.height = bounds.height;
        view.left = bounds.left;
        view.top = bounds.top;
        view.width = bounds.width;
    }

    function wheel(e: WheelEvent) {
        let scroller = parts.scroller;

        if (!scroller || e.ctrlKey || e.defaultPrevented || !e.deltaY) {
            return;
        }

        // Wheel input takes over from the arrow's hover scrolling.
        stop();

        if (scroller.contains(e.target as Node)) {
            return;
        }

        // The arrows overlay the list as siblings, so their wheel events cannot reach its native scroll container. Forward
        // only those surface events.
        let unit = e.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? scroller.clientHeight
            : e.deltaMode === WheelEvent.DOM_DELTA_LINE
                ? parseFloat(getComputedStyle(scroller).lineHeight) || parts.option?.offsetHeight || 16
                : 1;

        e.preventDefault();
        scroller.scrollTop += e.deltaY * unit;
    }

    onCleanup(() => {
        clearTimeout(timer);
        following?.();
        stop();
    });

    effect(() => state.active, (active) => {
        if (!active) {
            stop();
        }
    });

    effect(() => menu.highlight, (index) => {
        write(highlighted, index);
    });

    effect(() => String(state.selected ?? ''), (value) => {
        write(chosen, value);
    });

    return html`
        <div
            class='select select-menu'
            ${defaults}
            ${attributes}
            ${overlay.popup({
                // Stops following once the close has played out and the layer has left the top layer.
                onclosed: () => {
                    following?.();
                    following = undefined;
                },
                popover: true,
                state,
                target: () => parts.layer
            })}
        >
            <span class='select-menu-label' id='${id}-label'>${label ?? defaults?.label ?? String(ariaLabel ?? 'Select option')}</span>
            <button
                aria-controls='${id}-list'
                aria-haspopup='listbox'
                aria-labelledby='${id}-label ${id}-value'
                class='select-menu-trigger'
                role='combobox'
                type='button'
                disabled='${attributes.disabled === true || defaults?.disabled === true}'
                aria-label='${ariaLabel === undefined ? undefined : String(ariaLabel)}'
                ${defaults?.[SELECT_TRIGGER]}
                ${attributes[SELECT_TRIGGER]}
                ${{
                    'aria-activedescendant': () => state.active && `${id}-option-${menu.highlight}`,
                    'aria-expanded': () => state.active ? 'true' : 'false',
                    // A press inside the panel keeps focus here, so losing it is leaving the menu.
                    onblur: close,
                    onclick: () => {
                        if (state.active) {
                            close();
                        }
                        else {
                            open();
                        }
                    },
                    onconnect: (element: HTMLElement) => {
                        parts.trigger = element;
                    },
                    onkeydown
                }}
            >
                ${!content && (() => glyph(options[selected()]))}
                <span
                    class='select-menu-value'
                    id='${id}-value'
                    ${{
                        onconnect: (element: HTMLElement) => {
                            parts.value = element;
                        }
                    }}
                >
                    ${content ? (() => content(state)) : (() => {
                        let option = options[selected()];

                        return option?.selected ?? option?.label ?? '';
                    })}
                </span>
                ${icon(
                    {
                        ...defaults?.[SELECT_ARROW],
                        ...attributes[SELECT_ARROW],
                        'aria-hidden': 'true',
                        class: ['select-menu-chevron', defaults?.[SELECT_ARROW]?.class ?? [], attributes[SELECT_ARROW]?.class ?? []].flat()
                    },
                    chevrons
                )}
            </button>
            <input
                type='hidden'
                ${{
                    name: name ?? defaults?.name,
                    onconnect: form.input.onconnect(state),
                    value: () => state.selected
                }}
            />
            <div
                class='select-menu-layer'
                popover='manual'
                ${{
                    onconnect: (element: HTMLElement) => {
                        parts.layer = element;
                    },
                    style: () => ({
                        height: view.height === undefined ? undefined : `${view.height}px`,
                        left: view.left === undefined ? undefined : `${view.left}px`,
                        top: view.top === undefined ? undefined : `${view.top}px`,
                        width: view.width === undefined ? undefined : `${view.width}px`
                    })
                }}
            >
                <div
                    class='select-menu-panel'
                    ${defaults?.[SELECT_PANEL]}
                    ${attributes[SELECT_PANEL]}
                    ${{
                        class: () => state.active && '--active',
                        inert: () => !state.active,
                        onconnect: (element: HTMLElement, on) => {
                            on(element, 'wheel', wheel, { direct: true, passive: false });
                            parts.panel = element;
                        },
                        // The trigger keeps focus through a press in here, so the keys still drive the menu.
                        onmousedown: (e: MouseEvent) => {
                            e.preventDefault();
                        },
                        onpointerenter: (e: PointerEvent) => {
                            if (e.pointerType !== 'touch') {
                                menu.hover = true;
                            }
                        },
                        onpointerleave: () => {
                            menu.hover = false;
                            stop();
                        },
                        style: () => menu.placement
                    }}
                >
                    <div
                        class='select-menu-scroller'
                        ${scrollbar({ fade: true })}
                        ${{
                            // Bound rather than an 'onscroll' key, which would replace the fade's own fallback listener.
                            onconnect: (element: HTMLElement, on) => {
                                on(element, 'scroll', () => edges(menu, element), { direct: true, passive: true });
                                parts.scroller = element;
                            }
                        }}
                    >
                        ${highlight({ class: 'highlight--surface-primary', hover: false, target: '.select-menu-option' })}
                        <div aria-labelledby='${id}-label' id='${id}-list' role='listbox'>
                            ${options.map((option, index) => html`
                                <div
                                    class='select-menu-option'
                                    id='${id}-option-${index}'
                                    role='option'
                                    ${defaults?.[SELECT_OPTION]}
                                    ${attributes[SELECT_OPTION]}
                                    ${index === 0 && {
                                        // The first option, and its label once connected ahead of it, stand in for every
                                        // option when the panel is placed.
                                        onconnect: (element: HTMLElement) => {
                                            parts.label ??= element;
                                            parts.option = element;
                                        }
                                    }}
                                    ${{
                                        'aria-selected': () => signal.selector(chosen, option.value) ? 'true' : 'false',
                                        class: () => signal.selector(highlighted, index) && '--hover',
                                        onclick: () => choose(index),
                                        onpointermove: (e: PointerEvent) => {
                                            // Scrolling under a still cursor can fire synthetic moves; only real movement
                                            // takes the highlight.
                                            if (e.pointerType === 'touch' || (last.x === e.clientX && last.y === e.clientY)) {
                                                return;
                                            }

                                            last = { x: e.clientX, y: e.clientY };

                                            if (menu.highlight !== index) {
                                                menu.highlight = index;
                                            }
                                        }
                                    }}
                                >
                                    ${option.content ?? html`
                                        ${icon({ 'aria-hidden': 'true', class: 'select-menu-check' }, check)}
                                        ${glyph(option)}
                                        <span
                                            class='select-menu-option-label'
                                            ${index === 0 && {
                                                onconnect: (element: HTMLElement) => {
                                                    parts.label = element;
                                                }
                                            }}
                                        >
                                            ${option.label}
                                        </span>
                                        ${option.detail && html`<span class='select-menu-option-detail'>${option.detail}</span>`}
                                    `}
                                </div>
                            `)}
                        </div>
                    </div>
                    <div
                        aria-hidden='true'
                        class='select-menu-scroll select-menu-scroll--up'
                        ${{
                            class: () => menu.hover && menu.up && '--active',
                            onpointerenter: (e: PointerEvent) => scroll(-1, e),
                            onpointerleave: stop
                        }}
                    >
                        ${icon({ class: 'select-menu-scroll-icon icon--up' }, chevron)}
                    </div>
                    <div
                        aria-hidden='true'
                        class='select-menu-scroll select-menu-scroll--down'
                        ${{
                            class: () => menu.hover && menu.down && '--active',
                            onpointerenter: (e: PointerEvent) => scroll(1, e),
                            onpointerleave: stop
                        }}
                    >
                        ${icon({ class: 'select-menu-scroll-icon icon--down' }, chevron)}
                    </div>
                </div>
            </div>
        </div>
    `;
}


const plain = component(template, { arrow: SELECT_ARROW, option: SELECT_OPTION, panel: SELECT_PANEL, trigger: SELECT_TRIGGER });

const select: typeof plain & { expand: typeof expand } = Object.assign(plain, { expand });


export default select;
export type { Option };
