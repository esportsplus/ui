import { effect, onCleanup, reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { pageDots } from '@esportsplus/ui';
import './page-dots.scss';


type Page = {
    note: string;
    title: string;
};


// Long enough to read a card's two lines, short enough to feel alive.
const INTERVAL = 3000;

const PAGES: Page[] = [
    { note: 'Everything triaged before lunch.', title: 'Inbox zero' },
    { note: 'Two quiet hours blocked every morning.', title: 'Focus time' },
    { note: 'Friday at four, fifteen minutes.', title: 'Weekly review' },
    { note: 'Groceries, synced with Sam.', title: 'Shared lists' },
    { note: 'Works on the train, syncs later.', title: 'Offline mode' }
];

// A scroll counts as over once no scroll event has arrived for this long, which also covers the momentum after a flick.
const SCROLL_QUIET = 200;


function carousel(autoplay: boolean) {
    let busy = false,
        demo = reactive({
            // null until the viewer picks, so reduced motion can default to paused.
            choice: null as boolean | null,
            focused: false,
            hovered: false,
            scrolling: false,
            visible: !document.hidden
        }),
        frame = 0,
        quiet: ReturnType<typeof setTimeout> | undefined,
        reduced = matchMedia('(prefers-reduced-motion: reduce)').matches,
        region: HTMLElement | undefined,
        scroller: HTMLElement | undefined,
        state = reactive({ active: 0, progress: 0, running: false }),
        toggle: HTMLElement | undefined,
        touching = false;

    onCleanup(effect(() => {
        let playing = demo.choice ?? !reduced;

        state.running = autoplay && playing && !demo.hovered && !demo.focused && !demo.scrolling && demo.visible;
    }));

    function goTo(index: number) {
        if (!scroller) {
            return;
        }

        scroller.scrollTo({
            behavior: reduced ? 'auto' : 'smooth',
            left: (index / (PAGES.length - 1)) * (scroller.scrollWidth - scroller.clientWidth)
        });
    }

    function inside(node: EventTarget | null) {
        return node instanceof Node && !!region?.contains(node) && !toggle?.contains(node);
    }

    function read() {
        frame = 0;

        if (!scroller) {
            return;
        }

        let max = scroller.scrollWidth - scroller.clientWidth;

        state.progress = max > 0 ? (scroller.scrollLeft / max) * (PAGES.length - 1) : 0;
    }

    function settleSoon() {
        clearTimeout(quiet);
        quiet = setTimeout(() => {
            if (touching) {
                return;
            }

            busy = false;
            demo.scrolling = false;
        }, SCROLL_QUIET);
    }

    // Only wheel and touch mark a scroll as the viewer's, so autoplay's own smooth scrolls never pause autoplay.
    function start() {
        busy = true;
        demo.scrolling = true;
    }

    return html`
        <div
            class='page-dots-demo'
            ${{
                ondisconnect: () => {
                    cancelAnimationFrame(frame);
                    clearTimeout(quiet);
                },
                ondocumentvisibilitychange: () => {
                    demo.visible = !document.hidden;
                },
                onfocusin: (e: FocusEvent) => {
                    // Only keyboard focus pauses; a mouse click on a dot leaves focus behind that would otherwise hold autoplay forever.
                    if (inside(e.target) && (e.target as Element).matches(':focus-visible')) {
                        demo.focused = true;
                    }
                },
                onfocusout: (e: FocusEvent) => {
                    if (!inside(e.relatedTarget)) {
                        demo.focused = false;
                    }
                },
                onpointerleave: () => {
                    demo.hovered = false;
                },
                // The toggle is left out on purpose: hovering it to press play must not be what keeps autoplay paused.
                onpointerover: (e: PointerEvent) => {
                    if (e.pointerType !== 'touch') {
                        demo.hovered = inside(e.target);
                    }
                },
                onrender: (el: HTMLElement) => {
                    region = el;
                }
            }}
        >
            <div
                aria-label='Features'
                aria-live='${() => state.running ? 'off' : 'polite'}'
                aria-roledescription='carousel'
                class='page-dots-demo-scroller'
                role='region'
                tabindex='0'
                ${{
                    onrender: (el: HTMLElement) => {
                        scroller = el;
                    },
                    onscroll: () => {
                        if (!frame) {
                            frame = requestAnimationFrame(read);
                        }

                        if (busy) {
                            settleSoon();
                        }
                    },
                    ontouchcancel: () => {
                        touching = false;
                        settleSoon();
                    },
                    ontouchend: () => {
                        touching = false;
                        settleSoon();
                    },
                    ontouchstart: () => {
                        touching = true;
                        clearTimeout(quiet);
                        start();
                    },
                    onwheel: () => {
                        start();
                        settleSoon();
                    }
                }}
            >
                ${PAGES.map((page, i) => html`
                    <div
                        aria-label='${`${i + 1} of ${PAGES.length}`}'
                        aria-roledescription='slide'
                        class='page-dots-demo-card'
                        role='group'
                    >
                        <p class='page-dots-demo-number'>${String(i + 1).padStart(2, '0')}</p>
                        <p class='page-dots-demo-title'>${page.title}</p>
                        <p class='page-dots-demo-note'>${page.note}</p>
                    </div>
                `)}
            </div>
            <div class='page-dots-demo-controls'>
                <span aria-hidden='true' class='page-dots-demo-spacer'></span>
                ${pageDots({
                    autoplay: autoplay ? INTERVAL : undefined,
                    count: PAGES.length,
                    // Past the last page it scrolls back to the first rather than jumping, so the loop reads as a deliberate rewind.
                    onelapsed: (active: number) => goTo((active + 1) % PAGES.length),
                    onpage: goTo,
                    state
                })}
                ${autoplay
                    ? html`
                        <button
                            aria-label='Pause autoplay'
                            aria-pressed='${() => String(!(demo.choice ?? !reduced))}'
                            class='page-dots-demo-toggle ${() => (demo.choice ?? !reduced) && '--active'}'
                            type='button'
                            ${{
                                onclick: () => {
                                    demo.choice = !(demo.choice ?? !reduced);
                                },
                                onrender: (el: HTMLElement) => {
                                    toggle = el;
                                }
                            }}
                        >
                            <svg aria-hidden='true' class='page-dots-demo-icon page-dots-demo-icon--pause' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 16 16'>
                                <path d='M5.75 3.75v8.5M10.25 3.75v8.5' />
                            </svg>
                            <svg aria-hidden='true' class='page-dots-demo-icon page-dots-demo-icon--play' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 16 16'>
                                <path d='M5 3.9v8.2a.6.6 0 0 0 .9.5l6.6-4.1a.6.6 0 0 0 0-1L5.9 3.4a.6.6 0 0 0-.9.5Z' />
                            </svg>
                        </button>
                    `
                    : html`<span aria-hidden='true' class='page-dots-demo-spacer'></span>`}
            </div>
        </div>
    `;
}


export default {
    name: 'page-dots',
    variants: [
        {
            render: () => carousel(true),
            title: 'autoplay carousel'
        },
        {
            render: () => carousel(false),
            title: 'scroll-linked'
        },
        {
            render: () => {
                let frame = 0,
                    state = reactive({ active: 0, progress: 0, running: false });

                // Without a scroller to follow, the demo tweens 'progress' itself so the pill still crawls between pages.
                function select(index: number) {
                    let from = state.progress,
                        start = performance.now();

                    cancelAnimationFrame(frame);

                    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
                        state.progress = index;
                        return;
                    }

                    function step(now: number) {
                        let t = Math.min((now - start) / (240 + 120 * Math.abs(index - from)), 1);

                        state.progress = from + (index - from) * (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

                        if (t < 1) {
                            frame = requestAnimationFrame(step);
                        }
                    }

                    frame = requestAnimationFrame(step);
                }

                return html`
                    <div class='page-dots-demo-row'>
                        ${pageDots({
                            class: 'page-dots--large',
                            count: 7,
                            onpage: select,
                            state
                        })}
                        <span class='page-dots-demo-caption'>${() => `Page ${state.active + 1} of 7`}</span>
                    </div>
                `;
            },
            title: 'large (click to jump)'
        }
    ]
};
