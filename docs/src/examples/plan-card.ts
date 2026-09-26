import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { planCard } from '@esportsplus/ui';
import type { Entry } from '../types';
import './plan-card.scss';


// Kobra's plan card (https://kobra.systems/components/plan-card), rebuilt from its public preview on our
// template and reactivity.


const todos = () => [
    { label: 'Extract text from every doc page' },
    { label: 'Build the search index' },
    { label: 'Add the ⌘K search endpoint' },
    { label: 'Rank by heading, then body' },
    { label: 'Cache results at the edge' },
    { label: 'Reindex on every deploy' }
];


function demo(options: { autoApprove?: number; done?: number; modifier?: string; peek?: number } = {}) {
    let log = reactive({ last: 'waiting for approval', run: 0 });

    return html`
        <div class='plan-card-demo'>
            ${() => {
                // Replay remounts the card, restarting its countdown.
                log.run;

                return planCard({
                    autoApprove: options.autoApprove,
                    class: options.modifier,
                    description: 'Index every page and put it behind ⌘K. Results are ranked by heading before body and cached at the edge.',
                    onapprove: (auto) => {
                        log.last = auto ? 'onapprove(auto: true)' : 'onapprove(auto: false)';
                    },
                    ondownload: () => {
                        log.last = 'ondownload()';
                    },
                    onexpand: () => {
                        log.last = 'onexpand()';
                    },
                    onview: () => {
                        log.last = 'onview()';
                    },
                    peek: options.peek,
                    title: 'Full-text search for the docs',
                    todos: todos().map((todo, index) => ({ ...todo, done: index < (options.done ?? 0) }))
                });
            }}
            <div class='plan-card-demo-bar'>
                <span class='plan-card-demo-status'>${() => log.last}</span>
                <button
                    class='plan-card-demo-replay'
                    type='button'
                    onclick='${() => {
                        log.last = 'waiting for approval';
                        log.run++;
                    }}'
                >
                    Replay
                </button>
            </div>
        </div>
    `;
}


export default {
    name: 'plan-card',
    variants: [
        {
            render: () => demo(),
            title: 'default'
        },
        {
            render: () => demo({ autoApprove: 0 }),
            title: 'manual approval (autoApprove: 0)'
        },
        {
            render: () => demo({ autoApprove: 5, done: 2, peek: 4 }),
            title: 'short countdown, done to-dos, peek: 4'
        },
        {
            render: () => demo({ modifier: 'plan-card--blue plan-card--flat' }),
            title: 'plan-card--blue plan-card--flat'
        }
    ]
} satisfies Entry;
