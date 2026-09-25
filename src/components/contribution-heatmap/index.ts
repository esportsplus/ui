import { html, type Attributes } from '@esportsplus/template';
import { effect, onCleanup, reactive } from '@esportsplus/reactivity';
import '~/components/tooltip/scss/index.scss';
import './scss/index.scss';


type A = Attributes & {
    [CONTRIBUTION_HEATMAP_CELL]?: Attributes;
    data: Day[];
    label?: string;
    onscroll?: never;
    state?: State;
    thresholds?: number[];
};

type Cell = {
    date: Date;
    label: string;
    level: number;
    tip: string;
};

// `level` (0 to 4) overrides the thresholds, for data that arrives already bucketed, like GitHub's own graph.
type Day = {
    count: number;
    date: string;
    level?: number;
};

type State = {
    index: number;
};


const CELL = 10;

const CONTRIBUTION_HEATMAP_CELL = Symbol.for('@esportsplus/ui/contribution-heatmap.cell');

const DAYS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

const LEVELS = [0, 1, 2, 3, 4];

const LONG_DATE = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', timeZone: 'UTC', weekday: 'long', year: 'numeric' });

const MONTH = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });

const NUMBER = new Intl.NumberFormat('en-US');

const PITCH = 13;

const SHORT_DATE = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' });

const THRESHOLDS = [1, 4, 7, 10];


function levelOf(count: number, thresholds: number[]) {
    let level = 0;

    for (let i = 0, n = thresholds.length; i < n; i++) {
        if (count >= thresholds[i]) {
            level++;
        }
    }

    return level;
}

function phrase(count: number) {
    if (count === 0) {
        return 'No contributions';
    }

    return `${NUMBER.format(count)} contribution${count === 1 ? '' : 's'}`;
}


function legend(attributes: Attributes = {}) {
    return html`
        <div aria-hidden='true' class='contribution-heatmap-legend' ${attributes}>
            <span>Less</span>
            ${LEVELS.map((level) => html`<span class='contribution-heatmap-swatch' data-level='${level}'></span>`)}
            <span>More</span>
        </div>
    `;
}

function template(this: { attributes?: Partial<A> } | void, { data, label, state = reactive({ index: data.length - 1 }), thresholds = THRESHOLDS, ...attributes }: A) {
    let cells: Cell[] = [],
        focusable: HTMLElement | undefined,
        grid: HTMLElement | undefined,
        months: { column: number; name: string }[] = [],
        observer: IntersectionObserver | undefined,
        tip: HTMLElement | undefined,
        weeks = Math.ceil(data.length / 7),
        wrap: HTMLElement | undefined;

    for (let i = 0, n = data.length; i < n; i++) {
        let day = data[i],
            date = new Date(`${day.date}T00:00:00Z`);

        cells.push({
            date,
            label: `${phrase(day.count)} on ${LONG_DATE.format(date)}`,
            level: day.level ?? levelOf(day.count, thresholds),
            tip: `${phrase(day.count)} on ${SHORT_DATE.format(date)}`
        });

        // A month is labelled at the column holding its 1st; labels closer than 3 columns would collide.
        if (date.getUTCDate() !== 1) {
            continue;
        }

        let column = Math.floor(i / 7);

        if (months.length && column - months[months.length - 1].column < 3) {
            months.pop();
        }

        months.push({ column, name: MONTH.format(date) });
    }

    function cellFrom(target: EventTarget | null) {
        return (target as HTMLElement | null)?.closest<HTMLElement>('[data-i]') ?? null;
    }

    function hide() {
        tip?.classList.remove('--active');
    }

    function move(next: number) {
        let index = Math.min(Math.max(next, 0), data.length - 1);

        state.index = index;
        grid?.querySelector<HTMLElement>(`[data-i="${index}"]`)?.focus();
    }

    // Roving tabindex: the grid is one tab stop and only the two cells whose tabindex changed are touched.
    function rove(index: number) {
        let element = grid?.querySelector<HTMLElement>(`[data-i="${index}"]`);

        if (!element || element === focusable) {
            return;
        }

        if (focusable) {
            focusable.tabIndex = -1;
        }

        element.tabIndex = 0;
        focusable = element;
    }

    // Moved and rewritten directly, so sweeping across hundreds of cells never re-renders them. It jumps with
    // no transition: a tooltip that glides between cells lags behind the pointer.
    function show(element: HTMLElement) {
        let cell = cells[Number(element.dataset.i)],
            message = tip?.firstElementChild as HTMLElement | null;

        if (!cell || !message || !tip || !wrap) {
            return;
        }

        message.textContent = cell.tip;

        let box = wrap.getBoundingClientRect(),
            rect = element.getBoundingClientRect(),
            // Undoes any scale an ancestor applies.
            scale = wrap.offsetWidth / box.width || 1,
            width = message.offsetWidth,
            x = Math.min(Math.max((rect.left - box.left + rect.width / 2) * scale, width / 2), wrap.offsetWidth - width / 2),
            y = (rect.top - box.top) * scale;

        tip.style.transform = `translate(${x}px, ${y}px)`;
        tip.classList.add('--active');
    }

    let stop = effect(() => {
        rove(state.index);
    });

    onCleanup(() => {
        observer?.disconnect();
        stop();
    });

    return html`
        <div
            class='contribution-heatmap'
            ${this?.attributes}
            ${attributes}
            ${{
                onrender: (element: HTMLElement) => {
                    wrap = element;
                }
            }}
        >
            <div aria-hidden='true' class='contribution-heatmap-days'>
                ${DAYS.map((day) => html`<span>${day}</span>`)}
            </div>

            <div
                class='contribution-heatmap-scroll'
                ${{
                    onconnect: (element: HTMLElement) => {
                        // On a narrow screen, open on the most recent weeks.
                        element.scrollLeft = element.scrollWidth;
                    },
                    onscroll: hide
                }}
            >
                <div class='contribution-heatmap-body' style='width: ${weeks * PITCH - (PITCH - CELL)}px'>
                    <div aria-hidden='true' class='contribution-heatmap-months'>
                        ${months.map((month) => html`<span style='left: ${month.column * PITCH}px'>${month.name}</span>`)}
                    </div>

                    <div
                        aria-readonly='true'
                        class='contribution-heatmap-grid'
                        role='grid'
                        ${{
                            'aria-label': label ?? `Contributions over the last ${weeks} weeks`,
                            onconnect: (element: HTMLElement) => {
                                grid = element;
                                rove(state.index);
                                observer = new IntersectionObserver((entries) => {
                                    if (!entries.some((entry) => entry.isIntersecting)) {
                                        return;
                                    }

                                    observer?.disconnect();
                                    element.classList.add('--shown');
                                }, { threshold: 0.4 });
                                observer.observe(element);
                            },
                            onfocusin: (e: FocusEvent) => {
                                let element = cellFrom(e.target);

                                if (!element) {
                                    return;
                                }

                                state.index = Number(element.dataset.i);
                                show(element);
                            },
                            onfocusout: (e: FocusEvent) => {
                                if (!grid?.contains(e.relatedTarget as Node | null)) {
                                    hide();
                                }
                            },
                            onkeydown: (e: KeyboardEvent) => {
                                let element = cellFrom(e.target);

                                if (!element) {
                                    return;
                                }

                                if (e.key === 'Escape') {
                                    hide();
                                    return;
                                }

                                let i = Number(element.dataset.i),
                                    day = i % 7,
                                    next = ({
                                        ArrowDown: day < 6 ? i + 1 : i,
                                        ArrowLeft: i - 7,
                                        ArrowRight: i + 7,
                                        ArrowUp: day > 0 ? i - 1 : i,
                                        End: (weeks - 1) * 7 + day,
                                        Home: day
                                    } as Record<string, number>)[e.key];

                                if (next === undefined) {
                                    return;
                                }

                                e.preventDefault();
                                move(next);
                            },
                            onpointerdown: (e: PointerEvent) => {
                                let element = cellFrom(e.target);

                                if (e.pointerType === 'touch' && element) {
                                    show(element);
                                }
                            },
                            onpointerleave: (e: PointerEvent) => {
                                if (e.pointerType !== 'touch') {
                                    hide();
                                }
                            },
                            onpointerover: (e: PointerEvent) => {
                                let element = cellFrom(e.target);

                                if (e.pointerType !== 'touch' && element) {
                                    show(element);
                                }
                            }
                        }}
                    >
                        ${DAYS.map((_, day) => html`
                            <div class='contribution-heatmap-row' role='row'>
                                ${Array.from({ length: weeks }, (_, week) => {
                                    let i = week * 7 + day,
                                        cell = cells[i];

                                    if (!cell) {
                                        return html`<div class='contribution-heatmap-cell contribution-heatmap-cell--empty' role='presentation'></div>`;
                                    }

                                    return html`
                                        <div
                                            aria-label='${cell.label}'
                                            class='contribution-heatmap-cell'
                                            data-i='${i}'
                                            data-level='${cell.level}'
                                            role='gridcell'
                                            style='--column: ${week}'
                                            tabindex='-1'
                                            ${this?.attributes?.[CONTRIBUTION_HEATMAP_CELL]}
                                            ${attributes[CONTRIBUTION_HEATMAP_CELL]}
                                        ></div>
                                    `;
                                })}
                            </div>
                        `)}
                    </div>
                </div>
            </div>

            <div
                aria-hidden='true'
                class='contribution-heatmap-tip tooltip'
                ${{
                    onrender: (element: HTMLElement) => {
                        tip = element;
                    }
                }}
            >
                <span class='tooltip-message tooltip-message--n'></span>
            </div>
        </div>
    `;
}


export default Object.assign(template, { cell: CONTRIBUTION_HEATMAP_CELL, legend } as const);
export type { Day as ContributionHeatmapDay, State as ContributionHeatmapState };
