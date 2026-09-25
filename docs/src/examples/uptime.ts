import { uptime } from '@esportsplus/ui';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import type { Service } from '~/components/uptime';


let degraded: Service[] = [
        {
            incidents: [
                { daysAgo: 0, level: 'degraded', minutes: 12, title: 'Elevated latency' },
                { daysAgo: 9, level: 'outage', minutes: 34, title: 'Region failover' }
            ],
            name: 'API'
        },
        {
            incidents: [],
            name: 'Dashboard'
        }
    ],
    services: Service[] = [
        {
            incidents: [
                { daysAgo: 51, level: 'degraded', minutes: 38, title: 'Elevated errors' },
                { daysAgo: 22, level: 'outage', minutes: 72, title: 'Database failover' },
                { daysAgo: 6, level: 'degraded', minutes: 21, title: 'High latency' }
            ],
            name: 'API'
        },
        {
            incidents: [
                { daysAgo: 40, level: 'degraded', minutes: 44, title: 'Slow page loads' },
                { daysAgo: 12, level: 'degraded', minutes: 16, title: 'Stale charts' }
            ],
            name: 'Dashboard'
        },
        {
            incidents: [
                { daysAgo: 57, level: 'degraded', minutes: 30, title: 'Delayed deliveries' },
                { daysAgo: 18, level: 'outage', minutes: 26, title: 'Deliveries paused' },
                { daysAgo: 17, level: 'degraded', minutes: 55, title: 'Retry backlog' }
            ],
            name: 'Webhooks'
        }
    ],
    // [row, day, how long to stay]
    sweep: [number, number, number][] = [
        [0, 30, 120],
        [0, 27, 120],
        [0, 24, 120],
        [0, 22, 1500],
        [2, 22, 120],
        [2, 20, 120],
        [2, 18, 1500],
        [2, 17, 1300]
    ];


function controlled() {
    let state = reactive({ day: -1, row: -1 }),
        timer: ReturnType<typeof setTimeout> | undefined;

    return html`
        <div style='width: min(440px, 100%);' ${{
            onconnect: () => {
                let i = 0;

                function next() {
                    let [row, day, stay] = sweep[i++ % sweep.length];

                    state.day = day;
                    state.row = row;
                    timer = setTimeout(next, stay);
                }

                timer = setTimeout(next, 200);
            },
            ondisconnect: () => {
                clearTimeout(timer);
            }
        }}>
            ${uptime({ services, state })}
        </div>
    `;
}


export default {
    name: 'uptime',
    variants: [
        {
            render: () => uptime({ services }),
            title: 'interactive (hover, or focus and use arrow keys)'
        },
        {
            render: () => uptime({ services: degraded }),
            title: 'incident today'
        },
        {
            render: () => controlled(),
            title: 'controlled highlight'
        }
    ]
};
