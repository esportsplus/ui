import { component, html, type Attributes } from '@esportsplus/template';
import { computed, dispose, effect, onCleanup, reactive, read } from '@esportsplus/reactivity';
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

type State = {
    date: Value;
    // Pins "now" to this moment instead of the live clock (tests, replays); null follows the clock.
    now: number | null;
};

type Value = Date | number | string | null;


const DATE_FORMAT = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });

const DAY = 24 * 60 * 60 * 1000;

const HOUR = 60 * 60 * 1000;

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

// Takes elements out of the flow where they stand, so what replaces them takes their place while they roll away. All are
// measured before any moves, so the batch costs one layout.
function leave(elements: HTMLElement[]) {
    let offsets = elements.map((element) => [element.offsetLeft, element.offsetTop]);

    for (let i = 0, n = elements.length; i < n; i++) {
        let style = elements[i].style;

        style.left = `${offsets[i][0]}px`;
        style.top = `${offsets[i][1]}px`;
        elements[i].classList.add('--exiting');
    }
}

// Keyed from the right, so 9 -> 10 rolls the ones and brings a new tens digit in beside it.
function render(digits: HTMLElement, rest: HTMLElement, text: string) {
    let match = text.match(/^(\d+)(.*)$/),
        next = match ? match[1] : '',
        suffix = match ? match[2] : text;

    if (!rest.firstChild) {
        digits.replaceChildren(...[...next].map((digit) => slot(digit, 'relative-time-slot')));
        rest.replaceChildren(span(suffix, 'relative-time-rest'));
        return;
    }

    let leaving: HTMLElement[] = [],
        slots = settled(digits);

    for (let key = 1, n = Math.max(slots.length, next.length); key <= n; key++) {
        let digit = next[next.length - key],
            element = slots[slots.length - key];

        if (!element) {
            digits.prepend(slot(digit, 'relative-time-slot --entering'));
        }
        else if (digit === undefined) {
            leaving.push(element);
        }
        else {
            swap(element, digit, 'relative-time-digit', leaving);
        }
    }

    swap(rest, suffix, 'relative-time-rest', leaving);
    leave(leaving);
}

// Cancelled too (an ancestor hidden mid-roll), or the element would linger out of the flow.
function retire(e: AnimationEvent) {
    if (e.animationName === 'relative-time-exit') {
        (e.target as Element).remove();
    }
}

// Children still in the flow; ones rolling away are on their way out.
function settled(container: HTMLElement) {
    return container.querySelectorAll<HTMLElement>(':scope > :not(.--exiting)');
}

function slot(digit: string, className: string) {
    let element = span('', className);

    element.append(span(digit, 'relative-time-digit'));

    return element;
}

function span(text: string, className: string) {
    let element = document.createElement('span');

    element.className = className;
    element.textContent = text;

    return element;
}

function swap(container: HTMLElement, text: string, className: string, leaving: HTMLElement[]) {
    let current = settled(container)[0];

    if (current?.textContent === text) {
        return;
    }

    if (current) {
        leaving.push(current);
    }

    container.append(span(text, `${className} --entering`));
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
        digits: HTMLElement | undefined,
        id = `relative-time-${++uid}`,
        message: HTMLElement | undefined,
        rests: HTMLElement | undefined,
        stopRender: VoidFunction | undefined,
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
        stopSchedule = effect(schedule);

    onCleanup(() => {
        clearTimeout(timer);
        dispose(text);
        dispose(time);
        stopNudge();
        stopRender?.();
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
                onconnect: () => {
                    let numbers = digits,
                        rest = rests;

                    if (!numbers || !rest) {
                        return;
                    }

                    stopRender = effect(() => {
                        let value = read(text);

                        if (value !== null) {
                            render(numbers, rest, value);
                        }
                    });
                },
                ondisconnect: () => {
                    stopRender?.();
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
                class='relative-time-roll ${() => state.date === null && '--placeholder'}'
                ${{
                    onanimationcancel: retire,
                    onanimationend: retire
                }}
            >
                <span
                    class='relative-time-digits'
                    ${{
                        onrender: (element: HTMLElement) => {
                            digits = element;
                        }
                    }}
                ></span>
                <span
                    class='relative-time-rests'
                    ${{
                        onrender: (element: HTMLElement) => {
                            rests = element;
                        }
                    }}
                ></span>
            </span>
            <span
                class='tooltip-message tooltip-message--n relative-time-tooltip'
                id='${id}'
                role='tooltip'
                ${this?.attributes?.[RELATIVE_TIME_TOOLTIP]}
                ${attributes[RELATIVE_TIME_TOOLTIP]}
                ${{
                    onrender: (element: HTMLElement) => {
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
