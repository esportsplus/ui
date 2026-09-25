import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import { effect, onCleanup, reactive } from '@esportsplus/reactivity';
import './scss/index.scss';


type A = Attributes & {
    [PULL_TO_REFRESH_SCROLLER]?: Attributes;
    // Screen reader message once a refresh lands, given how many items arrived above the old first one.
    announce?: (count: number) => string;
    // Runs once per refresh; the indicator spins until the returned promise settles.
    onrefresh: () => unknown;
    state?: State;
};

type Gesture = {
    base: number;
    samples: { t: number; y: number }[];
};

type Press = {
    pulling: boolean;
    y: number;
};

type Spring = {
    omega: number;
    target: number;
    velocity: number;
};

type State = {
    // Set to true to refresh from elsewhere (a button, a shortcut); reads true while a refresh runs.
    refreshing: boolean;
};


// Past this many px a mouse press becomes a pull rather than a click.
const DRAG_SLOP = 4;

const FRESH: KeyframeAnimationOptions = { duration: 300, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' };

const PULL_TO_REFRESH_SCROLLER = Symbol.for('@esportsplus/ui/pull-to-refresh.scroller');

// Looser than Apple's 0.55 scroll edge, so reaching the threshold takes a comfortable ~110px of hand travel rather than ~150px.
const RUBBER = 0.7;

// Roughly the screen height; the band stiffens relative to it.
const RUBBER_DIMENSION = 480;

// Critically damped (0.35s visual duration): an indicator that overshoots would bounce the feed.
const SETTLE = (2 * Math.PI) / (1.2 * 0.35);

// Longer than a UI transition on purpose (0.5s visual duration): the feed travels up to ~150px and the new items should be
// seen arriving, not just appear.
const SLIDE_IN = (2 * Math.PI) / (1.2 * 0.5);

// Pulled this far (after resistance), letting go refreshes.
const THRESHOLD = 64;


function announcement(count: number) {
    return `Updated, ${count} new item${count === 1 ? '' : 's'}`;
}

function reduced() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Apple's rubber band: follows 1:1 at first, then gives less and less.
function rubberband(distance: number) {
    return (distance * RUBBER_DIMENSION * RUBBER) / (RUBBER_DIMENSION + RUBBER * distance);
}

// Where the hand would have to be for the band to show this offset, so a pull caught mid-spring continues from exactly where it is.
function unband(offset: number) {
    return (offset * RUBBER_DIMENSION) / (RUBBER * (RUBBER_DIMENSION - offset));
}


export default Object.assign(component<A, Renderable<unknown>>(
    function(
        this: { attributes?: Partial<A> },
        { announce = announcement, onrefresh, state = reactive({ refreshing: false }), ...attributes }: A,
        content
    ) {
        let busy = false,
            cleanup: VoidFunction | undefined,
            feed: HTMLElement | undefined,
            frame = 0,
            gesture: Gesture | null = null,
            glyph: HTMLElement | undefined,
            mouse: Press | null = null,
            reveal = 0,
            root: HTMLElement | undefined,
            scroller: HTMLElement | undefined,
            spring: Spring = { omega: SETTLE, target: 0, velocity: 0 },
            status: HTMLElement | undefined,
            time = 0,
            touch: Press | null = null,
            y = 0;

        // One code path for touch, mouse and programmatic refreshes, so all three look alike.
        function begin() {
            stop();
            glyph?.classList.remove('--fading');
            gesture = { base: unband(Math.max(y, 0)), samples: [] };
        }

        function end() {
            let g = gesture;

            gesture = null;

            if (!g) {
                return;
            }

            let first = g.samples[0],
                last = g.samples[g.samples.length - 1],
                dt = first && last ? (last.t - first.t) / 1000 : 0,
                velocity = dt > 0 ? (last.y - first.y) / dt : 0;

            if (y >= THRESHOLD) {
                refresh(velocity);
            }
            else {
                move(0, SETTLE, velocity);
            }
        }

        // New items land above the ones on screen. Shifting the feed up by their height keeps everything visually still for
        // a frame, then the feed springs down from the threshold, which slides the items in from the top and retracts the
        // indicator in one motion.
        function land(first: Element | null) {
            let count = 0,
                height = 0,
                motion = !reduced();

            if (first?.isConnected && feed && first.parentElement === feed) {
                let head = feed.firstElementChild as HTMLElement;

                height = (first as HTMLElement).offsetTop - head.offsetTop;

                for (let node: Element | null = head; node && node !== first; node = node.nextElementSibling) {
                    count++;
                    node.animate(
                        motion
                            ? [{ filter: 'blur(4px)', opacity: 0 }, { filter: 'blur(0px)', opacity: 1 }]
                            : [{ opacity: 0 }, { opacity: 1 }],
                        FRESH
                    );
                }
            }

            if (motion) {
                glyph?.classList.add('--fading');
            }

            busy = false;
            state.refreshing = false;

            if (status) {
                status.textContent = announce(count);
            }

            stop();
            y -= height;
            move(0, SLIDE_IN, 0);
        }

        function move(target: number, omega: number, velocity: number) {
            stop();

            if (reduced()) {
                y = target;
                paint();
                return;
            }

            spring = { omega, target, velocity };
            time = 0;
            frame = requestAnimationFrame(tick);
        }

        function paint() {
            root?.style.setProperty('--pull', String(Math.min(Math.max(y / THRESHOLD, 0), 1)));
            root?.style.setProperty('--reveal', String(reveal));
            root?.style.setProperty('--y', String(y));
        }

        function pull(distance: number, t: number) {
            let g = gesture;

            if (!g) {
                return;
            }

            let offset = rubberband(Math.max(g.base + distance, 0));

            y = offset;
            reveal = Math.min(offset / THRESHOLD, 1);
            g.samples.push({ t, y: offset });

            // Only the last 100ms say how fast the feed is moving now.
            while (g.samples.length > 2 && t - g.samples[0].t > 100) {
                g.samples.shift();
            }

            paint();
        }

        function refresh(velocity: number) {
            let first = feed?.firstElementChild ?? null;

            busy = true;
            reveal = 1;
            state.refreshing = true;
            glyph?.classList.remove('--fading');

            if (status) {
                status.textContent = '';
            }

            move(THRESHOLD, SETTLE, velocity);

            // Array slots render on the next frame, so measure after the caller's update has reached the DOM.
            void Promise.resolve()
                .then(onrefresh)
                .finally(() => requestAnimationFrame(() => land(first)));
        }

        function stop() {
            cancelAnimationFrame(frame);
            frame = 0;
        }

        // Exact critically damped step for any dt, so the release velocity carries straight into the settle.
        function tick(now: number) {
            let dt = time ? Math.min((now - time) / 1000, 1 / 30) : 1 / 60,
                decay = Math.exp(-spring.omega * dt),
                offset = y - spring.target,
                slope = spring.velocity + spring.omega * offset;

            time = now;
            y = spring.target + (offset + slope * dt) * decay;
            spring.velocity = (spring.velocity - spring.omega * slope * dt) * decay;

            if (Math.abs(y - spring.target) < 0.05 && Math.abs(spring.velocity) < 1) {
                y = spring.target;
                frame = 0;
            }
            else {
                frame = requestAnimationFrame(tick);
            }

            paint();
        }

        // Touch listeners are attached by hand because the pull has to cancel the browser's own scroll, which a passive
        // touchmove can't do.
        function touchend() {
            if (touch?.pulling) {
                end();
            }

            touch = null;
        }

        function touchmove(e: TouchEvent) {
            if (!touch || !scroller) {
                return;
            }

            let dy = e.touches[0].clientY - touch.y;

            if (!touch.pulling) {
                // Scrolling up the feed is a normal scroll; leave it alone.
                if (dy <= 0 || scroller.scrollTop > 0) {
                    touch = null;
                    return;
                }

                touch.pulling = true;
                begin();
            }

            e.preventDefault();
            pull(dy, e.timeStamp);
        }

        // Only from the very top, and never while a refresh or the slide in is still running.
        function touchstart(e: TouchEvent) {
            touch = null;

            if (busy || e.touches.length > 1 || !scroller || scroller.scrollTop > 0 || y < 0) {
                return;
            }

            touch = { pulling: false, y: e.touches[0].clientY };
        }

        onCleanup(effect(() => {
            if (!state.refreshing || busy) {
                return;
            }

            scroller?.scrollTo({ behavior: reduced() ? 'auto' : 'smooth', top: 0 });
            refresh(0);
        }));

        return html`
            <div
                class='pull-to-refresh ${() => state.refreshing && '--refreshing'}'
                ${this?.attributes}
                ${attributes}
                ${{
                    onconnect: (el: HTMLElement) => {
                        feed = el.querySelector<HTMLElement>('.pull-to-refresh-content') ?? undefined;
                        glyph = el.querySelector<HTMLElement>('.pull-to-refresh-glyph') ?? undefined;
                        root = el;
                        scroller = el.querySelector<HTMLElement>('.pull-to-refresh-scroller') ?? undefined;
                        status = el.querySelector<HTMLElement>('.pull-to-refresh-status') ?? undefined;

                        paint();

                        if (!scroller) {
                            return;
                        }

                        let source = scroller;

                        source.addEventListener('touchcancel', touchend);
                        source.addEventListener('touchend', touchend);
                        source.addEventListener('touchmove', touchmove, { passive: false });
                        source.addEventListener('touchstart', touchstart, { passive: true });
                        cleanup = () => {
                            source.removeEventListener('touchcancel', touchend);
                            source.removeEventListener('touchend', touchend);
                            source.removeEventListener('touchmove', touchmove);
                            source.removeEventListener('touchstart', touchstart);
                        };
                    },
                    ondisconnect: () => {
                        cleanup?.();
                        stop();
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
                            <line class='pull-to-refresh-tick' style='--index: 0; --order: 0;' transform='rotate(0 12 12)' x1='12' x2='12' y1='3' y2='7' />
                            <line class='pull-to-refresh-tick' style='--index: 1; --order: 7;' transform='rotate(-45 12 12)' x1='12' x2='12' y1='3' y2='7' />
                            <line class='pull-to-refresh-tick' style='--index: 2; --order: 6;' transform='rotate(-90 12 12)' x1='12' x2='12' y1='3' y2='7' />
                            <line class='pull-to-refresh-tick' style='--index: 3; --order: 5;' transform='rotate(-135 12 12)' x1='12' x2='12' y1='3' y2='7' />
                            <line class='pull-to-refresh-tick' style='--index: 4; --order: 4;' transform='rotate(-180 12 12)' x1='12' x2='12' y1='3' y2='7' />
                            <line class='pull-to-refresh-tick' style='--index: 5; --order: 3;' transform='rotate(-225 12 12)' x1='12' x2='12' y1='3' y2='7' />
                            <line class='pull-to-refresh-tick' style='--index: 6; --order: 2;' transform='rotate(-270 12 12)' x1='12' x2='12' y1='3' y2='7' />
                            <line class='pull-to-refresh-tick' style='--index: 7; --order: 1;' transform='rotate(-315 12 12)' x1='12' x2='12' y1='3' y2='7' />
                        </svg>
                    </div>
                </div>
                <div
                    aria-busy='${() => String(state.refreshing)}'
                    class='pull-to-refresh-scroller'
                    ${this?.attributes?.[PULL_TO_REFRESH_SCROLLER]}
                    ${attributes[PULL_TO_REFRESH_SCROLLER]}
                    ${{
                        onpointercancel: () => {
                            if (mouse?.pulling) {
                                end();
                            }

                            mouse = null;
                        },
                        onpointerdown: (e: PointerEvent) => {
                            if (e.pointerType !== 'mouse' || e.button !== 0) {
                                return;
                            }

                            if (busy || (e.currentTarget as HTMLElement).scrollTop > 0 || y < 0) {
                                return;
                            }

                            mouse = { pulling: false, y: e.clientY };
                        },
                        onpointermove: (e: PointerEvent) => {
                            let m = mouse;

                            if (!m) {
                                return;
                            }

                            let dy = e.clientY - m.y;

                            if (!m.pulling) {
                                if (dy < -DRAG_SLOP) {
                                    mouse = null;
                                }

                                if (dy <= DRAG_SLOP) {
                                    return;
                                }

                                // Counts from here, so crossing the slop never makes the feed jump.
                                m.pulling = true;
                                m.y = e.clientY;
                                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                                begin();
                            }

                            pull(e.clientY - m.y, e.timeStamp);
                        },
                        onpointerup: () => {
                            if (mouse?.pulling) {
                                end();
                            }

                            mouse = null;
                        }
                    }}
                >
                    <div class='pull-to-refresh-content'>${content}</div>
                </div>
                <span aria-live='polite' class='pull-to-refresh-status'></span>
            </div>
        `;
    }
), { scroller: PULL_TO_REFRESH_SCROLLER } as const);

export type { State };
