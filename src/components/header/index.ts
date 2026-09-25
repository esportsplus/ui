import { reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import accordion from '~/components/accordion';
import './scss/index.scss';


type A = Attributes & {
    brand?: Option;
    onconnect?: never;
    ondisconnect?: never;
    options: Item[];
    state?: { active: boolean, open: number | null };
};

// Items and links render twice (desktop nav and mobile drawer): pass node content as an
// effect, `() => html`...``, so each placement gets its own nodes.
type Item = Option & { onclick?: never, sections?: Section[] };

type Link = Option & { description?: Renderable<unknown>, icon?: Renderable<unknown>, onclick?: never };

type Option = Attributes & { content: Renderable<unknown> };

type Section = { columns?: number, content?: Renderable<unknown>, links?: Link[], title?: Renderable<unknown> };


const THRESHOLD = 50;


function brandmark({ content, ...attributes }: Option) {
    return html`
        <a class='header-brand' ${attributes}>
            ${content}
        </a>
    `;
}

function chevron() {
    return html`
        <svg class='header-chevron' aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2.5' viewBox='0 0 24 24'>
            <path d='m6 9 6 6 6-6' />
        </svg>
    `;
}

function link({ content, description, icon, ...attributes }: Link, close: VoidFunction) {
    return html`
        <a class='header-link ${description ? 'header-link--rich' : ''}' ${attributes} ${{ onclick: close }}>
            ${icon ? html`<span class='header-link-icon' aria-hidden='true'>${icon}</span>` : ''}

            <span class='header-link-body'>
                <span class='header-link-title'>${content}</span>
                ${description ? html`<span class='header-link-description'>${description}</span>` : ''}
            </span>
        </a>
    `;
}

// Sticky pins to the nearest scrolling ancestor, so that's the scroll that should frost the bar.
function scroller(element: HTMLElement) {
    for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        let overflow = getComputedStyle(parent).overflowY;

        if (overflow === 'auto' || overflow === 'scroll') {
            return parent;
        }
    }

    return null;
}


export default component<A>(
    function({ brand, options, state = reactive({ active: false, open: null as number | null }), ...attributes }, content) {
        let close = () => {
                hovered = false;
                state.active = false;
                state.open = null;
            },
            hovered = false,
            local = reactive({ height: 0, scrolled: false }),
            open = (trigger: HTMLElement, index: number) => {
                local.height = trigger.closest('.header')?.querySelector<HTMLElement>(`.header-panel[data-index='${index}']`)?.offsetHeight ?? 0;
                state.open = index;
            },
            stop: VoidFunction | undefined;

        return html`
            <header
                class='header'
                ${attributes}
                ${{
                    class: [
                        () => state.active && '--active',
                        () => state.open !== null && '--open',
                        () => local.scrolled && '--scrolled'
                    ],
                    ondocumentclick: function(this, event) {
                        if (state.open === null || !this?.isConnected) {
                            return;
                        }

                        if (!this.contains(event.target as Node | null)) {
                            close();
                        }
                    },
                    ondocumentkeydown: (event) => {
                        if (event.key === 'Escape') {
                            close();
                        }
                    },
                    onconnect: (element: HTMLElement) => {
                        let target = scroller(element),
                            host = target ?? window,
                            listener = { capture: !target, passive: true },
                            update = () => {
                                local.scrolled = (
                                    target
                                        ? target.scrollTop
                                        : Math.max(document.body.scrollTop, document.documentElement.scrollTop)
                                ) > THRESHOLD;
                            };

                        // Page-level scroll lands on the viewport or, when root styles size it to the
                        // viewport, on body; body's scroll doesn't reach window unless captured.
                        host.addEventListener('scroll', update, listener);
                        stop = () => host.removeEventListener('scroll', update, listener);
                        update();
                    },
                    ondisconnect: () => {
                        stop?.();
                    }
                }}
            >
                <div
                    class='header-bar'
                    ${{
                        onmouseleave: () => {
                            if (hovered) {
                                close();
                            }
                        },
                        style: () => `--viewport-height: ${local.height}px`
                    }}
                >
                    <div class='header-container'>
                        <div class='header-row'>
                            <div class='header-rule' aria-hidden='true'></div>
                            <div class='header-start'>
                                ${brand ? brandmark({ 'aria-label': 'home', href: '/', ...brand }) : ''}

                                <nav class='header-nav' aria-label='Primary'>
                                    <ul class='header-nav-list'>
                                        ${options.map(({ content, sections, ...option }, index) => {
                                            if (!sections) {
                                                return html`
                                                    <li>
                                                        <a
                                                            class='header-trigger'
                                                            ${option}
                                                            ${{
                                                                onclick: close,
                                                                onpointerover: (event: PointerEvent) => {
                                                                    if (event.pointerType === 'mouse' && hovered) {
                                                                        state.open = null;
                                                                    }
                                                                }
                                                            }}
                                                        >
                                                            ${content}
                                                        </a>
                                                    </li>
                                                `;
                                            }

                                            return html`
                                                <li>
                                                    <button
                                                        class='header-trigger'
                                                        type='button'
                                                        ${option}
                                                        ${{
                                                            'aria-expanded': () => String(state.open === index),
                                                            class: () => state.open === index && '--active',
                                                            onclick: function(this: HTMLElement) {
                                                                // A click landing on a hover-opened panel pins it rather than closing it.
                                                                if (hovered && state.open === index) {
                                                                    hovered = false;
                                                                }
                                                                else if (state.open === index) {
                                                                    state.open = null;
                                                                }
                                                                else {
                                                                    hovered = false;
                                                                    open(this, index);
                                                                }
                                                            },
                                                            onpointerover: function(this: HTMLElement, event: PointerEvent) {
                                                                if (event.pointerType !== 'mouse' || state.open === index) {
                                                                    return;
                                                                }

                                                                hovered = true;
                                                                open(this, index);
                                                            }
                                                        }}
                                                    >
                                                        ${content}
                                                        ${chevron()}
                                                    </button>
                                                </li>
                                            `;
                                        })}
                                    </ul>
                                </nav>

                                <button
                                    class='header-toggle'
                                    type='button'
                                    ${{
                                        'aria-expanded': () => String(state.active),
                                        'aria-label': () => state.active ? 'Close menu' : 'Open menu',
                                        onclick: () => {
                                            state.active = !state.active;
                                        }
                                    }}
                                >
                                    <svg class='header-toggle-icon header-toggle-icon--open' aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24'>
                                        <path d='M4 6h16M4 12h16M4 18h16' />
                                    </svg>
                                    <svg class='header-toggle-icon header-toggle-icon--close' aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24'>
                                        <path d='M18 6 6 18M6 6l12 12' />
                                    </svg>
                                </button>
                            </div>

                            <nav class='header-drawer' aria-label='Primary' ${{ inert: () => !state.active }}>
                                ${options.map(({ content, sections, ...option }) => {
                                    if (!sections) {
                                        return html`
                                            <a class='header-drawer-link' ${option} ${{ onclick: close }}>
                                                ${content}
                                            </a>
                                        `;
                                    }

                                    let group = reactive({ active: false });

                                    return html`
                                        <div class='header-drawer-group' ${{ class: () => group.active && '--active' }}>
                                            <button
                                                class='header-drawer-trigger'
                                                type='button'
                                                ${{
                                                    'aria-expanded': () => String(group.active),
                                                    onclick: () => {
                                                        group.active = !group.active;
                                                    }
                                                }}
                                            >
                                                ${content}
                                                ${chevron()}
                                            </button>

                                            ${accordion({ state: group }, html`
                                                <ul class='header-drawer-links'>
                                                    ${sections.flatMap((section) => section.links ?? []).map((l) => html`
                                                        <li>${link({ ...l, description: undefined }, close)}</li>
                                                    `)}
                                                </ul>
                                            `)}
                                        </div>
                                    `;
                                })}
                            </nav>

                            <div class='header-actions'>
                                ${content}
                            </div>
                        </div>

                        <div class='header-viewport'>
                            ${options.map(({ sections }, index) => sections ? html`
                                <div
                                    class='header-panel'
                                    data-index='${index}'
                                    ${{
                                        class: () => {
                                            if (state.open === null) {
                                                return;
                                            }

                                            return state.open === index ? '--active' : (index < state.open ? '--before' : '--after');
                                        },
                                        inert: () => state.open !== index
                                    }}
                                >
                                    ${sections.map((section) => html`
                                        <div class='header-section' style='--columns: ${section.columns ?? 1}'>
                                            ${section.title ? html`<span class='header-section-title'>${section.title}</span>` : ''}

                                            ${section.links ? html`
                                                <ul class='header-section-links'>
                                                    ${section.links.map((l) => html`<li>${link(l, close)}</li>`)}
                                                </ul>
                                            ` : ''}

                                            ${section.content ?? ''}
                                        </div>
                                    `)}
                                </div>
                            ` : '')}
                        </div>
                    </div>
                </div>
            </header>
        `;
    }
);
