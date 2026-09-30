import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import { effect, reactive } from '@esportsplus/reactivity';
import { reduced } from '~/lib/animation';
import './scss/index.scss';


type A = Attributes & {
    [PULL_TO_REFRESH_SCROLLER]?: Attributes;
    // Screen reader message once a refresh lands, given how many items arrived above the old first one.
    announce?: (count: number) => string;
    // Runs once per refresh; the indicator spins until the returned promise settles.
    onrefresh: () => unknown;
    state?: State;
};

type Motion = 'instant' | 'landing' | null;

type Press = {
    pulling: boolean;
    y: number;
};

type State = {
    // Set to true to refresh from elsewhere (a button, a shortcut); reads true while a refresh runs.
    refreshing: boolean;
};


// Past this many px a mouse press becomes a pull rather than a click.
const DRAG_SLOP = 4;

const PULL_TO_REFRESH_SCROLLER = Symbol.for('@esportsplus/ui/pull-to-refresh.scroller');

// Looser than Apple's 0.55 scroll edge, so reaching the threshold takes a comfortable ~110px of hand travel rather than ~150px.
const RUBBER = 0.7;

// Roughly the screen height; the band stiffens relative to it.
const RUBBER_DIMENSION = 480;

// Pulled this far (after resistance), letting go refreshes.
const THRESHOLD = 64;


function announcement(count: number) {
    return `Updated, ${count} new item${count === 1 ? '' : 's'}`;
}

// Apple's rubber band: follows 1:1 at first, then gives less and less.
function rubberband(distance: number) {
    return (distance * RUBBER_DIMENSION * RUBBER) / (RUBBER_DIMENSION + RUBBER * distance);
}

// Where the hand would have to be for the band to show this offset, so a pull caught mid-spring continues from exactly where it is.
function unband(offset: number) {
    return (offset * RUBBER_DIMENSION) / (RUBBER * (RUBBER_DIMENSION - offset));
}


export default component(
    function(
        this: { attributes?: Partial<A> },
        { announce = announcement, onrefresh, state = reactive({ refreshing: false }), ...attributes }: A,
        content: Renderable<unknown>
    ) {
        let base = 0,
            busy = false,
            feed: HTMLElement | undefined,
            listeners: AbortController | undefined,
            press: Press | null = null,
            root: HTMLElement | undefined,
            scroller: HTMLElement | undefined,
            view = reactive({ status: '' }),
            y = 0;

        // One code path for touch and mouse, so both look alike.
        function begin() {
            base = unband(Math.max(position(), 0));
            motion('instant');
        }

        function end() {
            if (y >= THRESHOLD) {
                refresh();
            }
            else {
                motion(null);
                write(0);
            }
        }

        // New items land above the ones on screen. Shifting the feed up by their height keeps everything visually still,
        // then the feed springs down from the threshold, which slides the items in from the top and retracts the indicator
        // in one motion.
        function land(first: Element | null) {
            let count = 0,
                height = 0;

            if (first?.isConnected && feed && first.parentElement === feed) {
                let head = feed.firstElementChild as HTMLElement;

                height = (first as HTMLElement).offsetTop - head.offsetTop;

                for (let node: Element | null = head; node && node !== first; node = node.nextElementSibling) {
                    count++;
                    node.classList.add('--fresh');
                }
            }

            busy = false;
            state.refreshing = false;
            view.status = announce(count);

            let offset = position() - height;

            motion('instant');
            write(offset);
            // Commits the shifted offset, so the slide in starts from it rather than from the threshold.
            position();
            motion('landing');
            write(0);
        }

        // Set on the element directly: the template applies class changes a frame late, and a transition has to switch now.
        function motion(value: Motion) {
            if (value) {
                root?.setAttribute('data-motion', value);
            }
            else {
                root?.removeAttribute('data-motion');
            }
        }

        // Where the feed is on screen, partway through a transition included.
        function position() {
            return root ? parseFloat(getComputedStyle(root).getPropertyValue('--pull-to-refresh-y')) || 0 : 0;
        }

        function pull(distance: number) {
            let offset = rubberband(Math.max(base + distance, 0));

            root?.style.setProperty('--reveal', String(Math.min(offset / THRESHOLD, 1)));
            write(offset);
        }

        // Only from the very top, and never while a refresh or the slide in is still running.
        function ready() {
            return !busy && !!scroller && scroller.scrollTop <= 0 && position() >= 0;
        }

        function refresh() {
            let first = feed?.firstElementChild ?? null;

            busy = true;
            state.refreshing = true;
            root?.style.setProperty('--reveal', '1');
            view.status = '';
            motion(null);
            write(THRESHOLD);

            // Array slots render on the next frame, so measure after the caller's update has reached the DOM.
            void Promise.resolve()
                .then(onrefresh)
                .finally(() => requestAnimationFrame(() => land(first)));
        }

        function release() {
            if (press?.pulling) {
                end();
            }

            press = null;
        }

        function touchmove(e: TouchEvent) {
            if (!press || !scroller) {
                return;
            }

            let dy = e.touches[0].clientY - press.y;

            if (!press.pulling) {
                // Scrolling up the feed is a normal scroll; leave it alone.
                if (dy < 0 || scroller.scrollTop > 0) {
                    press = null;
                    return;
                }

                if (dy === 0) {
                    return;
                }

                press.pulling = true;
                begin();
            }

            e.preventDefault();
            pull(dy);
        }

        function touchstart(e: TouchEvent) {
            press = e.touches.length === 1 && ready() ? { pulling: false, y: e.touches[0].clientY } : null;
        }

        function write(value: number) {
            y = value;
            root?.style.setProperty('--pull-to-refresh-y', String(value));
        }

        effect(() => {
            if (!state.refreshing || busy) {
                return;
            }

            scroller?.scrollTo({
                behavior: reduced() ? 'auto' : 'smooth',
                top: 0
            });
            refresh();
        });

        return html`
            <div
                class='pull-to-refresh ${() => state.refreshing && '--refreshing'}'
                style='--threshold: ${THRESHOLD};'
                ${this?.attributes}
                ${attributes}
                ${{
                    onconnect: (el: HTMLElement) => {
                        root = el;

                        if (!scroller) {
                            return;
                        }

                        listeners = new AbortController();

                        let signal = listeners.signal;

                        // Attached by hand because the pull has to cancel the browser's own scroll, which the template's
                        // passive touch listeners can't do.
                        scroller.addEventListener('touchcancel', release, { signal });
                        scroller.addEventListener('touchend', release, { signal });
                        scroller.addEventListener('touchmove', touchmove, { passive: false, signal });
                        scroller.addEventListener('touchstart', touchstart, { passive: true, signal });
                    },
                    ondisconnect: () => {
                        listeners?.abort();
                    }
                }}
            >
                <div aria-hidden='true' class='pull-to-refresh-indicator'>
                    <div class='pull-to-refresh-glyph'>
                        <svg
                            class='pull-to-refresh-spinner'
                            fill='none'
                            stroke='currentColor'
                            stroke-linecap='round'
                            stroke-width='2'
                            viewBox='0 0 24 24'
                        >
                            <line class='pull-to-refresh-tick' x1='12' x2='12' y1='3' y2='7' />
                            <line class='pull-to-refresh-tick' x1='12' x2='12' y1='3' y2='7' />
                            <line class='pull-to-refresh-tick' x1='12' x2='12' y1='3' y2='7' />
                            <line class='pull-to-refresh-tick' x1='12' x2='12' y1='3' y2='7' />
                            <line class='pull-to-refresh-tick' x1='12' x2='12' y1='3' y2='7' />
                            <line class='pull-to-refresh-tick' x1='12' x2='12' y1='3' y2='7' />
                            <line class='pull-to-refresh-tick' x1='12' x2='12' y1='3' y2='7' />
                            <line class='pull-to-refresh-tick' x1='12' x2='12' y1='3' y2='7' />
                        </svg>
                    </div>
                </div>
                <div
                    aria-busy='${() => String(state.refreshing)}'
                    class='pull-to-refresh-scroller'
                    ${this?.attributes?.[PULL_TO_REFRESH_SCROLLER]}
                    ${attributes[PULL_TO_REFRESH_SCROLLER]}
                    ${{
                        onpointercancel: release,
                        onpointerdown: (e: PointerEvent) => {
                            if (e.pointerType === 'mouse' && e.button === 0 && ready()) {
                                press = { pulling: false, y: e.clientY };
                            }
                        },
                        onpointermove: (e: PointerEvent) => {
                            let p = press;

                            // Touches fire pointer events too; those pulls run through the touch listeners.
                            if (!p || e.pointerType !== 'mouse') {
                                return;
                            }

                            let dy = e.clientY - p.y;

                            if (!p.pulling) {
                                if (dy < -DRAG_SLOP) {
                                    press = null;
                                }

                                if (dy <= DRAG_SLOP) {
                                    return;
                                }

                                // Counts from here, so crossing the slop never makes the feed jump.
                                p.pulling = true;
                                p.y = e.clientY;
                                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                                begin();
                            }

                            pull(e.clientY - p.y);
                        },
                        onpointerup: release,
                        onrender: (element: HTMLElement) => {
                            scroller = element;
                        }
                    }}
                >
                    <div
                        class='pull-to-refresh-content'
                        ${{
                            onanimationend: (e: AnimationEvent) => {
                                if (e.animationName === 'pull-to-refresh-fresh') {
                                    (e.target as Element).classList.remove('--fresh');
                                }
                            },
                            onrender: (element: HTMLElement) => {
                                feed = element;
                            }
                        }}
                    >
                        ${content}
                    </div>
                </div>
                <span aria-live='polite' class='pull-to-refresh-status'>${() => view.status}</span>
            </div>
        `;
    },
    { scroller: PULL_TO_REFRESH_SCROLLER }
);

export type { State };
