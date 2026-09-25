import { html, type Attributes } from '@esportsplus/template';
import { effect, onCleanup, reactive } from '@esportsplus/reactivity';
import '~/components/tooltip/scss/index.scss';
import './scss/index.scss';


type A = Attributes & {
    [RELATIVE_TIME_TOOLTIP]?: Attributes;
    date: Value;
    ondocumentvisibilitychange?: never;
    onpointerenter?: never;
    onpointerleave?: never;
    state?: State;
};

type State = {
    date: Value;
    // Pins "now" to this moment instead of the live clock (tests, replays); null follows the clock.
    now: number | null;
};

type Value = Date | number | string | null;


const DAY = 24 * 60 * 60 * 1000;

const ENTER: Keyframe[] = [
    { filter: 'blur(3px)', opacity: 0, translate: '0 0.55em' },
    { filter: 'blur(0px)', opacity: 1, translate: '0 0' }
];

// Travels less than the entrance did: the exit shouldn't hold the eye.
const EXIT: Keyframe[] = [
    { filter: 'blur(0px)', opacity: 1, translate: '0 0' },
    { filter: 'blur(3px)', opacity: 0, translate: '0 -0.4em' }
];

const FADE_IN: Keyframe[] = [{ opacity: 0 }, { opacity: 1 }];

const FADE_OUT: Keyframe[] = [{ opacity: 1 }, { opacity: 0 }];

const HOUR = 60 * 60 * 1000;

// setTimeout overflows past ~24.8 days and fires immediately.
const MAX_TIMEOUT = 2 ** 31 - 1;

const MIN = 60 * 1000;

// The first tooltip waits so passing over text doesn't flash it; neighbours then open instantly while warm.
const OPEN_DELAY = 400;

const RELATIVE_TIME_TOOLTIP = Symbol.for('@esportsplus/ui/relative-time.tooltip');

// Long enough to read as motion, short enough that a seconds counter never has two rolls overlapping.
const ROLL: KeyframeAnimationOptions = { duration: 300, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' };

const SEC = 1000;

// Lands just past the boundary so floor() has definitely moved.
const SETTLE = 20;

const TOOLTIP = new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    weekday: 'short',
    year: 'numeric'
});

const VIEWPORT_GUTTER = 8;

const WARM_FOR = 500;

const WEEK = 7 * DAY;


let closedAt = 0,
    uid = 0;


function enter(element: HTMLElement, reduce: boolean) {
    element.animate(reduce ? FADE_IN : ENTER, ROLL);
}

function exit(element: HTMLElement, reduce: boolean) {
    // Leaves the flow at once, so what replaces it takes its place while it rolls away.
    element.style.left = `${element.offsetLeft}px`;
    element.style.position = 'absolute';
    element.style.top = `${element.offsetTop}px`;
    element.animate(reduce ? FADE_OUT : EXIT, { ...ROLL, fill: 'forwards' }).onfinish = () => element.remove();
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

    return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(time);
}

function reduced() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function span(text: string, className: string) {
    let element = document.createElement('span');

    element.className = className;
    element.textContent = text;

    return element;
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
    let clock = reactive({ open: false, tick: 0 }),
        digits: HTMLElement | undefined,
        id = `relative-time-${++uid}`,
        instant = false,
        opener: ReturnType<typeof setTimeout> | undefined,
        rest: HTMLElement | undefined,
        shown: { digits: string; rest: string } | null = null,
        stopRender: VoidFunction | undefined,
        timer: ReturnType<typeof setTimeout> | undefined,
        tooltip: HTMLElement | undefined;

    function hide() {
        clearTimeout(opener);

        if (clock.open) {
            closedAt = Date.now();
        }

        clock.open = false;
    }

    function nudge() {
        if (!tooltip) {
            return;
        }

        tooltip.style.right = '';

        // Starts centred on the text; nudged sideways only if that would poke past the viewport.
        let box = tooltip.getBoundingClientRect(),
            max = document.documentElement.clientWidth - VIEWPORT_GUTTER,
            shift = box.left < VIEWPORT_GUTTER ? VIEWPORT_GUTTER - box.left : box.right > max ? max - box.right : 0;

        if (shift) {
            tooltip.style.right = `calc(50% - ${Math.round(shift)}px)`;
        }
    }

    function open(delayed: boolean) {
        clearTimeout(opener);

        let warm = Date.now() - closedAt < WARM_FOR;

        if (delayed && !warm) {
            instant = false;
            opener = setTimeout(() => {
                nudge();
                clock.open = true;
            }, OPEN_DELAY);
            return;
        }

        instant = warm;
        nudge();
        clock.open = true;
    }

    // Keyed from the right, so 9 -> 10 rolls the ones and brings a new tens digit in beside it.
    function render(text: string) {
        let match = text.match(/^(\d+)(.*)$/),
            next = { digits: match ? match[1] : '', rest: match ? match[2] : text },
            previous = shown,
            reduce = reduced();

        shown = next;

        if (!digits || !rest) {
            return;
        }

        if (!previous) {
            digits.replaceChildren(...[...next.digits].map((digit) => slot(digit)));
            rest.replaceChildren(span(next.rest, 'relative-time-rest'));
            return;
        }

        let slots = Array.from(digits.children as HTMLCollectionOf<HTMLElement>).filter((element) => !element.style.position);

        for (let key = 1, n = Math.max(slots.length, next.digits.length); key <= n; key++) {
            let digit = next.digits[next.digits.length - key],
                element = slots[slots.length - key];

            if (!element) {
                let created = slot(digit);

                digits.prepend(created);
                enter(created, reduce);
                continue;
            }

            if (digit === undefined) {
                exit(element, reduce);
                continue;
            }

            let current = Array.from(element.children as HTMLCollectionOf<HTMLElement>).find((child) => !child.style.position);

            if (current?.textContent === digit) {
                continue;
            }

            let created = span(digit, 'relative-time-digit');

            if (current) {
                exit(current, reduce);
            }

            element.append(created);
            enter(created, reduce);
        }

        if (previous.rest === next.rest) {
            return;
        }

        let created = span(next.rest, 'relative-time-rest'),
            current = Array.from(rest.children as HTMLCollectionOf<HTMLElement>).find((child) => !child.style.position);

        if (current) {
            exit(current, reduce);
        }

        rest.append(created);
        enter(created, reduce);
    }

    function schedule() {
        clearTimeout(timer);

        let time = timeOf(state.date);

        if (time === null || state.now !== null) {
            return;
        }

        timer = setTimeout(() => {
            clock.tick++;
            schedule();
        }, Math.min(untilChange(Date.now() - time) + SETTLE, MAX_TIMEOUT));
    }

    function slot(digit: string) {
        let element = span('', 'relative-time-slot');

        element.append(span(digit, 'relative-time-digit'));

        return element;
    }

    function text() {
        let time = timeOf(state.date);

        clock.tick;

        return time === null ? null : label((state.now ?? Date.now()) - time, time);
    }

    let stopSchedule = effect(() => {
        state.date;
        state.now;
        schedule();
    });

    onCleanup(() => {
        clearTimeout(opener);
        clearTimeout(timer);
        stopRender?.();
        stopSchedule();
    });

    return html`
        <time
            class='relative-time tooltip ${() => clock.open && '--active'} ${() => instant && clock.open && '--instant'}'
            ${this?.attributes}
            ${attributes}
            ${{
                'aria-describedby': () => clock.open ? id : '',
                datetime: () => {
                    let time = timeOf(state.date);

                    return time === null ? '' : new Date(time).toISOString();
                },
                onblur: hide,
                onconnect: (element: HTMLElement) => {
                    digits = element.querySelector<HTMLElement>('.relative-time-digits') ?? undefined;
                    rest = element.querySelector<HTMLElement>('.relative-time-rests') ?? undefined;
                    stopRender = effect(() => {
                        let value = text();

                        if (value !== null) {
                            render(value);
                        }
                    });
                },
                ondisconnect: () => {
                    stopRender?.();
                },
                // Background tabs throttle timers; catch up the moment the page is seen.
                ondocumentvisibilitychange: () => {
                    if (document.visibilityState !== 'visible') {
                        return;
                    }

                    clock.tick++;
                    schedule();
                },
                onfocus: () => open(false),
                onkeydown: (e: KeyboardEvent) => {
                    if (e.key === 'Escape') {
                        hide();
                    }
                },
                onpointerenter: (e: PointerEvent) => {
                    if (e.pointerType !== 'touch') {
                        open(true);
                    }
                },
                onpointerleave: hide,
                tabindex: () => state.date === null ? '' : '0'
            }}
        >
            <span class='relative-time-sr'>${() => text() ?? ''}</span>
            <span aria-hidden='true' class='relative-time-roll ${() => state.date === null && '--placeholder'}'>
                <span class='relative-time-digits'></span>
                <span class='relative-time-rests'></span>
            </span>
            <span
                class='tooltip-message tooltip-message--n relative-time-tooltip'
                id='${id}'
                role='tooltip'
                ${this?.attributes?.[RELATIVE_TIME_TOOLTIP]}
                ${attributes[RELATIVE_TIME_TOOLTIP]}
                ${{
                    onrender: (element: HTMLElement) => {
                        tooltip = element;
                    }
                }}
            >
                ${() => {
                    let time = timeOf(state.date);

                    return time === null ? '' : TOOLTIP.format(time);
                }}
            </span>
        </time>
    `;
}


export default Object.assign(template, { tooltip: RELATIVE_TIME_TOOLTIP } as const);
export type { State as RelativeTimeState, Value as RelativeTimeValue };
