import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { relativeTime } from '@esportsplus/ui';
import type { Entry } from '../types';
import './relative-time.scss';


const DAY = 24 * 60 * 60 * 1000;

const HOUR = 60 * 60 * 1000;

const MIN = 60 * 1000;

const SEC = 1000;

// The clock runs fast for a moment, so every label rolls the way it would over the next few minutes.
const SHOW: [wait: number, skip: number][] = [
    [500, 30 * SEC],
    [900, MIN],
    [900, 2 * MIN],
    [900, 3 * MIN]
];

// How long the last reading stays up before the clock returns.
const SHOW_HOLD = 1800;


export default {
    name: 'relative-time',
    variants: [
        {
            render: () => {
                let now = Date.now(),
                    states = [2 * HOUR + 14 * MIN, 4 * MIN + 51 * SEC, 12 * SEC].map((ago) => reactive({ date: now - ago, now: null as number | null })),
                    timers: ReturnType<typeof setTimeout>[] = [];

                function pin(value: number | null) {
                    for (let i = 0, n = states.length; i < n; i++) {
                        states[i].now = value;
                    }
                }

                function play() {
                    let start = Date.now(),
                        wait = 0;

                    for (let i = 0, n = timers.length; i < n; i++) {
                        clearTimeout(timers[i]);
                    }

                    timers = SHOW.map(([delay, skip]) => {
                        wait += delay;

                        return setTimeout(() => pin(start + skip), wait);
                    });

                    // Hands the labels back to the live clock; they roll home.
                    timers.push(setTimeout(() => pin(null), wait + SHOW_HOLD));
                }

                return html`
                    <div class='relative-time-demo'>
                        <p class='relative-time-demo-feed'>
                            <span class='relative-time-demo-clause'>
                                <span class='relative-time-demo-name'>Ana Ruiz</span> opened
                                this ${relativeTime({ date: states[0].date, state: states[0] })}
                                <span aria-hidden='true' class='relative-time-demo-dot'>·</span>
                            </span>
                            <span class='relative-time-demo-clause'>
                                edited ${relativeTime({ date: states[1].date, state: states[1] })}
                                <span aria-hidden='true' class='relative-time-demo-dot'>·</span>
                            </span>
                            <span class='relative-time-demo-clause'>
                                synced ${relativeTime({ date: states[2].date, state: states[2] })}
                            </span>
                        </p>
                        <button class='button --background-blue --color-white' onclick=${play} type='button'>
                            fast-forward the clock
                        </button>
                    </div>
                `;
            },
            title: 'default'
        },
        {
            render: () => {
                let now = Date.now();

                return html`
                    <ul class='relative-time-demo-list'>
                        ${[
                            ['Build finished', now - 45 * SEC],
                            ['Comment posted', now - 3 * HOUR],
                            ['Branch merged', now - 30 * HOUR],
                            ['Release tagged', now - 4 * DAY],
                            ['Project created', now - 40 * DAY]
                        ].map(([label, date]) => html`
                            <li>
                                <span>${label}</span>
                                ${relativeTime({ date })}
                            </li>
                        `)}
                    </ul>
                `;
            },
            title: 'every unit, live seconds'
        },
        {
            render: () => {
                let state = reactive({ date: null as number | null, now: null as number | null });

                return html`
                    <div class='relative-time-demo'>
                        <p class='relative-time-demo-feed'>
                            Last saved ${relativeTime({ date: null, state })}
                        </p>
                        <button class='button --background-blue --color-white' onclick=${() => {
                            state.date = Date.now();
                        }} type='button'>
                            save now
                        </button>
                    </div>
                `;
            },
            title: 'unknown until set (placeholder)'
        }
    ]
} satisfies Entry;
