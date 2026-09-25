import { html, type Attributes } from '@esportsplus/template';
import { onCleanup, reactive } from '@esportsplus/reactivity';
import form from '~/components/form';
import './scss/index.scss';


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

const SELECT_MENU_OPTION = Symbol.for('@esportsplus/ui/select-menu.option');

const SELECT_MENU_PANEL = Symbol.for('@esportsplus/ui/select-menu.panel');

const SELECT_MENU_TRIGGER = Symbol.for('@esportsplus/ui/select-menu.trigger');

// Letters typed within this window extend the search instead of restarting it.
const TYPEAHEAD_RESET = 500;


let uid = 0;


function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

// Puts the selected option exactly over the trigger, the way macOS does, then trades list position for scroll
// position if that runs off screen.
function place({ panel, scroller, trigger, value }: Required<Parts>, count: number, selected: number) {
    let box = trigger.getBoundingClientRect(),
        label = scroller.querySelector<HTMLElement>('.select-menu-option-label'),
        option = scroller.querySelector<HTMLElement>('.select-menu-option');

    if (!label || !option) {
        return 0;
    }

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

    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    // Grows out of the trigger itself, wherever it ended up in the panel.
    panel.style.transformOrigin = `${trigger.offsetLeft + trigger.offsetWidth / 2 - left}px ${trigger.offsetTop + trigger.offsetHeight / 2 - top}px`;
    panel.style.width = `${width}px`;

    return scroll;
}

// Edge fades and scroll buttons follow the scroll position through the DOM directly, so scrolling never
// touches reactive state.
function edges(panel: HTMLElement, scroller: HTMLElement) {
    let down = scroller.scrollTop < scroller.scrollHeight - scroller.clientHeight - 1,
        up = scroller.scrollTop > 1;

    panel.toggleAttribute('data-down', down);
    panel.toggleAttribute('data-up', up);
    scroller.style.maskImage = `linear-gradient(to bottom, transparent, black ${up ? 'var(--fade)' : '0px'}, black calc(100% - ${down ? 'var(--fade)' : '0px'}), transparent)`;
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
        menu = reactive({ highlight: 0 }),
        parts: Parts = {},
        pressing = false,
        query = '',
        timer: ReturnType<typeof setTimeout> | undefined;

    function choose(index: number) {
        state.value = options[index].value;
        close();
    }

    function close() {
        cancelAnimationFrame(frame);
        pressing = false;
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

        let item = scroller.querySelector<HTMLElement>('.select-menu-option')?.offsetHeight ?? 0,
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
        let { panel, scroller, trigger, value } = parts,
            index = selected();

        menu.highlight = index;
        state.active = true;

        if (!panel || !scroller || !trigger || !value) {
            return;
        }

        scroller.scrollTop = place({ panel, scroller, trigger, value }, options.length, index);
        edges(panel, scroller);
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
                ondocumentclick: function(this: HTMLElement, e: MouseEvent) {
                    if (state.active && this.isConnected && !this.contains(e.target as Node | null)) {
                        close();
                    }
                }
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
                    'aria-activedescendant': () => state.active ? `${id}-option-${menu.highlight}` : '',
                    'aria-expanded': () => state.active ? 'true' : 'false',
                    // A press inside the panel moves focus off the trigger; the trigger takes it back on release.
                    onblur: () => {
                        if (!pressing) {
                            close();
                        }
                    },
                    onclick: () => {
                        if (state.active) {
                            close();
                        }
                        else {
                            open();
                        }
                    },
                    onkeydown,
                    onrender: (element: HTMLElement) => {
                        parts.trigger = element;
                    }
                }}
            >
                <span
                    class='select-menu-value'
                    id='${id}-value'
                    ${{
                        onrender: (element: HTMLElement) => {
                            parts.value = element;
                        }
                    }}
                >
                    ${() => options[selected()]?.label ?? ''}
                </span>
                <svg aria-hidden='true' class='select-menu-chevron' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' viewBox='0 0 16 16'>
                    <path d='m5 6.25 3-3 3 3M5 9.75l3 3 3-3' />
                </svg>
            </button>
            <input
                class='select-menu-tag'
                type='hidden'
                ${{
                    name,
                    onrender: form.input.onrender(state),
                    value: () => state.value
                }}
            />
            <div
                class='tooltip-content select-menu-panel'
                ${this?.attributes?.[SELECT_MENU_PANEL]}
                ${attributes[SELECT_MENU_PANEL]}
                ${{
                    inert: () => !state.active,
                    onpointerdown: () => {
                        pressing = true;
                    },
                    onpointerenter: function(this: HTMLElement, e: PointerEvent) {
                        if (e.pointerType !== 'touch') {
                            this.setAttribute('data-hover', '');
                        }
                    },
                    onpointerleave: function(this: HTMLElement) {
                        this.removeAttribute('data-hover');
                        stop();
                    },
                    onpointerup: () => {
                        pressing = false;
                        parts.trigger?.focus({ preventScroll: true });
                    },
                    onrender: (element: HTMLElement) => {
                        parts.panel = element;
                    }
                }}
            >
                <div
                    class='select-menu-scroller'
                    ${{
                        onrender: (element: HTMLElement) => {
                            parts.scroller = element;
                        },
                        onscroll: function(this: HTMLElement) {
                            if (parts.panel) {
                                edges(parts.panel, this);
                            }
                        }
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
                                    class: () => menu.highlight === index && '--highlighted',
                                    onclick: () => {
                                        choose(index);
                                        parts.trigger?.focus({ preventScroll: true });
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
                                <svg aria-hidden='true' class='select-menu-check' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' viewBox='0 0 16 16'>
                                    <path d='m3.5 8.5 3 3 6-7' />
                                </svg>
                                <span class='select-menu-option-label'>${option.label}</span>
                                ${option.detail ? html`<span class='select-menu-option-detail'>${option.detail}</span>` : ''}
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
                    <svg fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' viewBox='0 0 16 16'>
                        <path d='m4.5 9.5 3.5-3.5 3.5 3.5' />
                    </svg>
                </div>
                <div
                    aria-hidden='true'
                    class='select-menu-scroll select-menu-scroll--down'
                    ${{
                        onpointerenter: (e: PointerEvent) => scroll(1, e),
                        onpointerleave: stop
                    }}
                >
                    <svg fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' viewBox='0 0 16 16'>
                        <path d='m4.5 6.5 3.5 3.5 3.5-3.5' />
                    </svg>
                </div>
            </div>
        </div>
    `;
}


export default Object.assign(template, { option: SELECT_MENU_OPTION, panel: SELECT_MENU_PANEL, trigger: SELECT_MENU_TRIGGER } as const);
export type { Option };
