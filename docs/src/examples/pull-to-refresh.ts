import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { pullToRefresh } from '@esportsplus/ui';
import './pull-to-refresh.scss';


type Person = {
    color: string;
    handle: string;
    name: string;
};

type Post = Person & {
    id: string;
    text: string;
    time: string;
};


const INCOMING = [
    'Just found out our checkout button had a 300ms tap delay. Fixed.',
    'Reduced motion is not no motion. Cross-fades still help.',
    'Pairing on the new command palette this afternoon.',
    'Velocity handoff is the whole trick. Nobody notices, everyone feels it.',
    'Our design review now includes a slow-motion pass.',
    'New icons landed. One stroke weight across the whole set.'
];

const PEOPLE: Person[] = [
    { color: 'oklch(80% 0.1 250)', handle: '@ava', name: 'Ava Chen' },
    { color: 'oklch(80% 0.1 150)', handle: '@ben', name: 'Ben Ortiz' },
    { color: 'oklch(82% 0.1 60)', handle: '@cara', name: 'Cara Nwosu' },
    { color: 'oklch(80% 0.1 320)', handle: '@dev', name: 'Dev Patel' },
    { color: 'oklch(82% 0.1 20)', handle: '@fay', name: 'Fay Laurent' }
];

// Stands in for a network round trip.
const REFRESH_FOR = 1200;

const SEED = [
    'Shipped the new onboarding today. Two screens instead of five.',
    'Hot take: most loading spinners should be skeletons.',
    'Springs over durations for anything you can touch. Every time.',
    'Rewrote the settings page with plain CSS grid. Deleted 400 lines.',
    'The best animation is often the one you remove.',
    'Anyone else test gestures at 10% speed? It changes everything.',
    'Tabular numbers in every table, please.',
    'Friday demo went well. The drag-to-reorder finally feels right.'
];


function avatar(post: Post) {
    return html`
        <span aria-hidden='true' class='pull-to-refresh-demo-avatar' style='${`background: ${post.color};`}'>
            ${post.name.split(' ').map((part) => part[0]).join('')}
        </span>
    `;
}

function feed() {
    let next = 0,
        posts = reactive(SEED.map((text, i): Post => ({
            ...PEOPLE[i % PEOPLE.length],
            id: `seed-${i}`,
            text,
            time: `${(i + 1) * 7}m`
        }))),
        state = reactive({ refreshing: false });

    function load() {
        return new Promise<void>((resolve) => {
            setTimeout(() => {
                let fresh = Array.from({ length: 2 }, (): Post => {
                    let n = next++;

                    return {
                        ...PEOPLE[(n + 3) % PEOPLE.length],
                        id: `new-${n}`,
                        text: INCOMING[n % INCOMING.length],
                        time: 'now'
                    };
                });

                posts.unshift(...fresh);

                if (posts.length > 40) {
                    posts.splice(40);
                }

                resolve();
            }, REFRESH_FOR);
        });
    }

    return html`
        <div class='pull-to-refresh-demo'>
            <div class='pull-to-refresh-demo-screen'>
                <div class='pull-to-refresh-demo-header'>
                    <h3>Following</h3>
                    <button
                        aria-disabled='${() => String(state.refreshing)}'
                        aria-label='Refresh feed'
                        class='pull-to-refresh-demo-refresh'
                        onclick='${() => {
                            state.refreshing = true;
                        }}'
                        type='button'
                    >
                        <svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 16 16'>
                            <path d='M13.25 8a5.25 5.25 0 1 1-1.6-3.77M13.25 2.5v2.75H10.5' />
                        </svg>
                    </button>
                </div>
                ${pullToRefresh(
                    {
                        announce: (count: number) => `Updated, ${count} new post${count === 1 ? '' : 's'}`,
                        class: 'pull-to-refresh-demo-feed',
                        onrefresh: load,
                        state
                    },
                    html.reactive(posts, (post) => html`
                        <article class='pull-to-refresh-demo-post'>
                            ${avatar(post)}
                            <div class='pull-to-refresh-demo-body'>
                                <p class='pull-to-refresh-demo-byline'>
                                    <span class='pull-to-refresh-demo-name'>${post.name}</span>
                                    <span class='pull-to-refresh-demo-meta'>${`${post.handle} · ${post.time}`}</span>
                                </p>
                                <p class='pull-to-refresh-demo-text'>${post.text}</p>
                            </div>
                        </article>
                    `)
                )}
            </div>
        </div>
    `;
}


export default {
    name: 'pull-to-refresh',
    variants: [
        {
            render: feed,
            title: 'feed (drag down with a mouse or finger, or use the header button)'
        }
    ]
};
