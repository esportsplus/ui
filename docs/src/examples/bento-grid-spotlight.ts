import { html } from '@esportsplus/template';
import { bentoGridSpotlight } from '@esportsplus/ui';
import './bento-grid-spotlight.scss';


type Card = Parameters<typeof bentoGridSpotlight.card>[0];


const card = bentoGridSpotlight.card;


function icon(d: string) {
    return html`
        <svg fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24'>
            <path d='${d}' />
        </svg>
    `;
}

const ICONS = {
    bell: 'M10.268 21a2 2 0 0 0 3.464 0M22 8c0-2.3-.8-4.3-2-6M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326M4 2C2.8 3.7 2 5.7 2 8',
    bot: 'M12 8V4H8M6 8h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2ZM2 14h2M20 14h2M15 13v2M9 13v2',
    calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
    chart: 'M3 3v16a2 2 0 0 0 2 2h16M18 17V9M13 17V5M8 17v-3',
    cloud: 'M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z',
    globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20',
    music: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
    terminal: 'M7 11l2-2-2-2M11 13h4M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z',
    users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75'
};


function assistant() {
    return html`
        <div class='bento-grid-spotlight-demo-chat'>
            <div class='bento-grid-spotlight-demo-bubble bento-grid-spotlight-demo-bubble--user'>Can you center a div?</div>
            <div class='bento-grid-spotlight-demo-bubble bento-grid-spotlight-demo-bubble--bot'>
                ${icon(ICONS.bot)}
                <span class='bento-grid-spotlight-demo-typed'>
                    Yes! Use <code>flex items-center justify-center</code>
                </span>
                <span class='bento-grid-spotlight-demo-caret'></span>
            </div>
        </div>
    `;
}

function analytics() {
    let area = 'M 0,100 L 0,60 C 30,50 50,80 80,60 C 110,40 130,70 160,30 C 180,10 200,40 200,40 L 200,100 Z',
        line = 'M 0,60 C 30,50 50,80 80,60 C 110,40 130,70 160,30 C 180,10 200,40 200,40';

    return html`
        <div class='bento-grid-spotlight-demo-chart'>
            <div class='bento-grid-spotlight-demo-chart-grid'>
                ${Array.from({ length: 24 }, () => html`<span></span>`)}
            </div>
            <svg preserveAspectRatio='none' viewBox='0 0 200 100'>
                <defs>
                    <linearGradient id='bento-grid-spotlight-demo-area' x1='0' x2='0' y1='0' y2='1'>
                        <stop offset='0%' stop-color='currentColor' stop-opacity='0.2' />
                        <stop offset='100%' stop-color='currentColor' stop-opacity='0' />
                    </linearGradient>
                </defs>
                <path class='bento-grid-spotlight-demo-chart-area' d='${area}' fill='url(#bento-grid-spotlight-demo-area)' />
                <path class='bento-grid-spotlight-demo-chart-line' d='${line}' pathLength='1' />
                <circle class='bento-grid-spotlight-demo-chart-pulse' cx='160' cy='30' r='12' />
                <circle class='bento-grid-spotlight-demo-chart-dot' cx='160' cy='30' r='4' />
            </svg>
        </div>
    `;
}

function calendar() {
    return html`
        <div class='bento-grid-spotlight-demo-center'>
            <div class='bento-grid-spotlight-demo-schedule'>
                <div class='bento-grid-spotlight-demo-schedule-header'>
                    <span>Today</span>
                    <span class='bento-grid-spotlight-demo-schedule-date'>14 Oct</span>
                </div>
                <div class='bento-grid-spotlight-demo-schedule-body'>
                    ${['09:00', '10:00', '11:00', '12:00'].map((time) => html`
                        <div class='bento-grid-spotlight-demo-schedule-slot'>
                            <span>${time}</span>
                            <i></i>
                        </div>
                    `)}
                    <div class='bento-grid-spotlight-demo-event bento-grid-spotlight-demo-event--sync'>
                        <b>Design Sync</b>
                        <small>09:30 - 10:30</small>
                    </div>
                    <div class='bento-grid-spotlight-demo-event bento-grid-spotlight-demo-event--standup'>
                        <b>Standup</b>
                    </div>
                    <div class='bento-grid-spotlight-demo-now'></div>
                </div>
            </div>
        </div>
    `;
}

function music() {
    return html`
        <div class='bento-grid-spotlight-demo-center'>
            <div class='bento-grid-spotlight-demo-player'>
                <div class='bento-grid-spotlight-demo-disc'><span></span></div>
                <div class='bento-grid-spotlight-demo-track'>
                    <b>Midnight City</b>
                    <small>M83</small>
                </div>
                <div class='bento-grid-spotlight-demo-eq'>
                    ${[1, 2, 3, 4, 5].map((i) => html`<span style='${`--i: ${i}; --peak: ${i % 2 === 0 ? 20 : 12}px;`}'></span>`)}
                </div>
            </div>
        </div>
    `;
}

// Written out in full: SVG children can't be built as separate fragments outside their <svg>.
function network() {
    return html`
        <div class='bento-grid-spotlight-demo-network'>
            <div class='bento-grid-spotlight-demo-hub'>${icon('M13 2 3 14h9l-1 8 10-12h-9l1-8Z')}</div>
            <svg preserveAspectRatio='xMidYMid slice' viewBox='0 0 400 200'>
                <path class='bento-grid-spotlight-demo-link' d='M 50,50 L 200,100' />
                <path class='bento-grid-spotlight-demo-link' d='M 350,40 L 200,100' />
                <path class='bento-grid-spotlight-demo-link' d='M 80,180 L 200,100' />
                <path class='bento-grid-spotlight-demo-link' d='M 320,160 L 200,100' />
                <circle class='bento-grid-spotlight-demo-packet' r='3' style='--delay: 0s; --duration: 1.5s; --x: 50px; --y: 50px;' />
                <circle class='bento-grid-spotlight-demo-packet' r='3' style='--delay: 0.5s; --duration: 2s; --x: 350px; --y: 40px;' />
                <circle class='bento-grid-spotlight-demo-packet' r='3' style='--delay: 1s; --duration: 1.8s; --x: 80px; --y: 180px;' />
                <circle class='bento-grid-spotlight-demo-packet' r='3' style='--delay: 0.2s; --duration: 2.2s; --x: 320px; --y: 160px;' />
            </svg>
        </div>
    `;
}

function notifications() {
    return html`
        <div class='bento-grid-spotlight-demo-center'>
            <div class='bento-grid-spotlight-demo-stack'>
                ${[0, 1, 2].map((i) => html`
                    <div class='bento-grid-spotlight-demo-note' style='${`--i: ${i}`}'>
                        <span class='bento-grid-spotlight-demo-note-icon'>${icon(ICONS.bell)}</span>
                        <span class='bento-grid-spotlight-demo-note-lines'><i></i><i></i></span>
                    </div>
                `)}
            </div>
        </div>
    `;
}

function storage() {
    return html`
        <div class='bento-grid-spotlight-demo-storage'>
            <div class='bento-grid-spotlight-demo-cloud'>${icon(ICONS.cloud)}</div>
            ${[
                'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7ZM14 2v4a2 2 0 0 0 2 2h4',
                'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM9 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM21 15l-3.09-3.09a2 2 0 0 0-2.82 0L6 21',
                'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z'
            ].map((d, i) => html`<div class='bento-grid-spotlight-demo-flying bento-grid-spotlight-demo-flying--${i}'>${icon(d)}</div>`)}
        </div>
    `;
}

function team() {
    return html`
        <div class='bento-grid-spotlight-demo-canvas'>
            <div class='bento-grid-spotlight-demo-frame'><i></i></div>
            ${['Alice', 'Bob'].map((name, i) => html`
                <div class='bento-grid-spotlight-demo-cursor bento-grid-spotlight-demo-cursor--${i}'>
                    <svg viewBox='0 0 24 24'>
                        <path d='M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z' />
                    </svg>
                    <span>${name}</span>
                </div>
            `)}
        </div>
    `;
}

function terminal() {
    return html`
        <div class='bento-grid-spotlight-demo-center'>
            <div class='bento-grid-spotlight-demo-terminal'>
                <div class='bento-grid-spotlight-demo-terminal-bar'>
                    <span></span><span></span><span></span>
                    <em>bash</em>
                </div>
                <div class='bento-grid-spotlight-demo-terminal-body'>
                    <p>user@macbook:~$ <b>npm run build</b></p>
                    <p class='--line' style='--i: 0'><span class='bento-grid-spotlight-demo-spinner'>⠋</span> Building premium components...</p>
                    <p class='--line --muted' style='--i: 1'>[1/3] Resolving dependencies...</p>
                    <p class='--line --muted' style='--i: 2'>[2/3] Compiling styles...</p>
                    <p class='--line' style='--i: 3'>✔ <b>Build completed in 1.2s</b></p>
                </div>
            </div>
        </div>
    `;
}

function cards(extra: Partial<Card> = {}) {
    return [
        card({ ...extra, columns: 2, description: 'Chat with an assistant that writes code for you.', icon: icon(ICONS.bot), title: 'AI Assistant' }, assistant()),
        card({ ...extra, description: 'Track growth with real-time charts.', icon: icon(ICONS.chart), title: 'Analytics' }, analytics()),
        card({ ...extra, description: 'Listen to your favorite tracks.', icon: icon(ICONS.music), title: 'Music Player' }, music()),
        card({ ...extra, description: 'Stay on top of everything that matters.', icon: icon(ICONS.bell), title: 'Notifications' }, notifications()),
        card({ ...extra, columns: 2, description: 'Run builds and scripts from anywhere.', icon: icon(ICONS.terminal), title: 'Terminal' }, terminal()),
        card({ ...extra, description: 'Collaborate live with your teammates.', icon: icon(ICONS.users), title: 'Team' }, team()),
        card({ ...extra, description: 'Sync files across every device.', icon: icon(ICONS.cloud), title: 'Storage' }, storage()),
        card({ ...extra, description: 'Deployed on edge nodes worldwide.', icon: icon(ICONS.globe), title: 'Global Network' }, network()),
        card({ ...extra, columns: 2, description: 'Schedule and manage your events.', icon: icon(ICONS.calendar), title: 'Calendar' }, calendar())
    ];
}


export default {
    name: 'bento-grid-spotlight',
    variants: [
        {
            render: () => html`<div class='bento-grid-spotlight-demo'>${bentoGridSpotlight(cards())}</div>`,
            title: 'features'
        },
        {
            render: () => html`<div class='bento-grid-spotlight-demo'>${bentoGridSpotlight(cards({ tilt: true }))}</div>`,
            title: 'tilt'
        },
        {
            render: () => html`
                <div class='bento-grid-spotlight-demo'>
                    ${bentoGridSpotlight([
                        card({ beam: false, columns: 2, description: 'Spotlight only, no border beam.', icon: icon(ICONS.chart), rows: 2, title: 'Tall and wide' }),
                        card({ description: 'Border beam only.', icon: icon(ICONS.globe), spotlight: false, title: 'Beam' }),
                        card({ beam: false, description: 'Neither effect.', icon: icon(ICONS.cloud), spotlight: false, title: 'Plain' }),
                        card({ columns: 2, description: 'Both effects, spanning two columns.', icon: icon(ICONS.music), title: 'Both' })
                    ])}
                </div>
            `,
            title: 'effects and spans'
        }
    ]
};
