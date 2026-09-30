import { batch, onCleanup, reactive, ReactiveArray } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { metric } from '@esportsplus/ui';
import type { MetricPoint } from '~/components/metric';
import type { Entry } from '../types';
import './metric.scss';


type Walk = {
    decimals?: number;
    floor: number;
    format: (value: number) => string;
    seed: number;
    start: number;
    swing: number;
    title: string;
};


const CURRENCY = new Intl.NumberFormat('en-US', { currency: 'USD', maximumFractionDigits: 0, style: 'currency' });

const DAY = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short' });

const DAYS = 30;

const RESPONSE: Walk = { floor: 80, format: (value) => `${value} ms`, seed: 7, start: 128, swing: 0.14, title: 'Response time' };

const WALKS: Walk[] = [
    { floor: 30000, format: (value) => CURRENCY.format(value), seed: 3, start: 48210, swing: 0.08, title: 'Revenue' },
    { floor: 8000, format: (value) => value.toLocaleString('en-US'), seed: 5, start: 12480, swing: 0.06, title: 'Users' },
    { decimals: 2, floor: 2, format: (value) => `${value.toFixed(2)}%`, seed: 9, start: 3.42, swing: 0.07, title: 'Conversion' },
    { floor: 120, format: (value) => `${value} ms`, seed: 11, start: 184, swing: 0.1, title: 'Latency' }
];


function days(walk: Walk) {
    let points: MetricPoint[] = [],
        random = mulberry32(walk.seed),
        value = walk.start;

    for (let i = 0; i < DAYS; i++) {
        value = step(walk, value, random);
        points.push({ label: label(i), value });
    }

    return points;
}

// Day 0 is Aug 25; the walk runs on from there.
function label(day: number) {
    return DAY.format(new Date(2026, 7, 25 + day));
}

// Seeded, so every load draws the same walk.
function mulberry32(seed: number) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;

        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);

        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function revenue() {
    let points: MetricPoint[] = [],
        random = mulberry32(21),
        value = 4200;

    for (let i = 0; i < 14; i++) {
        value = Math.max(2400, value * (1 + (random() - 0.44) * 0.12));
        points.push({ label: `Week ${i + 1}`, value: Math.round(value) });
    }

    return points;
}

function step(walk: Walk, value: number, random: () => number) {
    return Number(Math.max(walk.floor, value * (1 + (random() - 0.48) * walk.swing)).toFixed(walk.decimals ?? 0));
}


export default {
    name: 'metric',
    variants: [
        {
            render: () => html`
                <div class='metric-demo'>
                    ${metric({ data: days(RESPONSE), format: RESPONSE.format, title: RESPONSE.title })}
                </div>
            `,
            title: 'default'
        },
        {
            render: () => html`
                <div class='metric-demo'>
                    ${metric({ class: 'metric--accent', data: revenue(), format: (value) => CURRENCY.format(value), title: 'Weekly revenue' })}
                </div>
            `,
            title: 'metric--accent, currency format'
        },
        {
            render: () => html`
                <div class='grid metric-demo metric-demo--grid'>
                    ${WALKS.map((walk) => metric({ class: 'grid-item', data: days(walk), format: walk.format, title: walk.title }))}
                </div>
            `,
            title: 'small cards in a grid'
        },
        {
            render: () => {
                let day = DAYS,
                    random = mulberry32(99),
                    series = WALKS.map((walk) => new ReactiveArray(days(walk))),
                    view = reactive({ paused: false });

                // A new day every second and a half, the oldest dropping off so each card keeps a 30-day window.
                let timer = setInterval(() => {
                    if (view.paused) {
                        return;
                    }

                    // One redraw per card rather than one for the push and another for the shift.
                    batch(() => {
                        for (let i = 0, n = series.length; i < n; i++) {
                            let points = series[i];

                            points.push({ label: label(day), value: step(WALKS[i], points[points.length - 1].value, random) });
                            points.shift();
                        }
                    });

                    day++;
                }, 1500);

                onCleanup(() => clearInterval(timer));

                return html`
                    <div class='grid metric-demo metric-demo--grid'>
                        ${WALKS.map((walk, i) => metric({ class: 'grid-item', data: series[i], format: walk.format, title: walk.title }))}
                    </div>
                    <button class='button --background-blue --color-white' onclick=${() => {
                        view.paused = !view.paused;
                    }} type='button'>
                        ${() => view.paused ? 'resume' : 'pause'}
                    </button>
                `;
            },
            title: 'live data (push to a ReactiveArray)'
        },
        {
            render: () => html`
                <div class='metric-demo metric-demo--resizable'>
                    ${metric({ class: 'metric--accent', data: days(RESPONSE), format: RESPONSE.format, title: RESPONSE.title })}
                </div>
            `,
            title: 'resizable container (drag the corner)'
        },
        {
            render: () => {
                let data = days(RESPONSE),
                    state = reactive({ active: true, index: 12 });

                return html`
                    <div class='metric-demo metric-demo--controlled'>
                        ${metric({ data, format: RESPONSE.format, state, title: RESPONSE.title })}
                        <span class='metric-demo-status'>
                            ${() => `${state.active ? 'showing' : 'hidden'}: ${data[state.index].label}`}
                        </span>
                        <button class='button --background-blue --color-white' onclick=${() => {
                            state.active = true;
                            state.index = (state.index + 1) % data.length;
                        }} type='button'>
                            next point (external state)
                        </button>
                    </div>
                `;
            },
            title: 'controlled state'
        }
    ]
} satisfies Entry;
