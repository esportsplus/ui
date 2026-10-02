import { onCleanup, reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import tooltip from '~/components/tooltip';
import scrollbar from '~/css-utilities/scrollbar';
import './scss/index.scss';


type A = Attributes & {
    [HEATMAP_CELL]?: Attributes;
    data: Day[];
    // Each cell's accessible name; the tooltip only shows on hover and focus.
    describe?: (day: Day) => string;
    label?: string;
    onfocusin?: never;
    onfocusout?: never;
    onpointerleave?: never;
    onpointerover?: never;
    state?: State;
    thresholds?: number[];
    tooltip: (day: Day, index: number) => Renderable<unknown>;
};

type Cell = HTMLElement & { [INDEX]: number };

// `level` (0 to 4) overrides the thresholds, for data that arrives already bucketed, like GitHub's own graph.
type Day = {
    date: string;
    level?: number;
    value: number;
};

type State = {
    index: number;
};


const DAYS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

const HEATMAP_CELL = Symbol.for('@esportsplus/ui/heatmap.cell');

const INDEX = Symbol();

const LEVELS = [0, 1, 2, 3, 4];

const LONG_DATE = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', timeZone: 'UTC', weekday: 'long', year: 'numeric' });

const MONTH = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });

const NUMBER = new Intl.NumberFormat('en-US');

const THRESHOLDS = [1, 4, 7, 10];


function legend(attributes: Attributes = {}) {
    return html`
        <div aria-hidden='true' class='heatmap-legend' ${attributes}>
            <span>Less</span>
            ${LEVELS.map((level) => html`<span class='heatmap-swatch heatmap-swatch--level-${level}'></span>`)}
            <span>More</span>
        </div>
    `;
}

function levelOf(value: number, thresholds: number[]) {
    let level = 0;

    for (let i = 0, n = thresholds.length; i < n; i++) {
        if (value >= thresholds[i]) {
            level++;
        }
    }

    return level;
}

function summary(day: Day) {
    return `${NUMBER.format(day.value)} on ${LONG_DATE.format(utc(day.date))}`;
}

function template(this: { attributes?: Partial<A> } | void, { data, describe = summary, label, state = reactive({ index: data.length - 1 }), thresholds = THRESHOLDS, tooltip: content, ...attributes }: A) {
    let bound = this?.attributes,
        cells: Cell[] = [],
        months: { column: number; name: string }[] = [],
        observer: IntersectionObserver | undefined,
        tip = tooltip.shared(),
        view = reactive({ shown: false }),
        weeks = Math.ceil(data.length / 7);

    // A month is labelled at the column holding its 1st; labels closer than 3 columns would collide.
    for (let i = 0, n = data.length; i < n; i++) {
        let date = utc(data[i].date);

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
        return (target as HTMLElement | null)?.closest<Cell>('.heatmap-cell') ?? null;
    }

    function move(next: number) {
        let index = Math.min(Math.max(next, 0), data.length - 1);

        state.index = index;
        cells[index]?.focus();
    }

    onCleanup(() => {
        observer?.disconnect();
    });

    // The tooltip stays out of the accessibility tree: each cell's label already says what it shows.
    return html`
        <div
            class='heatmap'
            ${bound}
            ${attributes}
            ${tip.delegate({
                content: (cell) => {
                    let index = (cell as Cell)[INDEX];

                    return content(data[index], index);
                },
                selector: '.heatmap-cell:not(.heatmap-cell--empty)'
            })}
        >
            <div aria-hidden='true' class='heatmap-days'>
                ${DAYS.map((day) => html`<span>${day}</span>`)}
            </div>

            <div
                class='heatmap-scroll --scrollbar --scrollbar-horizontal'
                ${scrollbar.drag('horizontal')}
                ${{
                    // On a narrow screen, open on the most recent weeks.
                    onconnect: (element: HTMLElement) => {
                        element.scrollTo({ behavior: 'instant', left: element.scrollWidth });
                    },
                    // A drag scroll sweeps cells under a still pointer; the tooltip gets out of the way instead of
                    // chasing them.
                    onscroll: () => {
                        tip.close();
                    }
                }}
            >
                <div class='heatmap-body'>
                    <div aria-hidden='true' class='heatmap-months'>
                        ${months.map((month) => html`<span style='--column: ${month.column}'>${month.name}</span>`)}
                    </div>

                    <div
                        aria-readonly='true'
                        class='heatmap-grid'
                        role='grid'
                        ${{
                            'aria-label': label ?? `Activity over the last ${weeks} weeks`,
                            class: () => view.shown && 'heatmap-grid--shown',
                            onconnect: (element: HTMLElement) => {
                                observer = new IntersectionObserver((entries) => {
                                    if (!entries.some((entry) => entry.isIntersecting)) {
                                        return;
                                    }

                                    observer?.disconnect();
                                    view.shown = true;
                                }, { threshold: 0.4 });
                                observer.observe(element);
                            },
                            onfocusin: (e: FocusEvent) => {
                                let element = cellFrom(e.target);

                                if (element) {
                                    state.index = element[INDEX];
                                }
                            },
                            onkeydown: (e: KeyboardEvent) => {
                                let element = cellFrom(e.target);

                                if (!element) {
                                    return;
                                }

                                let i = element[INDEX],
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
                            }
                        }}
                    >
                        ${DAYS.map((_, day) => html`
                            <div class='heatmap-row' role='row'>
                                ${Array.from({ length: weeks }, (_, week) => {
                                    let i = week * 7 + day;

                                    if (i >= data.length) {
                                        return html`<div class='heatmap-cell heatmap-cell--empty' role='presentation'></div>`;
                                    }

                                    return html`
                                        <div
                                            aria-label='${describe(data[i])}'
                                            class='heatmap-cell heatmap-cell--level-${data[i].level ?? levelOf(data[i].value, thresholds)}'
                                            role='gridcell'
                                            style='--column: ${week}'
                                            tabindex='${() => state.index === i ? '0' : '-1'}'
                                            ${bound?.[HEATMAP_CELL]}
                                            ${attributes[HEATMAP_CELL]}
                                            ${{
                                                onconnect: (element: Cell) => {
                                                    element[INDEX] = i;
                                                    cells[i] = element;
                                                }
                                            }}
                                        ></div>
                                    `;
                                })}
                            </div>
                        `)}
                    </div>
                </div>
            </div>

            ${tip.render({ 'aria-hidden': 'true' })}
        </div>
    `;
}

function utc(date: string) {
    return new Date(`${date}T00:00:00Z`);
}


export default component(template, { cell: HEATMAP_CELL, legend });
export type { Day as HeatmapDay, State as HeatmapState };
