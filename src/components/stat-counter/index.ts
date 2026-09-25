import { html, type Attributes } from '@esportsplus/template';
import { effect, onCleanup, reactive } from '@esportsplus/reactivity';
import counter from '~/components/counter';
import './scss/index.scss';


type A = Attributes & {
    [STAT_COUNTER_CARD]?: Attributes;
    [STAT_COUNTER_SLIDER]?: Attributes;
    state?: State;
    stats: Stat[];
};

type Stat = {
    decimals?: number;
    // Which direction is good news: latency going up is not.
    goodWhen?: 'down' | 'up';
    label: string;
    prefix?: string;
    series: number[];
    suffix?: string;
    // Change against the previous period as a fraction (0.12 is +12%); defaults to the last two points.
    trend?: number;
    // Defaults to the last point of the series.
    value?: number;
};

type State = {
    stats: Stat[];
};


const HEIGHT = 32;

const STAT_COUNTER_CARD = Symbol.for('@esportsplus/ui/stat-counter.card');

const STAT_COUNTER_SLIDER = Symbol.for('@esportsplus/ui/stat-counter.slider');

const TREND = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
    style: 'percent'
});

const WIDTH = 120;


function ago(days: number) {
    return days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`;
}

function format(stat: Stat, value: number) {
    let decimals = stat.decimals ?? 0;

    return `${stat.prefix ?? ''}${value.toLocaleString('en-US', { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}${stat.suffix ?? ''}`;
}

function path(series: number[]) {
    return points(series).map((point, i) => `${i ? 'L' : 'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
}

function points(series: number[]) {
    let max = Math.max(...series),
        min = Math.min(...series),
        span = max - min || 1;

    // 2px inset so the line is never clipped at the extremes.
    return series.map((value, i) => ({
        x: (i / (series.length - 1)) * WIDTH,
        y: 2 + (1 - (value - min) / span) * (HEIGHT - 4)
    }));
}

function trendOf(stat: Stat) {
    let series = stat.series;

    return stat.trend ?? valueOf(stat) / series[series.length - 2] - 1;
}

function valueOf(stat: Stat) {
    return stat.value ?? stat.series[stat.series.length - 1];
}


function template(this: { attributes?: Partial<A> } | void, { state, stats, ...attributes }: A) {
    let inherited = this?.attributes,
        observer: IntersectionObserver | undefined,
        s = state ?? reactive({ stats });

    function card(index: number) {
        let initial = s.stats[index],
            number = reactive({ value: valueOf(initial) }),
            previous = '',
            text: HTMLElement | undefined,
            view = reactive({ scrub: null as number | null });

        function current() {
            return s.stats[index];
        }

        function last() {
            return current().series.length - 1;
        }

        function pick(e: PointerEvent) {
            let box = (e.currentTarget as HTMLElement).getBoundingClientRect(),
                t = Math.min(Math.max((e.clientX - box.left) / box.width, 0), 1);

            view.scrub = Math.round(t * last());
        }

        function point() {
            let scrub = view.scrub;

            return scrub === null ? null : points(current().series)[scrub];
        }

        function shown() {
            let scrub = view.scrub;

            return scrub === null ? valueOf(current()) : current().series[scrub];
        }

        function up() {
            return trendOf(current()) >= 0;
        }

        let stopNumber = effect(() => {
            number.value = shown();
        });

        // Fades in from a soft blur whenever the figure changes, rather than snapping.
        let stopTrend = effect(() => {
            let next = TREND.format(trendOf(current()));

            if (previous && previous !== next) {
                text?.animate(
                    [{ filter: 'blur(4px)', opacity: 0 }, { filter: 'blur(0px)', opacity: 1 }],
                    { duration: 200, easing: 'ease-out' }
                );
            }

            previous = next;
        });

        onCleanup(() => {
            stopNumber();
            stopTrend();
        });

        return html`
            <div
                class='stat-counter-card ${() => view.scrub !== null && '--scrubbing'} ${() => view.scrub !== null && view.scrub !== last() && '--past'}'
                style='--index: ${index}'
                ${inherited?.[STAT_COUNTER_CARD]}
                ${attributes[STAT_COUNTER_CARD]}
            >
                <dt class='stat-counter-label'>${() => current().label}</dt>
                <dd class='stat-counter-body'>
                    <span class='stat-counter-sr'>${() => `${format(current(), valueOf(current()))}, ${TREND.format(trendOf(current()))}`}</span>
                    <span aria-hidden='true' class='stat-counter-value'>
                        <span class='stat-counter-affix'>${() => current().prefix ?? ''}</span>
                        ${counter({
                            class: 'counter--ticker stat-counter-counter',
                            currency: 'IGNORE',
                            decimals: initial.decimals ?? 0,
                            delay: 0,
                            startOnView: true,
                            state: number,
                            value: valueOf(initial)
                        })}
                        <span class='stat-counter-affix'>${() => current().suffix ?? ''}</span>
                    </span>
                    <span aria-hidden='true' class='stat-counter-chips'>
                        <span class='stat-counter-chip stat-counter-trend ${() => up() !== ((current().goodWhen ?? 'up') === 'up') && '--bad'} ${() => !up() && '--down'} ${() => view.scrub !== null && '--hidden'}'>
                            <svg
                                class='stat-counter-arrow'
                                fill='none'
                                stroke='currentColor'
                                stroke-linecap='round'
                                stroke-linejoin='round'
                                stroke-width='1.5'
                                viewBox='0 0 12 12'
                            >
                                <path d='M6 9.5v-7M3 5.5l3-3 3 3' />
                            </svg>
                            <span ${{ onrender: (element: HTMLElement) => { text = element; } }}>
                                ${() => TREND.format(trendOf(current()))}
                            </span>
                        </span>
                        <span class='stat-counter-chip stat-counter-when ${() => view.scrub === null && '--hidden'}'>
                            ${() => ago(last() - (view.scrub ?? last()))}
                        </span>
                    </span>
                    <div
                        aria-valuemin='0'
                        class='stat-counter-slider'
                        role='slider'
                        tabindex='0'
                        ${inherited?.[STAT_COUNTER_SLIDER]}
                        ${attributes[STAT_COUNTER_SLIDER]}
                        ${{
                            'aria-label': () => `${current().label} history`,
                            'aria-valuemax': () => String(last()),
                            'aria-valuenow': () => String(view.scrub ?? last()),
                            'aria-valuetext': () => `${format(current(), shown())}, ${ago(last() - (view.scrub ?? last()))}`,
                            onblur: () => {
                                view.scrub = null;
                            },
                            onkeydown: (e: KeyboardEvent) => {
                                let end = last(),
                                    now = view.scrub ?? end,
                                    next = ({
                                        ArrowLeft: now - 1,
                                        ArrowRight: now + 1,
                                        End: end,
                                        Escape: end,
                                        Home: 0
                                    } as Record<string, number>)[e.key];

                                if (next === undefined) {
                                    return;
                                }

                                e.preventDefault();
                                next = Math.min(Math.max(next, 0), end);
                                view.scrub = next === end ? null : next;
                            },
                            onpointercancel: () => {
                                view.scrub = null;
                            },
                            // Touch scrubs by dragging along the line.
                            onpointerdown: (e: PointerEvent) => {
                                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                                pick(e);
                            },
                            onpointerleave: (e: PointerEvent) => {
                                if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
                                    view.scrub = null;
                                }
                            },
                            onpointermove: (e: PointerEvent) => {
                                if (e.pointerType === 'mouse' || e.buttons) {
                                    pick(e);
                                }
                            },
                            onpointerup: (e: PointerEvent) => {
                                if (e.pointerType !== 'mouse') {
                                    view.scrub = null;
                                }
                            }
                        }}
                    >
                        <div aria-hidden='true' class='stat-counter-spark'>
                            <svg class='stat-counter-line' preserveAspectRatio='none' viewBox='0 0 ${WIDTH} ${HEIGHT}'>
                                <path
                                    d='${() => path(current().series)}'
                                    fill='none'
                                    stroke='currentColor'
                                    stroke-linecap='round'
                                    stroke-linejoin='round'
                                    stroke-width='1.5'
                                    style='${() => `d: path('${path(current().series)}')`}'
                                    vector-effect='non-scaling-stroke'
                                />
                            </svg>
                            <svg
                                class='stat-counter-line stat-counter-line--past'
                                preserveAspectRatio='none'
                                style='${() => {
                                    let scrub = view.scrub;

                                    return `clip-path: inset(-4px ${scrub === null ? 0 : (1 - scrub / last()) * 100}% -4px -4px)`;
                                }}'
                                viewBox='0 0 ${WIDTH} ${HEIGHT}'
                            >
                                <path
                                    d='${() => path(current().series)}'
                                    fill='none'
                                    stroke='currentColor'
                                    stroke-linecap='round'
                                    stroke-linejoin='round'
                                    stroke-width='1.5'
                                    style='${() => `d: path('${path(current().series)}')`}'
                                    vector-effect='non-scaling-stroke'
                                />
                            </svg>
                            <span
                                class='stat-counter-cursor'
                                style='${() => `left: ${((point()?.x ?? WIDTH) / WIDTH) * 100}%`}'
                            ></span>
                            <span
                                class='stat-counter-dot'
                                style='${() => {
                                    let at = point();

                                    return `left: ${((at?.x ?? WIDTH) / WIDTH) * 100}%; top: ${((at?.y ?? HEIGHT / 2) / HEIGHT) * 100}%`;
                                }}'
                            ></span>
                        </div>
                    </div>
                </dd>
            </div>
        `;
    }

    onCleanup(() => {
        observer?.disconnect();
    });

    return html`
        <div class='stat-counter' ${inherited} ${attributes}>
            <dl
                class='stat-counter-list'
                ${{
                    onconnect: (element: HTMLElement) => {
                        observer = new IntersectionObserver((entries) => {
                            if (!entries.some((entry) => entry.isIntersecting)) {
                                return;
                            }

                            observer?.disconnect();
                            element.classList.add('--started');
                        }, { threshold: 0.5 });
                        observer.observe(element);
                    }
                }}
            >
                ${stats.map((_, index) => card(index))}
            </dl>
        </div>
    `;
}


export default Object.assign(template, { card: STAT_COUNTER_CARD, slider: STAT_COUNTER_SLIDER } as const);
export type { Stat as StatCounterStat, State as StatCounterState };
