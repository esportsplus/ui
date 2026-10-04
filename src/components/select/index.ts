import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import { effect, onCleanup, reactive } from '@esportsplus/reactivity';
import form from '~/components/form';
import overlay from '~/components/overlay';
import place from './placement';
import check from '@esportsplus/ui/svg/check.svg';
import chevronDown from '@esportsplus/ui/svg/chevron-down.svg';
import chevronUp from '@esportsplus/ui/svg/chevron-up.svg';
import chevrons from '@esportsplus/ui/svg/chevrons-up-down.svg';
import './scss/index.scss';


type State = {
    active: boolean;
    error: string;
    render?: boolean;
    selected?: number | string;
};

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
    [SELECT_TOOLTIP_CONTENT]?: Attributes & { direction?: string };
    [SELECT_TRIGGER]?: Attributes;
    label?: string;
    name?: string;
    options: Option[] | Record<number | string, Renderable<unknown> | { content: Renderable<unknown>, selected: Renderable<unknown> }>;
} & ({ selected?: number | string; state?: never } | { selected?: never; state: State });


type Option = {
    detail?: string;
    label: Renderable<unknown>;
    selected?: Renderable<unknown>;
    text?: string;
    value: string;
};

type Parts = {
    // The first option and its label; every option shares their size and inset.
    label?: HTMLElement;
    option?: HTMLElement;
    panel?: HTMLElement;
    scroller?: HTMLElement;
    trigger?: HTMLElement;
    value?: HTMLElement;
};


const ROWS = 8;

// Scroll-button speed while hovered, in px per second.
const SCROLL_SPEED = 280;

const SELECT_OPTION = Symbol.for('@esportsplus/ui/select.option');

const SELECT_ARROW = Symbol.for('@esportsplus/ui/select.arrow');

const SELECT_TOOLTIP_CONTENT = Symbol.for('@esportsplus/ui/select.tooltip-content');

const SELECT_TRIGGER = Symbol.for('@esportsplus/ui/select.trigger');

// Letters typed within this window extend the search instead of restarting it.
const TYPEAHEAD_RESET = 500;


let uid = 0;


function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

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
                return { value, label: choice.content, selected: choice.selected, text: typeof choice.content === 'string' ? choice.content : value };
            }

            return { value, label: choice, text: typeof choice === 'string' ? choice : value };
        }),
        { direction: _defaultDirection, ...defaultPanel } = defaults?.[SELECT_TOOLTIP_CONTENT] ?? {},
        { direction: _direction, ...panelAttributes } = attributes[SELECT_TOOLTIP_CONTENT] ?? {},
        frame = 0,
        id = `select-menu-${++uid}`,
        last = { x: -1, y: -1 },
        menu = reactive({ down: false, highlight: 0, hover: false, placement: '', up: false }),
        parts: Parts = {},
        query = '',
        timer: ReturnType<typeof setTimeout> | undefined;

    function choose(index: number) {
        if (!options[index]) {
            return;
        }

        state.selected = options[index].value;
        close();
    }

    function close() {
        cancelAnimationFrame(frame);
        state.active = false;
    }

    // Keyboard moves keep the highlight in view; pointer moves never scroll.
    function highlight(index: number) {
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
                highlight(moves[e.key]);
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

    function open() {
        let { label, option, panel, scroller, trigger, value } = parts,
            index = selected();

        menu.highlight = index;
        state.render = true;
        state.active = true;

        if (!label || !option || !panel || !scroller || !trigger || !value) {
            return;
        }

        let placed = place({ label, option, panel, scroller, trigger, value }, options.length, index);

        menu.placement = placed.style;
        scroller.scrollTop = placed.scroll;
        edges(menu, scroller);
    }

    function scroll(direction: 1 | -1, e: PointerEvent) {
        if (e.pointerType === 'touch') {
            return;
        }

        let previous = performance.now();

        cancelAnimationFrame(frame);

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

        for (let i = 0, n = options.length; i < n; i++) {
            let index = (start + i) % n;

            let text = options[index].text ?? (typeof options[index].label === 'string' ? options[index].label as string : '');

            if (!text.toLowerCase().startsWith(needle)) {
                continue;
            }

            // Closed, it changes the value directly, like a native select.
            if (state.active) {
                highlight(index);
            }
            else {
                state.selected = options[index].value;
            }

            return;
        }
    }

    function selected() {
        return Math.max(0, options.findIndex((option) => option.value === String(state.selected ?? '')));
    }

    function stop() {
        cancelAnimationFrame(frame);
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

        // The arrows overlay the list as siblings, so their wheel events cannot
        // reach its native scroll container. Forward only those surface events.
        let unit = e.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? scroller.clientHeight
            : e.deltaMode === WheelEvent.DOM_DELTA_LINE
                ? parseFloat(getComputedStyle(scroller).lineHeight) || parts.option?.offsetHeight || 16
                : 1;

        e.preventDefault();
        scroller.scrollTop += e.deltaY * unit;
    }

    onCleanup(() => {
        cancelAnimationFrame(frame);
        clearTimeout(timer);
    });

    effect(() => state.active, (active) => {
        if (!active) {
            stop();
        }
    });

    return html`
        <div
            class='select select-menu'
            ${defaults}
            ${attributes}
            ${{ ...overlay.popup({ state, target: () => parts.panel }) }}
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
                ${this?.attributes?.[SELECT_TRIGGER]}
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
                <span
                    class='select-menu-value'
                    id='${id}-value'
                    ${{
                        onconnect: (element: HTMLElement) => {
                            parts.value = element;
                        }
                    }}
                >
                    ${content ? (() => content(state)) : (() => options[selected()]?.selected ?? options[selected()]?.label ?? '')}
                </span>
                <svg aria-hidden='true' class='select-menu-chevron' ${this?.attributes?.[SELECT_ARROW]} ${attributes[SELECT_ARROW]}><use href='#${chevrons}' /></svg>
            </button>
            <input
                class='select-menu-tag'
                type='hidden'
                ${{
                    name: name ?? defaults?.name,
                    onconnect: form.input.onconnect(state),
                    value: () => state.selected
                }}
            />
            <div
                class='select-menu-panel'
                ${defaultPanel}
                ${panelAttributes}
                ${{
                    class: [
                        () => menu.down && 'select-menu-panel--down',
                        () => menu.hover && 'select-menu-panel--hover',
                        () => menu.up && 'select-menu-panel--up'
                    ],
                    inert: () => !state.active,
                    onconnect: (element: HTMLElement) => {
                        parts.panel = element;
                    },
                    onactivewheel: wheel,
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
                    ${{
                        onconnect: (element: HTMLElement) => {
                            parts.scroller = element;
                        },
                        onscroll: function(this: HTMLElement) {
                            edges(menu, this);
                        },
                        class: [
                            () => menu.up && 'select-menu-scroller--up',
                            () => menu.down && 'select-menu-scroller--down'
                        ]
                    }}
                >
                    <div aria-labelledby='${id}-label' id='${id}-list' role='listbox'>
                        ${options.map((option, index) => html`
                            <div
                                class='select-menu-option'
                                id='${id}-option-${index}'
                                role='option'
                                ${this?.attributes?.[SELECT_OPTION]}
                                ${attributes[SELECT_OPTION]}
                                ${{
                                    'aria-selected': () => String(state.selected ?? '') === option.value ? 'true' : 'false',
                                    class: () => menu.highlight === index && 'select-menu-option--highlighted',
                                    onclick: () => choose(index),
                                    onconnect: (element: HTMLElement) => {
                                        parts.option ??= element;
                                    },
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
                                <svg aria-hidden='true' class='select-menu-check'><use href='#${check}' /></svg>
                                <span
                                    class='select-menu-option-label'
                                    ${{
                                        onconnect: (element: HTMLElement) => {
                                            parts.label ??= element;
                                        }
                                    }}
                                >
                                    ${option.label}
                                </span>
                                ${option.detail && html`<span class='select-menu-option-detail'>${option.detail}</span>`}
                            </div>
                        `)}
                    </div>
                </div>
                <div
                    aria-hidden='true'
                    class='select-menu-scroll select-menu-scroll--up'
                    ${{
                        onpointerenter: (e: PointerEvent) => scroll(-1, e),
                        onpointerleave: stop
                    }}
                >
                    <svg><use href='#${chevronUp}' /></svg>
                </div>
                <div
                    aria-hidden='true'
                    class='select-menu-scroll select-menu-scroll--down'
                    ${{
                        onpointerenter: (e: PointerEvent) => scroll(1, e),
                        onpointerleave: stop
                    }}
                >
                    <svg><use href='#${chevronDown}' /></svg>
                </div>
            </div>
        </div>
    `;
}


export default component(template, { arrow: SELECT_ARROW, option: SELECT_OPTION, tooltipContent: SELECT_TOOLTIP_CONTENT, trigger: SELECT_TRIGGER });
export type { Option };
