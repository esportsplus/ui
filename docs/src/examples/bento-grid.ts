import { html } from '@esportsplus/template';
import { bentoGrid } from '@esportsplus/ui';
import './bento-grid.scss';


let files = [
    { body: 'Bitcoin is a cryptocurrency invented in 2008 by an unknown person or group of people using the name Satoshi Nakamoto.', name: 'bitcoin.pdf' },
    { body: 'A spreadsheet or worksheet is a file made of rows and columns that help sort data, arrange data easily, and calculate numerical data.', name: 'finances.xlsx' },
    { body: 'Scalable Vector Graphics is an Extensible Markup Language-based vector image format for two-dimensional graphics with support for interactivity and animation.', name: 'logo.svg' },
    { body: 'GPG keys are used to encrypt and decrypt email, files, directories, and whole disk partitions and to authenticate messages.', name: 'keys.gpg' },
    { body: 'A seed phrase, seed recovery phrase or backup seed phrase is a list of words which store all the information needed to recover Bitcoin funds on-chain.', name: 'seed.txt' }
];

let notifications = [
    { color: '#00c9a7', description: 'Magic UI', icon: '💸', name: 'Payment received', time: '15m ago' },
    { color: '#ffb800', description: 'Magic UI', icon: '👤', name: 'User signed up', time: '10m ago' },
    { color: '#ff3d71', description: 'Magic UI', icon: '💬', name: 'New message', time: '5m ago' },
    { color: '#1e86ff', description: 'Magic UI', icon: '🗞️', name: 'New event', time: '2m ago' }
];


// Factories, since a rendered fragment can only be mounted in one place.
const icons = {
    bell: () => html`
        <svg fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 24 24'>
            <path d='M10.268 21a2 2 0 0 0 3.464 0M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326' />
        </svg>
    `,
    calendar: () => html`
        <svg fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 24 24'>
            <rect height='18' rx='2' width='18' x='3' y='4' />
            <path d='M16 2v4M8 2v4M3 10h18' />
        </svg>
    `,
    file: () => html`
        <svg fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 24 24'>
            <path d='M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z' />
            <path d='M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8' />
        </svg>
    `,
    share: () => html`
        <svg fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 24 24'>
            <circle cx='18' cy='5' r='3' />
            <circle cx='6' cy='12' r='3' />
            <circle cx='18' cy='19' r='3' />
            <path d='m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98' />
        </svg>
    `
};


function calendar() {
    // May 2022 starts on a Sunday.
    let days = Array.from({ length: 31 }, (_, i) => i + 1);

    return html`
        <div class='bento-grid-demo-calendar'>
            <div class='bento-grid-demo-calendar-title'>May 2022</div>
            <div class='bento-grid-demo-calendar-grid'>
                ${['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => html`<span class='bento-grid-demo-calendar-weekday'>${day}</span>`)}
                ${days.map((day) => html`<span class='bento-grid-demo-calendar-day ${day === 11 && '--active'}'>${day}</span>`)}
            </div>
        </div>
    `;
}

// Written out in full: SVG children can't be built as separate fragments outside their <svg>.
function integrations() {
    return html`
        <svg class='bento-grid-demo-beams' viewBox='0 0 400 240'>
            <path class='bento-grid-demo-beam-line' d='M60 40 Q 200 40 200 120' />
            <path class='bento-grid-demo-beam-light' d='M60 40 Q 200 40 200 120' style='animation-delay: -0.0s' />
            <path class='bento-grid-demo-beam-line' d='M60 120 Q 200 120 200 120' />
            <path class='bento-grid-demo-beam-light' d='M60 120 Q 200 120 200 120' style='animation-delay: -0.6s' />
            <path class='bento-grid-demo-beam-line' d='M60 200 Q 200 200 200 120' />
            <path class='bento-grid-demo-beam-light' d='M60 200 Q 200 200 200 120' style='animation-delay: -1.2s' />
            <path class='bento-grid-demo-beam-line' d='M340 60 Q 200 60 200 120' />
            <path class='bento-grid-demo-beam-light' d='M340 60 Q 200 60 200 120' style='animation-delay: -1.8s' />
            <path class='bento-grid-demo-beam-line' d='M340 180 Q 200 180 200 120' />
            <path class='bento-grid-demo-beam-light' d='M340 180 Q 200 180 200 120' style='animation-delay: -2.4s' />
            <circle class='bento-grid-demo-beam-node' cx='60' cy='40' r='18' />
            <circle class='bento-grid-demo-beam-node' cx='60' cy='120' r='18' />
            <circle class='bento-grid-demo-beam-node' cx='60' cy='200' r='18' />
            <circle class='bento-grid-demo-beam-node' cx='340' cy='60' r='18' />
            <circle class='bento-grid-demo-beam-node' cx='340' cy='180' r='18' />
            <circle class='bento-grid-demo-beam-hub' cx='200' cy='120' r='26' />
        </svg>
    `;
}

function marquee() {
    let figure = (file: typeof files[number]) => html`
        <figure class='bento-grid-demo-file'>
            <figcaption>${file.name}</figcaption>
            <blockquote>${file.body}</blockquote>
        </figure>
    `;

    return html`
        <div class='bento-grid-demo-marquee'>
            <div class='bento-grid-demo-marquee-track'>
                ${files.map(figure)}
                ${files.map(figure)}
            </div>
        </div>
    `;
}

function notificationList() {
    return html`
        <div class='bento-grid-demo-notifications'>
            ${notifications.map((item, i) => html`
                <figure class='bento-grid-demo-notification' style='${`--i: ${i}`}'>
                    <span class='bento-grid-demo-notification-icon' style='${`background: ${item.color}`}'>${item.icon}</span>
                    <div>
                        <figcaption>
                            <span>${item.name}</span>
                            <span class='bento-grid-demo-notification-time'>· ${item.time}</span>
                        </figcaption>
                        <p>${item.description}</p>
                    </div>
                </figure>
            `)}
        </div>
    `;
}

function features() {
    return [
        bentoGrid.card({
            background: marquee(),
            description: 'We automatically save your files as you type.',
            icon: icons.file(),
            name: 'Save your files',
            span: 1
        }),
        bentoGrid.card({
            background: notificationList(),
            description: 'Get notified when something happens.',
            icon: icons.bell(),
            name: 'Notifications',
            span: 2
        }),
        bentoGrid.card({
            background: integrations(),
            description: 'Supports 100+ integrations and counting.',
            icon: icons.share(),
            name: 'Integrations',
            span: 2
        }),
        bentoGrid.card({
            background: calendar(),
            description: 'Use the calendar to filter your files by date.',
            icon: icons.calendar(),
            name: 'Calendar',
            span: 1
        })
    ];
}


export default {
    name: 'bento-grid',
    variants: [
        {
            render: () => html`<div class='bento-grid-demo'>${bentoGrid(features())}</div>`,
            title: 'features'
        },
        {
            render: () => html`
                <div class='bento-grid-demo'>
                    ${bentoGrid({ style: '--row-height: 14rem' }, [
                        bentoGrid.card({ cta: 'Open', description: 'Plain cards with no background art.', href: '#bento-grid', name: 'Minimal', span: 1 }),
                        bentoGrid.card({ cta: 'Open', description: 'Spans two of the three columns once there is room.', href: '#bento-grid', name: 'Wide', span: 2 }),
                        bentoGrid.card({ cta: 'Open', description: 'Every card takes the full width in a narrow column.', href: '#bento-grid', name: 'Full row', span: 3 })
                    ])}
                </div>
            `,
            title: 'text only, custom row height'
        }
    ]
};
