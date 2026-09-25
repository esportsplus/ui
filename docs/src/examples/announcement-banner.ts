import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { announcementBanner } from '@esportsplus/ui';
import './announcement-banner.scss';


const STATS = [
    ['Requests', '1.2M'],
    ['Latency', '84 ms'],
    ['Errors', '0.02%']
];

const STORAGE_KEY = 'esportsplus-ui:announcement-dismissed';


function dismissed() {
    try {
        return sessionStorage.getItem(STORAGE_KEY) === '1';
    }
    catch {
        return false;
    }
}

function remember(value: boolean) {
    try {
        if (value) {
            sessionStorage.setItem(STORAGE_KEY, '1');
        }
        else {
            sessionStorage.removeItem(STORAGE_KEY);
        }
    }
    catch {
        // Private windows can refuse storage; the banner just won't remember.
    }
}


export default {
    name: 'announcement-banner',
    variants: [
        {
            render: () => {
                let frame: HTMLElement | undefined,
                    state = reactive({ open: false });

                return html`
                    <div
                        class='announcement-banner-demo'
                        ${{
                            onconnect: (element: HTMLElement) => {
                                frame = element;

                                // Opens a frame after mount, so the entrance is a real transition.
                                requestAnimationFrame(() => {
                                    state.open = !dismissed();
                                });
                            }
                        }}
                    >
                        ${announcementBanner(
                            {
                                icon: html`
                                    <svg viewBox='0 0 16 16'>
                                        <path d='M9 1.75 3.5 9h4l-.75 5.25L12.5 7h-4L9 1.75Z' />
                                    </svg>
                                `,
                                link: { href: '#changelog', label: 'See what changed' },
                                ondismiss: () => {
                                    let focused = frame?.querySelector('.announcement-banner-content')?.contains(document.activeElement);

                                    remember(true);

                                    // The dismiss button is going away; hand focus to the one way back.
                                    if (focused) {
                                        requestAnimationFrame(() => frame?.querySelector<HTMLElement>('.announcement-banner-demo-again')?.focus({ preventScroll: true }));
                                    }
                                },
                                state
                            },
                            'Deploys now build twice as fast.'
                        )}

                        <div class='announcement-banner-demo-nav'>
                            <span class='announcement-banner-demo-brand'>Northwind</span>
                            <span>Overview</span>
                            <span class='announcement-banner-demo-muted'>Deployments</span>
                            <span class='announcement-banner-demo-muted'>Settings</span>
                            <span aria-hidden='true' class='announcement-banner-demo-avatar'></span>
                        </div>
                        <div class='announcement-banner-demo-body'>
                            <h3 class='announcement-banner-demo-heading'>Overview</h3>
                            <p class='announcement-banner-demo-muted'>Three deploys today, all healthy.</p>
                            <div class='announcement-banner-demo-stats'>
                                ${STATS.map(([name, value]) => html`
                                    <div class='announcement-banner-demo-stat'>
                                        <p class='announcement-banner-demo-muted'>${name}</p>
                                        <p class='announcement-banner-demo-value'>${value}</p>
                                    </div>
                                `)}
                            </div>
                        </div>

                        <button
                            class='announcement-banner-demo-again ${() => !state.open && '--active'}'
                            type='button'
                            ${{
                                inert: () => state.open,
                                onclick: () => {
                                    state.open = true;
                                    remember(false);
                                    requestAnimationFrame(() => frame?.querySelector<HTMLElement>('.announcement-banner-content')?.focus({ preventScroll: true }));
                                }
                            }}
                        >
                            Show again
                        </button>
                    </div>
                `;
            },
            title: 'dashboard'
        },
        {
            render: () => {
                let state = reactive({ open: true });

                return html`
                    <div class='announcement-banner-demo announcement-banner-demo--short'>
                        ${announcementBanner(
                            { class: 'announcement-banner--blue', label: 'Maintenance', state },
                            'Scheduled maintenance on Sunday from 02:00 to 03:00 UTC.'
                        )}
                        <button
                            class='announcement-banner-demo-again ${() => !state.open && '--active'}'
                            type='button'
                            ${{
                                inert: () => state.open,
                                onclick: () => {
                                    state.open = true;
                                }
                            }}
                        >
                            Show again
                        </button>
                    </div>
                `;
            },
            title: 'blue, no link'
        }
    ]
};
