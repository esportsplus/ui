import { webSearch } from '@esportsplus/ui';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import type { Source, Step } from '@esportsplus/ui/web-search';
import { chat, icons, replay } from './agent';


let sources: Source[] = [
    { brand: 'reddit', domain: 'www.reddit.com', href: 'https://www.reddit.com', title: 'Tailwind UI vs building your own: a cost breakdown' },
    { brand: 'linkedin', domain: 'www.linkedin.com', href: 'https://www.linkedin.com', title: 'We shipped our design system in 6 weeks. Here is what it cost' },
    { brand: 'github', domain: 'github.com', href: 'https://github.com', title: 'shadcn/ui — the registry model explained' },
    { brand: 'figma', domain: 'www.figma.com', href: 'https://www.figma.com', title: 'Design tokens: a practical guide' },
    { brand: 'notion', domain: 'www.notion.so', href: 'https://www.notion.so', title: 'How we priced our component library' }
];

let steps = (): Step[] => [
    { dwell: 1700, heading: true, icon: icons.search(), label: 'Ran 3 searches' },
    { dwell: 2400, icon: icons.idea(), label: 'Searching for what teams actually pay for in a component library', meta: '5 results', sources },
    { brand: 'x', dwell: 1900, label: 'Searched X for', meta: '7 posts', query: 'component library OR design system pricing' },
    { brand: 'reddit', dwell: 1800, label: 'Searched Reddit for', meta: '12 threads', query: 'r/reactjs worth paying for' },
    { dwell: 2400, icon: icons.idea(), label: 'Reading the strongest three threads' }
];


function driven() {
    let list = steps().slice(1),
        state = reactive({ revealed: 0 }),
        units = list.reduce((total, step) => total + (step.sources ? 2 : 1), 0);

    return html`
        <div class='agent-demo agent-demo--wide'>
            ${webSearch({ state, steps: list })}
            <div style='display: flex; gap: var(--size-300);'>
                <div class='button button--tertiary' style='--width: auto;' onclick='${() => state.revealed = Math.min(state.revealed + 1, units)}'>
                    next event
                </div>
                <div class='button button--tertiary' style='--width: auto;' onclick='${() => state.revealed = 0}'>
                    reset
                </div>
            </div>
        </div>
    `;
}


export default {
    name: 'web-search',
    variants: [
        {
            render: () => replay((onComplete) => webSearch({ onComplete, steps: steps() }), 'agent-demo--wide'),
            title: 'default'
        },
        {
            render: () => chat(
                'What do teams actually pay for in a component library? Search online',
                [
                    'The consistent answer across threads is time, not pixels: teams pay to skip the six weeks it takes to get tokens, theming and accessibility right.',
                    'The second theme is ownership. Registry-style libraries that copy source into the repo beat npm packages, because nobody wants a dependency they cannot patch.'
                ],
                (onComplete) => webSearch({ onComplete, steps: steps() })
            ),
            title: 'in a chat'
        },
        {
            render: () => replay((onComplete) => webSearch({
                onComplete,
                steps: [
                    { brand: 'google', dwell: 1200, label: 'Searched Google for', meta: '9 results', query: 'headless ui accessibility audit' },
                    {
                        dwell: 1400,
                        label: 'Opened the top results',
                        meta: '8 pages',
                        sources: [
                            ...sources,
                            { brand: 'x', domain: 'x.com', title: 'Thread: what we learned auditing our dropdowns' },
                            { brand: 'discord', domain: 'discord.com', title: 'Radix community: focus management' },
                            { domain: 'www.w3.org', title: 'ARIA Authoring Practices Guide' }
                        ]
                    },
                    { brand: 'github', dwell: 1200, label: 'Checked the repo' }
                ]
            }), 'agent-demo--wide'),
            title: 'no heading, more than six sources'
        },
        {
            render: () => replay((onComplete) => webSearch({ onComplete, steps: steps(), working: false }), 'agent-demo--wide'),
            title: 'without the working indicator'
        },
        {
            render: driven,
            title: 'driven from real events'
        }
    ]
};
