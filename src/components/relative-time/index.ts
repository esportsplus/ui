import { component, html, type Attributes } from '@esportsplus/template';
import { computed, dispose, effect, onCleanup, reactive, ReactiveArray, read, untrack } from '@esportsplus/reactivity';
import tooltip from '~/components/tooltip';
import './scss/index.scss';


type A = Attributes & {
    [RELATIVE_TIME_TOOLTIP]?: Attributes;
    date: Value;
    onanimationcancel?: never;
    onanimationend?: never;
    onanimationstart?: never;
    ondocumentkeydown?: never;
    ondocumentvisibilitychange?: never;
    onfocusin?: never;
    onfocusout?: never;
    onmouseout?: never;
    onmouseover?: never;
    onpointermove?: never;
    ontransitioncancel?: never;
    ontransitionend?: never;
    ontransitionrun?: never;
    state?: State;
};

// A digit slot (holding its digits), a digit or the rest of the text; one rolling away keeps where it stood.
type Item = {
    element?: HTMLElement;
    entering: boolean;
    glyphs?: ReactiveArray<Item>;
    list: ReactiveArray<Item>;
    state: { exiting: boolean, left: number, top: number };
    text: string;
};

type Rendered = HTMLElement & { [ITEM]?: Item };

type State = {
    date: Value;
    // Pins "now" to this moment instead of the live clock (tests, replays); null follows the clock.
    now: number | null;
};

type Value = Date | number | string | null;


const DATE_FORMAT = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });

const DAY = 24 * 60 * 60 * 1000;

const HOUR = 60 * 60 * 1000;

const ITEM = Symbol();

// setTimeout overflows past ~24.8 days and fires immediately.
const MAX_TIMEOUT = 2 ** 31 - 1;

const MIN = 60 * 1000;

const RELATIVE_TIME_TOOLTIP = Symbol.for('@esportsplus/ui/relative-time.tooltip');

const SEC = 1000;

// Lands just past the boundary so floor() has definitely moved.
const SETTLE = 20;

// The first tooltip waits so passing over text doesn't flash it; neighbours then open instantly while warm.
const TOOLTIP_DELAY = 400;

const TOOLTIP_FORMAT = new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    weekday: 'short',
    year: 'numeric'
});

const VIEWPORT_GUTTER = 8;

const WEEK = 7 * DAY;


let uid = 0;


// What an item renders as: rolling in when it arrives, and once leaving, out of the flow where it stood.
function bind(item: Item, block: string): Attributes {
    return {
        class: () => item.state.exiting && `${block}--exiting`,
        onconnect: (element: Rendered) => {
            element[ITEM] = item;
            item.element = element;
        },
        style: () => item.state.exiting && `left: ${item.state.left}px; top: ${item.state.top}px;`
    };
}

function digit(text: string, entering: boolean, slots: ReactiveArray<Item>) {
    let glyphs = new ReactiveArray<Item>(),
        slot = item('', entering, slots);

    glyphs.push(item(text, false, glyphs));
    slot.glyphs = glyphs;

    return slot;
}

function glyph(item: Item, block: string) {
    return html`<span class='${block} ${item.entering && `${block}--entering`}' ${bind(item, block)}>${item.text}</span>`;
}

function item(text: string, entering: boolean, list: ReactiveArray<Item>): Item {
    return { entering, list, state: reactive({ exiting: false, left: 0, top: 0 }), text };
}

function label(diff: number, time: number) {
    if (diff < 10 * SEC) {
        return 'just now';
    }

    if (diff < MIN) {
        return `${Math.floor(diff / SEC)} sec ago`;
    }

    if (diff < HOUR) {
        return `${Math.floor(diff / MIN)} min ago`;
    }

    if (diff < DAY) {
        return `${Math.floor(diff / HOUR)} hr ago`;
    }

    if (diff < 2 * DAY) {
        return 'yesterday';
    }

    if (diff < WEEK) {
        return `${Math.floor(diff / DAY)} days ago`;
    }

    return DATE_FORMAT.format(time);
}

// Takes items out of the flow where they stand, so what replaces them takes their place while they roll away. All are
// measured before any moves, so the batch costs one layout.
function leave(items: Item[]) {
    let offsets = items.map(({ element }) => [element?.offsetLeft ?? 0, element?.offsetTop ?? 0]);

    for (let i = 0, n = items.length; i < n; i++) {
        let state = items[i].state;

        state.exiting = true;
        state.left = offsets[i][0];
        state.top = offsets[i][1];
    }
}

// Keyed from the right, so 9 -> 10 rolls the ones and brings a new tens digit in beside it.
function render(slots: ReactiveArray<Item>, rests: ReactiveArray<Item>, text: string) {
    let match = text.match(/^(\d+)(.*)$/),
        next = match ? match[1] : '',
        suffix = match ? match[2] : text;

    if (!rests.length) {
        for (let i = 0, n = next.length; i < n; i++) {
            slots.push(digit(next[i], false, slots));
        }

        rests.push(item(suffix, false, rests));
        return;
    }

    let current = settled(slots),
        leaving: Item[] = [];

    for (let key = 1, n = Math.max(current.length, next.length); key <= n; key++) {
        let char = next[next.length - key],
            slot = current[current.length - key];

        if (!slot) {
            slots.unshift(digit(char, true, slots));
        }
        else if (char === undefined) {
            leaving.push(slot);
        }
        else {
            swap(slot.glyphs!, char, leaving);
        }
    }

    swap(rests, suffix, leaving);
    leave(leaving);
}

// Cancelled too (an ancestor hidden mid-roll), or the item would linger out of the flow.
function retire(e: AnimationEvent) {
    let item = (e.target as Rendered)[ITEM];

    if (e.animationName !== 'relative-time-exit' || !item) {
        return;
    }

    let index = item.list.indexOf(item);

    if (index !== -1) {
        item.list.splice(index, 1);
    }
}

// Items still in the flow; ones rolling away are on their way out.
function settled(list: ReactiveArray<Item>) {
    let out: Item[] = [];

    for (let i = 0, n = list.length; i < n; i++) {
        if (!list[i].state.exiting) {
            out.push(list[i]);
        }
    }

    return out;
}

function swap(list: ReactiveArray<Item>, text: string, leaving: Item[]) {
    let current = settled(list)[0];

    if (current?.text === text) {
        return;
    }

    if (current) {
        leaving.push(current);
    }

    list.push(item(text, true, list));
}

function timeOf(value: Value) {
    return value === null ? null : new Date(value).getTime();
}

// Milliseconds until label() would return something different, so the element wakes once per visible change.
function untilChange(diff: number) {
    if (diff < 0) {
        return -diff;
    }

    if (diff < 10 * SEC) {
        return 10 * SEC - diff;
    }

    if (diff >= WEEK) {
        return HOUR;
    }

    let unit = diff < MIN ? SEC : diff < HOUR ? MIN : diff < DAY ? HOUR : DAY;

    return unit - (diff % unit);
}


function template(this: { attributes?: Partial<A> } | void, { date, state = reactive({ date, now: null as number | null }), ...attributes }: A) {
    let clock = reactive({ tick: 0 }),
        id = `relative-time-${++uid}`,
        message: HTMLElement | undefined,
        rests = new ReactiveArray<Item>(),
        slots = new ReactiveArray<Item>(),
        time = computed(() => timeOf(state.date)),
        text = computed(() => {
            let value = read(time);

            clock.tick;

            return value === null ? null : label((state.now ?? Date.now()) - value, value);
        }),
        timer: ReturnType<typeof setTimeout> | undefined,
        tip = reactive({ active: false });

    function nudge() {
        if (!message) {
            return;
        }

        message.style.right = '';

        // Starts centred on the text; nudged sideways only if that would poke past the viewport.
        let box = message.getBoundingClientRect(),
            max = document.documentElement.clientWidth - VIEWPORT_GUTTER,
            shift = box.left < VIEWPORT_GUTTER ? VIEWPORT_GUTTER - box.left : box.right > max ? max - box.right : 0;

        if (shift) {
            message.style.right = `calc(50% - ${Math.round(shift)}px)`;
        }
    }

    function schedule() {
        clearTimeout(timer);

        let value = read(time);

        if (value === null || state.now !== null) {
            return;
        }

        timer = setTimeout(tick, Math.min(untilChange(Date.now() - value) + SETTLE, MAX_TIMEOUT));
    }

    function tick() {
        clock.tick++;
        schedule();
    }

    let stopNudge = effect(() => {
            if (tip.active) {
                nudge();
            }
        }),
        stopRender = effect(() => {
            let value = read(text);

            if (value !== null) {
                untrack(() => render(slots, rests, value));
            }
        }),
        stopSchedule = effect(schedule);

    onCleanup(() => {
        clearTimeout(timer);
        dispose(text);
        dispose(time);
        stopNudge();
        stopRender();
        stopSchedule();
    });

    return html`
        <time
            class='relative-time tooltip'
            ${this?.attributes}
            ${attributes}
            ${tooltip.onhover.trigger({ delay: { open: TOOLTIP_DELAY }, state: tip })}
            ${{
                'aria-describedby': () => tip.active ? id : '',
                datetime: () => {
                    let value = read(time);

                    return value === null ? '' : new Date(value).toISOString();
                },
                // Background tabs throttle timers; catch up the moment the page is seen.
                ondocumentvisibilitychange: () => {
                    if (document.visibilityState === 'visible') {
                        tick();
                    }
                },
                tabindex: () => state.date === null ? '' : '0'
            }}
        >
            <span class='relative-time-sr'>${() => read(text) ?? ''}</span>
            <span
                aria-hidden='true'
                class='relative-time-roll ${() => state.date === null && 'relative-time-roll--placeholder'}'
                ${{
                    onanimationcancel: retire,
                    onanimationend: retire
                }}
            >
                <span class='relative-time-digits'>${html.reactive(slots, (slot) => html`<span class='relative-time-slot ${slot.entering && 'relative-time-slot--entering'}' ${bind(slot, 'relative-time-slot')}>${html.reactive(slot.glyphs!, (item) => glyph(item, 'relative-time-digit'))}</span>`)}</span>
                <span class='relative-time-rests'>${html.reactive(rests, (item) => glyph(item, 'relative-time-rest'))}</span>
            </span>
            <span
                class='tooltip-message tooltip-message--n relative-time-tooltip'
                id='${id}'
                role='tooltip'
                ${this?.attributes?.[RELATIVE_TIME_TOOLTIP]}
                ${attributes[RELATIVE_TIME_TOOLTIP]}
                ${{
                    onconnect: (element: HTMLElement) => {
                        message = element;
                    }
                }}
            >
                ${() => {
                    let value = read(time);

                    return value === null ? '' : TOOLTIP_FORMAT.format(value);
                }}
            </span>
        </time>
    `;
}


export default component(template, { tooltip: RELATIVE_TIME_TOOLTIP });
export type { State as RelativeTimeState, Value as RelativeTimeValue };
