import { html, type Attributes } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import './scss/index.scss';


type A = Attributes & {
    [SPARKLINE_PLOT]?: Attributes;
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


const HEIGHT = 160;

const KEYS: Record<string, (index: number, last: number) => number> = {
    ArrowLeft: (index) => index - 1,
    ArrowRight: (index) => index + 1,
    End: (_, last) => last,
    Home: () => 0
};

// Room for the scrub dot and its ring at the extremes.
const PAD_X = 8;

const PAD_Y = 10;

const SPARKLINE_PLOT = Symbol.for('@esportsplus/ui/sparkline.plot');

// Keeps the tooltip inside the chart near either edge.
const TIP_INSET = 72;

const WIDTH = 520;


function percent(value: number, of: number) {
    return `${(value / of) * 100}%`;
}


function template(this: { attributes?: Partial<A> } | void, { data, format = String, state = reactive({ active: false, index: data.length - 1 }), title, ...attributes }: A) {
    let first = data[0],
        last = data[data.length - 1],
        max = -Infinity,
        min = Infinity,
        observer: IntersectionObserver | undefined,
        plot: HTMLElement | undefined,
        view = reactive({ announcement: '', shown: false });

    for (let i = 0, n = data.length; i < n; i++) {
        max = Math.max(max, data[i].value);
        min = Math.min(min, data[i].value);
    }

    let delta = last.value - first.value,
        span = max - min || 1,
        step = (WIDTH - PAD_X * 2) / Math.max(data.length - 1, 1);

    function describe(index: number) {
        return `${data[index].label}: ${format(data[index].value)}`;
    }

    function nearest(clientX: number) {
        if (!plot) {
            return state.index;
        }

        let box = plot.getBoundingClientRect(),
            x = ((clientX - box.left) / box.width) * WIDTH;

        return Math.min(Math.max(Math.round((x - PAD_X) / step), 0), data.length - 1);
    }

    function x(index: number) {
        return PAD_X + index * step;
    }

    function y(value: number) {
        return PAD_Y + (1 - (value - min) / span) * (HEIGHT - PAD_Y * 2);
    }

    let line = data.map((point, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(point.value).toFixed(1)}`).join(' '),
        area = `${line} L${x(data.length - 1)} ${HEIGHT} L${x(0)} ${HEIGHT} Z`;

    return html`
        <div class='sparkline' ${this?.attributes} ${attributes}>
            <div class='sparkline-header'>
                <div>
                    <div class='sparkline-title'>${title}</div>
                    <div class='sparkline-value'>${format(last.value)}</div>
                </div>
                <div class='sparkline-delta'>
                    <span class='sparkline-delta-value'>${`${delta > 0 ? '+' : delta < 0 ? '-' : ''}${format(Math.abs(delta))}`}</span>
                    vs ${first.label}
                </div>
            </div>

            <div
                aria-roledescription='line chart'
                class='sparkline-plot'
                role='group'
                tabindex='0'
                ${this?.attributes?.[SPARKLINE_PLOT]}
                ${attributes[SPARKLINE_PLOT]}
                ${{
                    'aria-label': `${title}, ${data.length} points. Use arrow keys to read values.`,
                    class: () => `${state.active ? '--active' : ''} ${view.shown ? '--shown' : ''}`,
                    onblur: () => {
                        state.active = false;
                    },
                    onconnect: (element: HTMLElement) => {
                        plot = element;
                        observer = new IntersectionObserver((entries) => {
                            if (!entries.some((entry) => entry.isIntersecting)) {
                                return;
                            }

                            observer?.disconnect();
                            view.shown = true;
                        });
                        observer.observe(element);
                    },
                    ondisconnect: () => {
                        observer?.disconnect();
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

                        let index = Math.min(Math.max(key(state.index, data.length - 1), 0), data.length - 1);

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
                <svg aria-hidden='true' class='sparkline-svg' viewBox='0 0 ${WIDTH} ${HEIGHT}'>
                    <path class='sparkline-area' d='${area}' />
                    <path class='sparkline-line' d='${line}' fill='none' pathLength='1' />
                </svg>

                <div aria-hidden='true' class='sparkline-overlay'>
                    <div class='sparkline-cursor' style='${() => `left: ${percent(x(state.index), WIDTH)}`}'></div>
                    <div
                        class='sparkline-dot'
                        style='${() => `left: ${percent(x(state.index), WIDTH)}; top: ${percent(y(data[state.index].value), HEIGHT)}`}'
                    ></div>
                    <div
                        class='sparkline-tip'
                        style='${() => `left: ${percent(Math.min(Math.max(x(state.index), TIP_INSET), WIDTH - TIP_INSET), WIDTH)}`}'
                    >
                        <span class='sparkline-tip-value'>${() => format(data[state.index].value)}</span>
                        <span class='sparkline-tip-label'>${() => data[state.index].label}</span>
                    </div>
                </div>
            </div>

            <span aria-live='polite' class='sparkline-sr'>${() => view.announcement}</span>
            <div class='sparkline-sr'>
                <table>
                    <caption>${title}</caption>
                    <thead>
                        <tr>
                            <th scope='col'>Day</th>
                            <th scope='col'>Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map((point) => html`
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


export default Object.assign(template, { plot: SPARKLINE_PLOT } as const);
export type { Point as SparklinePoint, State as SparklineState };
