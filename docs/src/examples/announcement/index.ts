import { flush, reactive } from '@esportsplus/reactivity';
import { html, type Renderable } from '@esportsplus/template';
import { announcement } from '@esportsplus/ui';
import './scss/index.scss';


const STATS = [
    ['Requests', '1.2M'],
    ['Latency', '84 ms'],
    ['Errors', '0.02%']
];

const STORAGE_KEY = 'esportsplus-ui:announcement-dismissed';


function again(state: { active: boolean }, onclick: () => void) {
    return html`
        <button
            class='announcement-demo-again ${() => !state.active && '--active'}'
            type='button'
            ${{ inert: () => state.active, onclick }}
        >
            Show again
        </button>
    `;
}

// The banner is only the animated container; the bar, its contents and the close button are the site's own.
function bar(modifier: string, content: Renderable<unknown>, ondismiss: () => void) {
    return html`
        <div class='announcement-demo-bar ${modifier}'>
            ${content}
            <button
                aria-label='Dismiss announcement'
                class='announcement-demo-close'
                type='button'
                onclick=${ondismiss}
            >
                <svg viewBox='0 0 16 16'>
                    <path d='m4.5 4.5 7 7M11.5 4.5l-7 7' />
                </svg>
            </button>
        </div>
    `;
}

function dismissed() {
    try {
        return sessionStorage.getItem(STORAGE_KEY) === '1';
    }
    catch {
        return false;
    }
}

// The state written just before lands first, so the target is no longer inert.
function focus(frame: HTMLElement | undefined, selector: string) {
    flush();
    frame?.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true });
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
    name: 'announcement',
    variants: [
        {
            render: () => {
                let frame: HTMLElement | undefined,
                    state = reactive({ active: false });

                return html`
                    <div
                        class='announcement-demo'
                        ${{
                            onconnect: (element: HTMLElement) => {
                                frame = element;
                            },
                            // Opens once it has painted closed, so the entrance is a real transition.
                            onfirstpaint: () => {
                                state.active = !dismissed();
                            }
                        }}
                    >
                        ${announcement({ 'aria-label': 'Announcement', role: 'region', state }, bar(
                            '',
                            html`
                                <svg aria-hidden='true' class='announcement-demo-icon' viewBox='0 0 16 16'>
                                    <path d='M9 1.75 3.5 9h4l-.75 5.25L12.5 7h-4L9 1.75Z' />
                                </svg>
                                <p class='announcement-demo-text'>Deploys now build twice as fast.</p>
                                <a class='announcement-demo-link' href='#changelog'>See what changed</a>
                            `,
                            () => {
                                let focused = frame?.querySelector('.announcement')?.contains(document.activeElement);

                                state.active = false;
                                remember(true);

                                // The close button is going away; hand focus to the one way back.
                                if (focused) {
                                    focus(frame, '.announcement-demo-again');
                                }
                            }
                        ))}

                        <div class='announcement-demo-nav'>
                            <span class='announcement-demo-brand'>Northwind</span>
                            <span>Overview</span>
                            <span class='announcement-demo-muted'>Deployments</span>
                            <span class='announcement-demo-muted'>Settings</span>
                            <span aria-hidden='true' class='announcement-demo-avatar'></span>
                        </div>
                        <div class='announcement-demo-body'>
                            <h3 class='announcement-demo-heading'>Overview</h3>
                            <p class='announcement-demo-muted'>Three deploys today, all healthy.</p>
                            <div class='announcement-demo-stats'>
                                ${STATS.map(([name, value]) => html`
                                    <div class='announcement-demo-stat'>
                                        <p class='announcement-demo-muted'>${name}</p>
                                        <p class='announcement-demo-value'>${value}</p>
                                    </div>
                                `)}
                            </div>
                        </div>

                        ${again(state, () => {
                            state.active = true;
                            remember(false);
                            focus(frame, '.announcement-demo-close');
                        })}
                    </div>
                `;
            },
            title: 'dashboard'
        },
        {
            render: () => {
                let state = reactive({ active: true });

                return html`
                    <div class='announcement-demo announcement-demo--short'>
                        ${announcement({ 'aria-label': 'Maintenance', role: 'region', state }, bar(
                            'announcement-demo-bar--blue',
                            html`<p class='announcement-demo-text'>Scheduled maintenance on Sunday from 02:00 to 03:00 UTC.</p>`,
                            () => state.active = false
                        ))}
                        ${again(state, () => state.active = true)}
                    </div>
                `;
            },
            title: 'blue, no link'
        }
    ]
};
