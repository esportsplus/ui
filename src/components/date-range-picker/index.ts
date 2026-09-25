import { html, type Attributes } from '@esportsplus/template';
import { computed, dispose, reactive, read, untrack } from '@esportsplus/reactivity';
import './scss/index.scss';


type A = Attributes & {
    [DATE_RANGE_PICKER_DAY]?: Attributes;
    onapply?: (range: Range) => void;
    state?: State;
    today?: string;
    value?: Range | null;
};

type Range = { end: string, start: string };

type State = { end: string | null, start: string | null };


// Six weeks covers every month, so the grids never change height.
const CELLS = 42;

const DATE_RANGE_PICKER_DAY = Symbol.for('@esportsplus/ui/date-range-picker.day');

const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

// Far enough to read as travel, short enough that the fade does most of the work and the months never look like they are leaving the card.
const SLIDE = 56;

// Below this the card can't fit two 7 x 36px grids side by side.
const TWO_MONTHS_AT = 540;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];


function addDays(iso: string, days: number) {
    let d = fromIso(iso);

    return toIso(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
}

// Keeps the day of month, clamped so Jan 31 plus one month is Feb 28.
function addMonths(iso: string, months: number) {
    let d = fromIso(iso),
        last = new Date(d.getFullYear(), d.getMonth() + months + 1, 0);

    return toIso(new Date(last.getFullYear(), last.getMonth(), Math.min(d.getDate(), last.getDate())));
}

function dayLabel(iso: string) {
    return fromIso(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'long', weekday: 'long', year: 'numeric' });
}

function daysBetween(a: string, b: string) {
    return Math.round((fromIso(b).getTime() - fromIso(a).getTime()) / 86_400_000);
}

function describe(range: Range) {
    let days = daysBetween(range.start, range.end) + 1,
        sameYear = range.start.slice(0, 4) === range.end.slice(0, 4),
        span = range.start === range.end
            ? short(range.start, true)
            : `${short(range.start, !sameYear)} to ${short(range.end, true)}`;

    return `${span} · ${days} day${days === 1 ? '' : 's'}`;
}

function fromIso(iso: string) {
    let [y, m, d] = iso.split('-').map(Number);

    return new Date(y, m - 1, d);
}

function monthEnd(month: number) {
    return toIso(new Date(Math.floor(month / 12), (month % 12) + 1, 0));
}

// Months as one running number, so comparing two tells the direction.
function monthIndex(iso: string) {
    let [y, m] = iso.split('-').map(Number);

    return y * 12 + m - 1;
}

function monthStart(month: number) {
    return toIso(new Date(Math.floor(month / 12), month % 12, 1));
}

function monthTitle(month: number) {
    return new Date(Math.floor(month / 12), month % 12, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function pad(n: number) {
    return String(n).padStart(2, '0');
}

function presets(today: string): { label: string, range: Range }[] {
    let month = monthIndex(today);

    return [
        { label: 'Last 7 days', range: { end: today, start: addDays(today, -6) } },
        { label: 'Last 30 days', range: { end: today, start: addDays(today, -29) } },
        { label: 'This month', range: { end: monthEnd(month), start: monthStart(month) } },
        { label: 'Last month', range: { end: monthEnd(month - 1), start: monthStart(month - 1) } }
    ];
}

function short(iso: string, withYear: boolean) {
    return fromIso(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: withYear ? 'numeric' : undefined });
}

function template(
    this: { attributes?: Partial<A> } | void,
    { onapply, state, today = toIso(new Date()), value, ...attributes }: A = {}
) {
    let applied: ReturnType<typeof setTimeout> | undefined,
        area: HTMLElement | undefined,
        defaults = this?.attributes,
        entering = 0,
        id = `date-range-picker-${Math.random().toString(36).slice(2, 8)}`,
        observer: ResizeObserver | undefined,
        pending: string | null = null,
        s = state || reactive({ end: value?.end ?? null, start: value?.start ?? null } as State),
        ui = reactive({
            applied: false,
            focused: null as string | null,
            hover: null as string | null,
            single: false,
            view: null as number | null
        }),
        viewCount = computed<number>(() => ui.single ? 1 : 2),
        viewMonth = computed<number>(() => {
            if (ui.view !== null) {
                return ui.view;
            }

            // On two months, a range that ends in the anchor's month shows it on the right, so the month before it stays in view.
            let month = monthIndex(s.start ?? today);

            return s.end && !ui.single && monthIndex(s.end) === month ? month - 1 : month;
        }),
        rangeHi = computed<string | null>(() => {
            if (s.start !== null && s.end === null) {
                return ui.hover ? (ui.hover < s.start ? s.start : ui.hover) : s.start;
            }

            return s.end;
        }),
        rangeLo = computed<string | null>(() => {
            if (s.start !== null && s.end === null && ui.hover) {
                return ui.hover < s.start ? ui.hover : s.start;
            }

            return s.start;
        }),
        // The tabbable day: the focused one when it is in view, else the first day on screen, so Tab always lands somewhere visible.
        tabbable = computed<string>(() => {
            let focused = ui.focused ?? s.start ?? today,
                month = monthIndex(focused),
                shown = read(viewMonth);

            return month >= shown && month < shown + read(viewCount) ? focused : monthStart(shown);
        });

    // The band rounds off wherever a week or the month breaks it, so each row reads as one continuous pill.
    function band(iso: string, col: number, last: string) {
        let hi = read(rangeHi),
            lo = read(rangeLo);

        if (!inRange(iso)) {
            return '';
        }

        let rowEnd = col === 6 || iso === last,
            rowStart = col === 0 || iso.endsWith('-01');

        // An endpoint on a row break has nothing beside it to join.
        if ((iso === lo && rowEnd) || (iso === hi && rowStart)) {
            return '';
        }

        return `--band${iso === lo ? ' --band-lo' : ''}${iso === hi ? ' --band-hi' : ''}${rowStart && iso !== lo ? ' --band-start' : ''}${rowEnd && iso !== hi ? ' --band-end' : ''}`;
    }

    function cell(iso: string | null, col: number, last: string) {
        if (!iso) {
            return html`<td class='date-range-picker-cell'></td>`;
        }

        return html`
            <td
                class='date-range-picker-cell'
                role='gridcell'
                ${{
                    'aria-selected': () => String(inRange(iso) || iso === s.start || iso === s.end),
                    class: () => band(iso, col, last)
                }}
            >
                <button
                    aria-label='${dayLabel(iso)}'
                    class='date-range-picker-day'
                    data-date='${iso}'
                    type='button'
                    ${iso === today ? { 'aria-current': 'date' } : {}}
                    ${defaults?.[DATE_RANGE_PICKER_DAY]}
                    ${attributes[DATE_RANGE_PICKER_DAY]}
                    ${{
                        class: () => dayClass(iso),
                        tabindex: () => {
                            let day = read(tabbable);

                            return day === iso ? '0' : '-1';
                        }
                    }}
                >
                    ${Number(iso.slice(8))}
                    ${iso === today && html`<span aria-hidden='true' class='date-range-picker-today'></span>`}
                </button>
            </td>
        `;
    }

    function dayClass(iso: string) {
        if (iso === s.start || iso === s.end) {
            return '--active';
        }

        let hi = read(rangeHi),
            lo = read(rangeLo);

        return (iso === lo || iso === hi) && picking() && ui.hover ? '--edge' : '';
    }

    // Focus follows to the day's button, which may be in months that have only just mounted.
    function focus(iso: string) {
        pending = iso;
        requestAnimationFrame(settle);
    }

    function goTo(iso: string) {
        ui.focused = iso;

        if (picking()) {
            ui.hover = iso;
        }

        reveal(iso);
        focus(iso);
    }

    function inRange(iso: string) {
        let hi = read(rangeHi),
            lo = read(rangeLo);

        return lo !== null && hi !== null && lo !== hi && iso >= lo && iso <= hi;
    }

    function keydown(e: KeyboardEvent) {
        let target = (e.target as HTMLElement).closest<HTMLElement>('[data-date]');

        if (!target) {
            return;
        }

        let focused = ui.focused ?? s.start ?? today,
            weekday = fromIso(focused).getDay(),
            years = e.shiftKey ? 12 : 1,
            moves: Record<string, () => string> = {
                ArrowDown: () => addDays(focused, 7),
                ArrowLeft: () => addDays(focused, -1),
                ArrowRight: () => addDays(focused, 1),
                ArrowUp: () => addDays(focused, -7),
                End: () => addDays(focused, 6 - weekday),
                Home: () => addDays(focused, -weekday),
                PageDown: () => addMonths(focused, years),
                PageUp: () => addMonths(focused, -years)
            },
            move = moves[e.key];

        if (move) {
            e.preventDefault();
            goTo(move());
        }
        else if (e.key === 'Escape' && picking()) {
            // Backs out of a half-picked range.
            e.preventDefault();
            s.start = null;
            ui.hover = null;
        }
    }

    function month(index: number) {
        let first = fromIso(monthStart(index)),
            last = monthEnd(index),
            lead = first.getDay(),
            title = `${id}-${index}`,
            days: (string | null)[] = [];

        for (let i = 0; i < CELLS; i++) {
            let iso = toIso(new Date(first.getFullYear(), first.getMonth(), i - lead + 1));

            days.push(monthIndex(iso) === index ? iso : null);
        }

        return html`
            <div class='date-range-picker-month'>
                <p class='date-range-picker-month-title' id='${title}'>${monthTitle(index)}</p>
                <table aria-labelledby='${title}' class='date-range-picker-grid' role='grid'>
                    <thead>
                        <tr>
                            ${WEEKDAYS.map((day) => html`<th abbr='${day}' scope='col'>${day.slice(0, 2)}</th>`)}
                        </tr>
                    </thead>
                    <tbody>
                        ${[0, 1, 2, 3, 4, 5].map((week) => html`
                            <tr>
                                ${days.slice(week * 7, week * 7 + 7).map((iso, col) => cell(iso, col, last))}
                            </tr>
                        `)}
                    </tbody>
                </table>
            </div>
        `;
    }

    function months(view: number, count: number) {
        return html`
            <div
                class='date-range-picker-months'
                ${{
                    onconnect: (element: HTMLElement) => {
                        let direction = Number(element.dataset.entering);

                        settle();

                        if (!direction) {
                            return;
                        }

                        delete element.dataset.entering;
                        element.style.removeProperty('opacity');
                        element.animate(
                            matchMedia(REDUCED_MOTION).matches
                                ? { opacity: [0, 1] }
                                : { filter: ['blur(4px)', 'blur(0px)'], opacity: [0, 1], transform: [`translateX(${direction * SLIDE}px)`, 'none'] },
                            { duration: 250, easing: EASE_OUT }
                        );
                    },
                    // Hidden until connected, so the incoming months never paint a frame at rest before sliding in.
                    onrender: (element: HTMLElement) => {
                        if (!entering) {
                            return;
                        }

                        element.dataset.entering = String(entering);
                        element.style.opacity = '0';
                        entering = 0;
                    }
                }}
            >
                ${Array.from({ length: count }, (_, i) => month(view + i))}
            </div>
        `;
    }

    function picking() {
        return s.start !== null && s.end === null;
    }

    // Keeps an iso date inside the visible months, shifting by as little as possible.
    function reveal(iso: string) {
        let m = monthIndex(iso),
            shown = read(viewMonth);

        if (m < shown) {
            showView(m);
        }
        else if (m > shown + read(viewCount) - 1) {
            showView(m - read(viewCount) + 1);
        }
        else {
            showView(shown);
        }
    }

    function select(iso: string) {
        let start = s.start;

        ui.applied = false;
        ui.focused = iso;
        reveal(iso);

        if (!picking() || start === null) {
            s.start = iso;
            s.end = null;
            ui.hover = iso;
        }
        else if (iso < start) {
            s.end = start;
            s.start = iso;
            ui.hover = null;
        }
        else {
            s.end = iso;
            ui.hover = null;
        }
    }

    function setRange(range: Range | null) {
        let shown = read(viewMonth);

        ui.applied = false;
        ui.hover = null;
        s.end = range?.end ?? null;
        s.start = range?.start ?? null;

        if (!range) {
            showView(shown);
            return;
        }

        ui.focused = range.start;

        // Shows the end month, with the start's month beside it when it fits.
        let end = monthIndex(range.end),
            visible = monthIndex(range.start) >= shown && end <= shown + read(viewCount) - 1;

        showView(visible ? shown : Math.max(monthIndex(range.start), end - read(viewCount) + 1));
    }

    function settle() {
        let button = pending && area?.querySelector<HTMLElement>(`.date-range-picker-months:not([data-exiting]):not([data-stale]) [data-date='${pending}']`);

        if (!button) {
            return;
        }

        pending = null;
        button.focus({ preventScroll: true });
    }

    // Always stores the month, even when unchanged, so the default view stops tracking the selection once the user has touched anything.
    function showView(next: number) {
        let shown = read(viewMonth);

        if (next !== shown && area) {
            let current = area.querySelector<HTMLElement>(':scope > .date-range-picker-months:not([data-exiting]):not([data-stale])');

            entering = next > shown ? 1 : -1;

            if (current) {
                current.dataset.stale = '';

                let direction = entering,
                    ghost = current.cloneNode(true) as HTMLElement;

                ghost.dataset.exiting = '';
                ghost.inert = true;
                ghost.style.left = `${current.offsetLeft}px`;
                ghost.style.top = `${current.offsetTop}px`;
                ghost.style.width = `${current.offsetWidth}px`;
                area.append(ghost);
                ghost.animate(
                    matchMedia(REDUCED_MOTION).matches
                        ? { opacity: [1, 0] }
                        : { filter: ['blur(0px)', 'blur(2px)'], opacity: [1, 0], transform: ['none', `translateX(${direction * -SLIDE * 0.6}px)`] },
                    { duration: 180, easing: EASE_OUT, fill: 'forwards' }
                ).onfinish = () => ghost.remove();
            }
        }

        ui.view = next;
    }

    function step(months: number) {
        let focused = ui.focused ?? s.start ?? today;

        showView(read(viewMonth) + months);
        ui.focused = addMonths(focused, months);
    }

    function summary() {
        if (s.start !== null && s.end !== null) {
            return describe({ end: s.end, start: s.start });
        }

        return s.start !== null ? `From ${short(s.start, true)}` : 'No dates selected';
    }

    return html`
        <div
            class='date-range-picker'
            ${defaults}
            ${attributes}
            ${{
                onconnect: (element: HTMLElement) => {
                    observer = new ResizeObserver(([entry]) => {
                        ui.single = entry.contentRect.width < TWO_MONTHS_AT;
                    });
                    observer.observe(element);
                },
                ondisconnect: () => {
                    clearTimeout(applied);
                    observer?.disconnect();

                    dispose(rangeHi);
                    dispose(rangeLo);
                    dispose(tabbable);
                    dispose(viewCount);
                    dispose(viewMonth);
                }
            }}
        >
            <div aria-label='Presets' class='date-range-picker-presets' role='group'>
                ${presets(today).map((chip) => html`
                    <button
                        class='button date-range-picker-preset'
                        type='button'
                        ${{
                            'aria-pressed': () => String(s.start === chip.range.start && s.end === chip.range.end),
                            onclick: () => setRange(chip.range)
                        }}
                    >
                        ${chip.label}
                    </button>
                `)}
            </div>

            <div
                class='date-range-picker-area'
                ${{
                    onclick: (e: MouseEvent) => {
                        let day = (e.target as HTMLElement).closest<HTMLElement>('[data-date]');

                        if (day?.dataset.date) {
                            select(day.dataset.date);
                        }
                    },
                    onkeydown: keydown,
                    onmouseleave: () => {
                        if (picking()) {
                            ui.hover = null;
                        }
                    },
                    onpointerover: (e: PointerEvent) => {
                        if (e.pointerType === 'touch' || !picking()) {
                            return;
                        }

                        let day = (e.target as HTMLElement).closest<HTMLElement>('[data-date]');

                        if (day?.dataset.date && !day.closest('[data-exiting]')) {
                            ui.hover = day.dataset.date;
                        }
                    },
                    onrender: (element: HTMLElement) => {
                        area = element;
                    }
                }}
            >
                <div class='date-range-picker-nav'>
                    <button aria-label='Previous month' class='button date-range-picker-step' type='button' onclick='${() => step(-1)}'>
                        <svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 16 16'><path d='M10 3.5 5.5 8l4.5 4.5' /></svg>
                    </button>
                    <button aria-label='Next month' class='button date-range-picker-step' type='button' onclick='${() => step(1)}'>
                        <svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 16 16'><path d='m6 3.5 4.5 4.5L6 12.5' /></svg>
                    </button>
                </div>
                <span aria-live='polite' class='date-range-picker-live'>
                    ${() => Array.from({ length: read(viewCount) }, (_, i) => monthTitle(read(viewMonth) + i)).join(' and ')}
                </span>
                ${() => {
                    let count = read(viewCount),
                        view = read(viewMonth);

                    return untrack(() => months(view, count));
                }}
            </div>

            <div class='date-range-picker-footer'>
                <div class='date-range-picker-status'>
                    <p class='date-range-picker-summary' ${{ class: () => s.start !== null && '--active' }}>${summary}</p>
                    <p class='date-range-picker-hint'>
                        ${() => s.start !== null && s.end !== null ? '' : picking() ? 'Pick an end date' : 'Pick a start date'}
                    </p>
                </div>
                <button
                    class='button date-range-picker-clear'
                    type='button'
                    ${{
                        class: () => s.start === null && '--disabled',
                        inert: () => s.start === null,
                        onclick: () => setRange(null)
                    }}
                >
                    Clear
                </button>
                <button
                    class='button date-range-picker-apply'
                    type='button'
                    ${{
                        class: () => ui.applied && '--applied',
                        disabled: () => s.start === null || s.end === null,
                        onclick: () => {
                            if (s.start === null || s.end === null) {
                                return;
                            }

                            onapply?.({ end: s.end, start: s.start });
                            ui.applied = true;
                            clearTimeout(applied);

                            // Long enough to register, then back to a plain Apply.
                            applied = setTimeout(() => {
                                ui.applied = false;
                            }, 1600);
                        }
                    }}
                >
                    <span class='date-range-picker-apply-labels'>
                        <span class='date-range-picker-apply-label date-range-picker-apply-label--done'>
                            <svg aria-hidden='true' class='date-range-picker-apply-icon' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 16 16'><path d='m3.5 8.5 3 3 6-7' /></svg>
                            <span class='date-range-picker-apply-text'>Applied</span>
                        </span>
                        <span class='date-range-picker-apply-label date-range-picker-apply-label--idle'>Apply</span>
                    </span>
                </button>
            </div>
            <span aria-live='polite' class='date-range-picker-live'>${() => ui.applied ? `Applied ${summary()}` : ''}</span>
        </div>
    `;
}

function toIso(d: Date) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}


export default Object.assign(template, { day: DATE_RANGE_PICKER_DAY, describe } as const);
export type { Range, State };
