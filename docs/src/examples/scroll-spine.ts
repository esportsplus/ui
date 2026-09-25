import { html } from '@esportsplus/template';
import { scrollSpine } from '@esportsplus/ui';
import './scroll-spine.scss';


type Section = {
    body: string[];
    heading: string;
    id: string;
};


const SECTIONS: Section[] = [
    {
        body: [
            'Our checkout function woke up in 2.1 seconds on a cold start. On a warm path it answered in 40ms, so every idle stretch of five minutes was quietly costing us the first customer back.',
            'The fix was not one change but four, and the order we made them in mattered more than any single one.'
        ],
        heading: 'Why cold starts matter',
        id: 'why'
    },
    {
        body: [
            'We started with averages and learned nothing. The p50 cold start looked fine because most requests were warm. What we needed was the p99 of requests that followed ten minutes of silence.',
            'A tiny scheduled probe did the job: it waited, fired one request, recorded the timing, and went back to sleep. Two weeks of that gave us a curve worth arguing about.',
            'The curve had two humps. One was module loading, the other was the database handshake, and they were almost exactly the same size.',
            'That second hump surprised everyone, because the connection pool was supposed to hide it.'
        ],
        heading: 'Measuring the right thing',
        id: 'measure'
    },
    {
        body: [
            'The function shipped 14 MB of JavaScript, most of it an SDK we called twice. Replacing it with two fetch calls took an afternoon and removed 11 MB.',
            'Tree shaking did the rest once we stopped importing from barrel files.'
        ],
        heading: 'Shrinking the bundle',
        id: 'bundle'
    },
    {
        body: [
            'A pool only helps if something is in it. After an idle period the platform froze the process, the sockets went stale, and the first query paid for a full TLS handshake plus a retry.',
            'We moved to an HTTP based driver that needs no socket at all. The handshake hump disappeared from the curve overnight.',
            'It cost us transactions across multiple statements, which we replaced with a single stored procedure for the one place that needed them.'
        ],
        heading: 'The connection pool lie',
        id: 'pool'
    },
    {
        body: [
            'Cold starts now sit at 380ms at the p99. Nobody notices them any more, which is the whole point.'
        ],
        heading: 'Where we landed',
        id: 'result'
    },
    {
        body: [
            'Keep the probe. It has already caught one regression, a logging library that grew by 3 MB in a minor release.',
            'And measure before you tune. Every one of our first guesses was wrong.'
        ],
        heading: 'What we would do next',
        id: 'next'
    }
];


function article(prefix: string, narrow: boolean) {
    let scroller: HTMLElement | undefined;

    return html`
        <div class='scroll-spine-demo ${narrow && 'scroll-spine-demo--narrow'}'>
            <div
                aria-label='Article'
                class='scroll-spine-demo-scroller'
                tabindex='0'
                ${{
                    onrender: (el: HTMLElement) => {
                        scroller = el;
                    }
                }}
            >
                <article class='scroll-spine-demo-article'>
                    <p class='scroll-spine-demo-meta'>Engineering · 6 min read</p>
                    <h2 class='scroll-spine-demo-title'>How we cut cold starts from 2.1s to 380ms</h2>
                    ${SECTIONS.map((section) => html`
                        <section>
                            <h3 class='scroll-spine-demo-heading' id='${`${prefix}-${section.id}`}'>${section.heading}</h3>
                            ${section.body.map((paragraph) => html`<p>${paragraph}</p>`)}
                        </section>
                    `)}
                </article>
            </div>
            <div class='scroll-spine-demo-aside'>
                <p class='scroll-spine-demo-caption'>On this page</p>
                ${scrollSpine({
                    height: 340,
                    items: SECTIONS.map((section) => ({ id: `${prefix}-${section.id}`, label: section.heading })),
                    target: () => scroller
                })}
            </div>
        </div>
    `;
}


export default {
    name: 'scroll-spine',
    variants: [
        {
            render: () => article('spine', false),
            title: 'article'
        },
        {
            render: () => article('spine-narrow', true),
            title: 'narrow (bands only, heading on hover or focus)'
        }
    ]
};
