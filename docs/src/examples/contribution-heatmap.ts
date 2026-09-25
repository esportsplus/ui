import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { contributionHeatmap } from '@esportsplus/ui';
import type { ContributionHeatmapDay } from '~/components/contribution-heatmap';
import type { Entry } from '../types';
import './contribution-heatmap.scss';


// A trimmed, fixed copy of the lab's sample: 52 weeks of @xevrion's public graph, starting on a Sunday.
const COUNTS = [
    6, 7, 18, 9, 0, 1, 0, 0, 0, 0, 0, 0, 5, 10, 0, 0, 1, 0, 1, 0, 2, 7, 0, 2, 0, 0, 0, 0,
    1, 1, 2, 0, 6, 0, 3, 2, 1, 0, 2, 1, 12, 8, 11, 11, 4, 9, 14, 0, 12, 26, 7, 1, 2, 7, 1, 2,
    1, 7, 4, 0, 0, 0, 0, 0, 1, 0, 9, 12, 7, 3, 19, 7, 23, 4, 17, 46, 12, 27, 0, 0, 17, 3, 14, 4,
    2, 30, 0, 4, 1, 8, 8, 0, 6, 3, 10, 3, 6, 4, 2, 2, 5, 0, 1, 7, 0, 4, 4, 2, 3, 14, 3, 26,
    34, 42, 2, 0, 1, 1, 0, 2, 2, 1, 3, 2, 0, 6, 21, 25, 30, 23, 4, 0, 4, 9, 2, 1, 1, 14, 6, 2,
    1, 1, 14, 4, 4, 4, 9, 3, 4, 5, 5, 6, 28, 4, 1, 0, 7, 12, 4, 22, 37, 7, 8, 18, 9, 5, 19, 8,
    6, 15, 4, 4, 41, 12, 7, 5, 1, 4, 37, 5, 4, 9, 32, 34, 15, 18, 28, 3, 2, 2, 4, 9, 7, 5, 12, 3,
    24, 50, 8, 7, 12, 23, 45, 7, 7, 29, 6, 26, 36, 34, 10, 35, 11, 4, 3, 2, 38, 9, 4, 6, 4, 22, 8, 1,
    5, 2, 5, 10, 3, 6, 6, 3, 5, 7, 11, 9, 3, 0, 4, 6, 3, 8, 3, 2, 14, 7, 10, 11, 10, 9, 0, 8,
    7, 6, 0, 8, 6, 36, 34, 8, 6, 3, 2, 5, 13, 38, 4, 13, 27, 29, 17, 4, 44, 12, 12, 8, 31, 41, 49, 35,
    6, 13, 14, 2, 4, 27, 12, 2, 2, 20, 12, 3, 8, 1, 3, 36, 18, 17, 3, 2, 35, 4, 75, 24, 25, 26, 5, 24,
    5, 28, 15, 6, 22, 30, 13, 1, 1, 4, 7, 1, 19, 3, 10, 10, 4, 29, 4, 9, 21, 1, 1, 21, 7, 6, 9, 1,
    36, 0, 30, 8, 0, 87, 34, 13, 14, 2, 3, 5, 19, 2, 22, 0, 26, 3, 13, 8, 35, 6, 42, 47, 2, 2, 1, 0
];

// GitHub's own buckets, one digit per day.
const LEVELS = (
    '1121010000001100101011010000111010111011111111201311111111100000101111212124130021211301111' +
    '0111111111011011112133410110111110122321011111211112111111111311011123112112112114111113111' +
    '3322311111111124111241131333131111411112111111111111111011111121111101110113311111241233214' +
    '1113443122113111211111322113142231213212321111121111311211211113031043221112120312131441110'
);

const NUMBER = new Intl.NumberFormat('en-US');

const START = Date.UTC(2025, 8, 21);

const USER = 'xevrion';


function year(bucketed = true) {
    let days: ContributionHeatmapDay[] = [];

    for (let i = 0, n = COUNTS.length; i < n; i++) {
        days.push({
            count: COUNTS[i],
            date: new Date(START + i * 86400000).toISOString().slice(0, 10),
            level: bucketed ? Number(LEVELS[i]) : undefined
        });
    }

    return days;
}


export default {
    name: 'contribution-heatmap',
    variants: [
        {
            render: () => html`
                <div class='contribution-heatmap-demo'>
                    <span class='contribution-heatmap-demo-summary'>
                        <strong>${NUMBER.format(COUNTS.reduce((sum, count) => sum + count, 0))}</strong>
                        contributions in the last year by
                        <a href='https://github.com/${USER}' rel='noreferrer' target='_blank'>@${USER}</a>
                    </span>
                    ${contributionHeatmap({ data: year() })}
                    ${contributionHeatmap.legend({ class: 'contribution-heatmap-demo-legend' })}
                </div>
            `,
            title: 'default'
        },
        {
            render: () => html`
                <div class='contribution-heatmap-demo'>
                    ${contributionHeatmap({ class: 'contribution-heatmap--blue', data: year(false), thresholds: [1, 8, 16, 30] })}
                    ${contributionHeatmap.legend({ class: 'contribution-heatmap-demo-legend contribution-heatmap-legend--blue' })}
                </div>
            `,
            title: 'contribution-heatmap--blue, custom thresholds'
        },
        {
            render: () => {
                let data = year(),
                    state = reactive({ index: 0 });

                return html`
                    <div class='contribution-heatmap-demo'>
                        ${contributionHeatmap({ data, state })}
                        <span class='contribution-heatmap-demo-status'>
                            ${() => `tab stop: ${data[state.index].date} (${data[state.index].count})`}
                        </span>
                        <button class='button --background-blue --color-white' onclick=${() => {
                            let busiest = 0;

                            for (let i = 0, n = data.length; i < n; i++) {
                                if (data[i].count > data[busiest].count) {
                                    busiest = i;
                                }
                            }

                            state.index = busiest;
                        }} type='button'>
                            move tab stop to busiest day
                        </button>
                    </div>
                `;
            },
            title: 'controlled state'
        }
    ]
} satisfies Entry;
