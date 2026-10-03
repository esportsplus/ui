import { component, html, type Attributes } from '@esportsplus/template';
import { onCleanup, reactive } from '@esportsplus/reactivity';
import form from '~/components/form';
import dismiss from '~/shared/dismiss';
import check from '@esportsplus/ui/svg/check.svg';
import chevronDown from '@esportsplus/ui/svg/chevron-down.svg';
import chevronUp from '@esportsplus/ui/svg/chevron-up.svg';
import chevrons from '@esportsplus/ui/svg/chevrons-up-down.svg';


type A = Attributes & {
    [SELECT_MENU_OPTION]?: Attributes;
    [SELECT_MENU_PANEL]?: Attributes;
    [SELECT_MENU_TRIGGER]?: Attributes;
    label: string;
    name?: string;
    options: Option[];
    state?: { active: boolean, error: string, value: string };
    value?: string;
};

type Option = {
    detail?: string;
    label: string;
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


// Keeps the panel this far inside the viewport.
const MARGIN = 8;

const ROWS = 8;

// Scroll-button speed while hovered, in px per second.
const SCROLL_SPEED = 280;

const SELECT_MENU_OPTION = Symbol.for('@esportsplus/ui/select.menu.option');

const SELECT_MENU_PANEL = Symbol.for('@esportsplus/ui/select.menu.panel');

const SELECT_MENU_TRIGGER = Symbol.for('@esportsplus/ui/select.menu.trigger');

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

// Puts the selected option exactly over the trigger, the way macOS does, then trades list position for scroll
// position if that runs off screen.
function place({ label, option, panel, scroller, trigger, value }: Required<Parts>, count: number, selected: number) {
    let box = trigger.getBoundingClientRect();

    // Demo previews may scale the component down; work in the element's own pixels.
    let scale = box.height / trigger.offsetHeight || 1,
        item = option.offsetHeight,
        pad = parseFloat(getComputedStyle(scroller).paddingTop) || 0,
        rows = Math.min(count, parseInt(getComputedStyle(panel).getPropertyValue('--rows'), 10) || ROWS),
        height = rows * item + pad * 2,
        maxScroll = (count - rows) * item,
        scroll = clamp((selected - Math.floor(rows / 2)) * item, 0, maxScroll),
        // Shifting the panel left by this lands every option's text exactly on the trigger's text.
        shift = label.offsetLeft - (value.offsetLeft - trigger.offsetLeft),
        top = trigger.offsetTop + (trigger.offsetHeight - item) / 2 - (pad + selected * item - scroll);

    let maxBottom = trigger.offsetTop + (innerHeight - MARGIN - box.top) / scale,
        minTop = trigger.offsetTop + (MARGIN - box.top) / scale;

    if (top < minTop) {
        let d = minTop - top;

        top += d;
        scroll += Math.min(d, maxScroll - scroll);
    }

    if (top + height > maxBottom) {
        let d = top + height - maxBottom;

        top -= d;
        scroll -= Math.min(d, scroll);
    }

    let width = trigger.offsetWidth + shift,
        left = Math.max(
            trigger.offsetLeft + (MARGIN - box.left) / scale,
            Math.min(trigger.offsetLeft - shift, trigger.offsetLeft + (innerWidth - MARGIN - box.left) / scale - width)
        );

    return {
        scroll,
        // Grows out of the trigger itself, wherever it ended up in the panel.
        style: `
            left: ${left}px;
            top: ${top}px;
            transform-origin: ${trigger.offsetLeft + trigger.offsetWidth / 2 - left}px ${trigger.offsetTop + trigger.offsetHeight / 2 - top}px;
            width: ${width}px;
        `
    };
}

function template(
    this: { attributes?: Pick<A, typeof SELECT_MENU_OPTION | typeof SELECT_MENU_PANEL | typeof SELECT_MENU_TRIGGER> } | void,
    {
        label,
        name,
        options,
        value,
        state = reactive({ active: false, error: '', value: value ?? options[0]?.value ?? '' }),
        ...attributes
    }: A
) {
    let frame = 0,
        id = `select-menu-${++uid}`,
        last = { x: -1, y: -1 },
        menu = reactive({ down: false, highlight: 0, hover: false, placement: '', up: false }),
        parts: Parts = {},
        query = '',
        timer: ReturnType<typeof setTimeout> | undefined;

    function choose(index: number) {
        state.value = options[index].value;
        close();
    }

    function close() {
        cancelAnimationFrame(frame);
        state.active = false;
    }

    // Keyboard moves keep the highlight in view; pointer moves never scroll.
    function highlight(index: number) {
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

            if (!options[index].label.toLowerCase().startsWith(needle)) {
                continue;
            }

            // Closed, it changes the value directly, like a native select.
            if (state.active) {
                highlight(index);
            }
            else {
                state.value = options[index].value;
            }

            return;
        }
    }

    function selected() {
        return Math.max(0, options.findIndex((option) => option.value === state.value));
    }

    function stop() {
        cancelAnimationFrame(frame);
    }

    onCleanup(() => {
        cancelAnimationFrame(frame);
        clearTimeout(timer);
    });

    return html`
        <div
            class='select-menu tooltip'
            ${this?.attributes}
            ${attributes}
            ${{
                class: () => state.active && '--active',
                ondocumentclick: dismiss(() => state.active, close)
            }}
        >
            <span class='select-menu-label' id='${id}-label'>${label}</span>
            <button
                aria-controls='${id}-list'
                aria-haspopup='listbox'
                aria-labelledby='${id}-label ${id}-value'
                class='select-menu-trigger'
                role='combobox'
                type='button'
                ${this?.attributes?.[SELECT_MENU_TRIGGER]}
                ${attributes[SELECT_MENU_TRIGGER]}
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
                    ${() => options[selected()]?.label ?? ''}
                </span>
                <svg aria-hidden='true' class='select-menu-chevron'><use href='#${chevrons}' /></svg>
            </button>
            <input
                class='select-menu-tag'
                type='hidden'
                ${{
                    name,
                    onconnect: form.input.onconnect(state),
                    value: () => state.value
                }}
            />
            <div
                class='tooltip-content select-menu-panel'
                ${this?.attributes?.[SELECT_MENU_PANEL]}
                ${attributes[SELECT_MENU_PANEL]}
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
                                ${this?.attributes?.[SELECT_MENU_OPTION]}
                                ${attributes[SELECT_MENU_OPTION]}
                                ${{
                                    'aria-selected': () => state.value === option.value ? 'true' : 'false',
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


export default component(template, { option: SELECT_MENU_OPTION, panel: SELECT_MENU_PANEL, trigger: SELECT_MENU_TRIGGER });
export type { Option };
