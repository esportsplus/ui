import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { statCounter } from '@esportsplus/ui';
import type { StatCounterStat, StatCounterState } from '~/components/stat-counter';
import type { Entry } from '../types';
import './stat-counter.scss';


type Metric = Omit<StatCounterStat, 'series'> & {
    base: number;
    swing: number;
};


const METRICS: Metric[] = [
    { base: 48210, goodWhen: 'up', label: 'Revenue', prefix: '$', swing: 0.08 },
    { base: 12480, goodWhen: 'up', label: 'Users', swing: 0.06 },
    { base: 3.42, decimals: 2, goodWhen: 'up', label: 'Conversion', suffix: '%', swing: 0.07 },
    { base: 184, goodWhen: 'down', label: 'Latency', suffix: ' ms', swing: 0.1 }
];

const POINTS = 12;


// Seeded, so every load draws the same walk.
function mulberry32(seed: number) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;

        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);

        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// A random walk per metric, walked backwards from today's figure.
function initial() {
    let random = mulberry32(7);

    return METRICS.map(({ base, swing, ...metric }) => {
        let series = [base];

        for (let i = 1; i < POINTS; i++) {
            series.unshift(series[0] * (1 + (random() - 0.5) * swing));
        }

        return { ...metric, series } satisfies StatCounterStat;
    });
}


export default {
    name: 'stat-counter',
    variants: [
        {
            render: () => {
                let random = mulberry32(99),
                    // Typed as the plain state so the whole list can be swapped on refresh.
                    state: StatCounterState = reactive({ stats: initial() }),
                    view = reactive({ turns: 0 });

                // Each refresh drops the oldest point and adds a new one, so the line reads as time moving on.
                function refresh() {
                    view.turns++;
                    state.stats = state.stats.map((stat, i) => {
                        let last = stat.series[stat.series.length - 1];

                        return { ...stat, series: [...stat.series.slice(1), last * (1 + (random() - 0.45) * METRICS[i].swing * 2)] };
                    });
                }

                return html`
                    <div class='stat-counter-demo'>
                        <div class='stat-counter-demo-header'>
                            <div>
                                <div class='stat-counter-demo-title'>Overview</div>
                                <div class='stat-counter-demo-subtitle'>Compared with the previous day</div>
                            </div>
                            <button class='stat-counter-demo-refresh' onclick=${refresh} type='button'>
                                <svg
                                    aria-hidden='true'
                                    fill='none'
                                    stroke='currentColor'
                                    stroke-linecap='round'
                                    stroke-linejoin='round'
                                    stroke-width='1.5'
                                    style='${() => `rotate: ${view.turns * 180}deg`}'
                                    viewBox='0 0 16 16'
                                >
                                    <path d='M13.25 8a5.25 5.25 0 0 1-9.4 3.2M2.75 8a5.25 5.25 0 0 1 9.4-3.2' />
                                    <path d='M12.5 1.75v3h-3M3.5 14.25v-3h3' />
                                </svg>
                                Refresh
                            </button>
                        </div>
                        ${statCounter({ state, stats: state.stats })}
                        <span aria-live='polite' class='stat-counter-demo-sr'>
                            ${() => view.turns > 0 ? `Updated ${view.turns} ${view.turns === 1 ? 'time' : 'times'}` : ''}
                        </span>
                    </div>
                `;
            },
            title: 'default'
        },
        {
            render: () => html`
                <div class='stat-counter-demo stat-counter-demo--narrow'>
                    ${statCounter({ stats: initial().slice(0, 2) })}
                </div>
            `,
            title: 'two stats, narrow container'
        }
    ]
} satisfies Entry;
