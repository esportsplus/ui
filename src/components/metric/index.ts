import { component, html, type Attributes } from '@esportsplus/template';
import { batch, computed, dispose, onCleanup, reactive, ReactiveArray, read } from '@esportsplus/reactivity';
import flash from './flash';
import './scss/index.scss';


type A = Attributes & {
    [METRIC_PLOT]?: Attributes;
    data: Point[];
    format?: (value: number) => string;
    state?: State;
    title: string;
};

type Point = {
    label: string;
    value: number;
};

type State = {
    active: boolean;
    index: number;
};


const EVENTS = ['clear', 'concat', 'pop', 'push', 'reverse', 'set', 'shift', 'sort', 'splice', 'unshift'] as const;

const KEYS: Record<string, (index: number, last: number) => number> = {
    ArrowLeft: (index) => index - 1,
    ArrowRight: (index) => index + 1,
    End: (_, last) => last,
    Home: () => 0
};

const METRIC_PLOT = Symbol.for('@esportsplus/ui/metric.plot');

// Room for the scrub dot and its ring at the extremes.
const PAD_X = 8;

const PAD_Y = 10;

// A reactive array's listeners can never be removed, so each array gets one listener per event that fans out to
// whichever metrics are mounted on it, and an unmounted metric only leaves this set.
const SUBSCRIBERS = new WeakMap<ReactiveArray<Point>, Set<VoidFunction>>();


function subscribe(data: ReactiveArray<Point>, listener: VoidFunction) {
    let listeners = SUBSCRIBERS.get(data) ?? new Set<VoidFunction>();

    if (!SUBSCRIBERS.has(data)) {
        SUBSCRIBERS.set(data, listeners);

        for (let i = 0, n = EVENTS.length; i < n; i++) {
            data.on(EVENTS[i], () => {
                for (let fn of listeners) {
                    fn();
                }
            });
        }
    }

    listeners.add(listener);

    return () => {
        listeners.delete(listener);
    };
}


function template(this: { attributes?: Partial<A> } | void, { data, format = String, state = reactive({ active: false, index: data.length - 1 }), title, ...attributes }: A) {
    let plot: HTMLElement | undefined,
        resize: ResizeObserver | undefined,
        // Plot and tip sizes in CSS pixels: the chart is drawn at the size it is shown, so the stroke, dot and tip
        // keep their size in any card instead of scaling with it.
        size = reactive({ height: 0, tip: 0, width: 0 }),
        tip: HTMLElement | undefined,
        view = reactive({ announcement: '', revision: 0, shown: false }),
        visible: IntersectionObserver | undefined;

    // A snapshot per revision, so every binding reads one consistent series while the array changes under it.
    let series = computed(() => {
        void view.revision;

        let max = -Infinity,
            min = Infinity,
            points = data.slice();

        for (let i = 0, n = points.length; i < n; i++) {
            max = Math.max(max, points[i].value);
            min = Math.min(min, points[i].value);
        }

        return { max, min, points, span: max - min || 1 };
    });

    function delta() {
        let points = read(series).points;

        if (!points.length) {
            return '';
        }

        let change = points[points.length - 1].value - points[0].value;

        return `${change > 0 ? '+' : change < 0 ? '-' : ''}${format(Math.abs(change))}`;
    }

    function describe(index: number) {
        let point = read(series).points[index];

        return point ? `${point.label}: ${format(point.value)}` : '';
    }

    function last() {
        return Math.max(read(series).points.length - 1, 0);
    }

    function line() {
        if (!size.width) {
            return '';
        }

        return read(series).points.map((point, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(point.value).toFixed(1)}`).join(' ');
    }

    function measure() {
        if (!plot) {
            return;
        }

        batch(() => {
            size.height = plot!.clientHeight;
            size.tip = tip?.offsetWidth ?? 0;
            size.width = plot!.clientWidth;
        });
    }

    function nearest(clientX: number) {
        if (!plot) {
            return state.index;
        }

        let box = plot.getBoundingClientRect(),
            // Divides out any CSS scale so the maths holds inside a scaled container.
            at = (clientX - box.left) / (box.width / plot.clientWidth || 1);

        return Math.min(Math.max(Math.round((at - PAD_X) / step()), 0), last());
    }

    function observe(element: HTMLElement) {
        resize ??= new ResizeObserver(measure);
        resize.observe(element);
    }

    function point() {
        return read(series).points[state.index];
    }

    function step() {
        return (size.width - PAD_X * 2) / Math.max(read(series).points.length - 1, 1);
    }

    function x(index: number) {
        return PAD_X + index * step();
    }

    function y(value: number) {
        let { min, span } = read(series);

        return PAD_Y + (1 - (value - min) / span) * (size.height - PAD_Y * 2);
    }

    if (data instanceof ReactiveArray) {
        onCleanup(subscribe(data, () => {
            batch(() => {
                view.revision++;

                // Rests on the newest point unless someone is reading the chart.
                if (!state.active || state.index > last()) {
                    state.index = last();
                }
            });
        }));
    }

    onCleanup(() => {
        dispose(series);
    });

    return html`
        <div class='metric' ${this?.attributes} ${attributes}>
            <div class='metric-header'>
                <div>
                    <div class='metric-title'>${title}</div>
                    <div class='metric-value'>${() => {
                        let points = read(series).points;

                        return points.length > 0 && format(points[points.length - 1].value);
                    }}</div>
                </div>
                <div class='metric-delta'>
                    <span class='metric-delta-value'>${() => delta()}</span>
                    vs ${() => read(series).points[0]?.label ?? ''}
                </div>
            </div>

            <div
                aria-roledescription='line chart'
                class='metric-plot'
                role='group'
                tabindex='0'
                ${this?.attributes?.[METRIC_PLOT]}
                ${attributes[METRIC_PLOT]}
                ${{
                    'aria-label': () => `${title}, ${read(series).points.length} points. Use arrow keys to read values.`,
                    class: [
                        () => state.active && '--active',
                        () => view.shown && 'metric-plot--shown'
                    ],
                    onblur: () => {
                        state.active = false;
                    },
                    onconnect: (element: HTMLElement) => {
                        plot = element;
                        observe(element);
                        visible = new IntersectionObserver((entries) => {
                            if (!entries.some((entry) => entry.isIntersecting)) {
                                return;
                            }

                            visible?.disconnect();
                            view.shown = true;
                        });
                        visible.observe(element);
                    },
                    ondisconnect: () => {
                        resize?.disconnect();
                        visible?.disconnect();
                    },
                    onfocus: () => {
                        state.active = true;
                        view.announcement = describe(state.index);
                    },
                    onkeydown: (e: KeyboardEvent) => {
                        let key = KEYS[e.key];

                        if (!key) {
                            return;
                        }

                        e.preventDefault();

                        let index = Math.min(Math.max(key(state.index, last()), 0), last());

                        state.active = true;
                        state.index = index;
                        view.announcement = describe(index);
                    },
                    onpointercancel: () => {
                        state.active = false;
                    },
                    onpointerdown: (e: PointerEvent) => {
                        if (e.pointerType !== 'touch') {
                            return;
                        }

                        state.index = nearest(e.clientX);
                        state.active = true;
                    },
                    onpointerleave: (e: PointerEvent) => {
                        if (e.pointerType !== 'touch') {
                            state.active = false;
                        }
                    },
                    onpointermove: (e: PointerEvent) => {
                        if (e.pointerType === 'touch' && !state.active) {
                            return;
                        }

                        state.index = nearest(e.clientX);
                        state.active = true;
                    },
                    onpointerup: (e: PointerEvent) => {
                        if (e.pointerType === 'touch') {
                            state.active = false;
                        }
                    }
                }}
            >
                <svg aria-hidden='true' class='metric-svg'>
                    <path class='metric-area' d='${() => {
                        let path = line();

                        return path && `${path} L${x(last()).toFixed(1)} ${size.height} L${x(0).toFixed(1)} ${size.height} Z`;
                    }}' />
                    <path class='metric-line' d='${() => line()}' fill='none' pathLength='1' />
                </svg>

                <div aria-hidden='true' class='metric-overlay'>
                    <div class='metric-cursor' style='${() => `left: ${x(state.index)}px`}'></div>
                    <div class='metric-dot' style='${() => `left: ${x(state.index)}px; top: ${y(point()?.value ?? 0)}px`}'></div>
                    <div
                        class='metric-tip'
                        style='${() => {
                            let half = size.tip / 2;

                            // Kept inside the card near either edge, and centred when the card is narrower than the tip.
                            return `left: ${size.width < size.tip ? size.width / 2 : Math.min(Math.max(x(state.index), half), size.width - half)}px`;
                        }}'
                        ${{
                            onconnect: (element: HTMLElement) => {
                                tip = element;
                                observe(element);
                            }
                        }}
                    >
                        <span class='metric-tip-value'>${() => {
                            let at = point();

                            return at && format(at.value);
                        }}</span>
                        <span class='metric-tip-label'>${() => point()?.label ?? ''}</span>
                    </div>
                </div>
            </div>

            <span aria-live='polite' class='metric-sr'>${() => view.announcement}</span>
            <div class='metric-sr'>
                <table>
                    <caption>${title}</caption>
                    <thead>
                        <tr>
                            <th scope='col'>Day</th>
                            <th scope='col'>Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${() => read(series).points.map((point) => html`
                            <tr>
                                <th scope='row'>${point.label}</th>
                                <td>${format(point.value)}</td>
                            </tr>
                        `)}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}


export default component(template, { flash, plot: METRIC_PLOT });
export type { Point as MetricPoint, State as MetricState };
