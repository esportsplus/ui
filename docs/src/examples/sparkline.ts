import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { sparkline } from '@esportsplus/ui';
import type { Entry } from '../types';
import './sparkline.scss';


type Point = {
    label: string;
    value: number;
};


const CURRENCY = new Intl.NumberFormat('en-US', { currency: 'USD', maximumFractionDigits: 0, style: 'currency' });


// Seeded, so every load draws the same walk.
function mulberry32(seed: number) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;

        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);

        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function responseTimes() {
    let points: Point[] = [],
        random = mulberry32(7),
        value = 128;

    // Days 25 to 31 of August, then September.
    for (let i = 0; i < 30; i++) {
        let day = 25 + i;

        value = Math.max(80, value + (random() - 0.48) * 18);
        points.push({ label: day <= 31 ? `Aug ${day}` : `Sep ${day - 31}`, value: Math.round(value) });
    }

    return points;
}

function revenue() {
    let points: Point[] = [],
        random = mulberry32(21),
        value = 4200;

    for (let i = 0; i < 14; i++) {
        value = Math.max(2400, value * (1 + (random() - 0.44) * 0.12));
        points.push({ label: `Week ${i + 1}`, value: Math.round(value) });
    }

    return points;
}


export default {
    name: 'sparkline',
    variants: [
        {
            render: () => sparkline({ data: responseTimes(), format: (value) => `${value} ms`, title: 'Response time' }),
            title: 'default'
        },
        {
            render: () => sparkline({
                class: 'sparkline--accent',
                data: revenue(),
                format: (value) => CURRENCY.format(value),
                title: 'Weekly revenue'
            }),
            title: 'sparkline--accent, currency format'
        },
        {
            render: () => {
                let data = responseTimes(),
                    state = reactive({ active: true, index: 12 });

                return html`
                    <div class='sparkline-demo-controlled'>
                        ${sparkline({ data, format: (value) => `${value} ms`, state, title: 'Response time' })}
                        <span class='sparkline-demo-status'>
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
