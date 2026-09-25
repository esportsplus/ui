import { effect, reactive, untrack } from '@esportsplus/reactivity';
import { component, html, type Attributes } from '@esportsplus/template';
import { animator, type Spring } from './spring';
import './scss/index.scss';


type A = Attributes<HTMLDialogElement> & {
    alt: Text;
    caption?: Text;
    height?: number;
    maxScale?: number;
    oncancel?: never;
    onclose?: never;
    onconnect?: never;
    ondisconnect?: never;
    onkeydown?: never;
    origin?: () => HTMLElement | null | undefined;
    src: Text;
    state?: { active: boolean };
    width?: number;
};

type Drag = {
    content: boolean;
    id: number;
    originX: number;
    originY: number;
    x: number;
    y: number;
};

type Landing = {
    opacity: number;
    radius: number;
    scale: number;
    x: number;
    y: number;
};

type Text = string | (() => string);


const CELL: Spring = { damping: 34, mass: 0.45, stiffness: 520 };

const HOME: Spring = { damping: 27, mass: 1, stiffness: 150 };

const KEY_PAN = 56;

const KEY_ZOOM = 1.6;

// Below this the image counts as unzoomed: backdrop taps dismiss and Escape closes.
const NEAR_HOME = 1.02;

const SETTLE_DELAY = 220;

const SLOP = 8;

// Gestures released below this spring back to the fitted frame.
const SNAP_HOME = 1.05;

// Zoom progress is quantized so reactive UI (glyph, cursor, live region) doesn't update every frame.
const STEPS = 8;

const TOGGLE = 2.5;

const WHEEL_RATE = 140;


function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function reduced() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
}


export default component<A>(
    function(this, { alt, caption, height, maxScale = 4, origin, src, state = reactive({ active: false }), width, ...attributes }) {
        let controller = new AbortController(),
            drag: Drag | null = null,
            id = `lightbox-${Math.random().toString(36).slice(2)}`,
            locked: { overflow: string, padding: string } | undefined,
            motion = animator(paint),
            radius = 0,
            run = 0,
            stop: VoidFunction | undefined,
            timer: ReturnType<typeof setTimeout> | undefined,
            top = Math.max(1.1, maxScale),
            view = reactive({ settled: 0, step: 0 });

        let dialog: HTMLDialogElement,
            frame: HTMLElement,
            image: HTMLImageElement,
            stage: HTMLElement;

        // Stage carries the open/close flight between thumbnail and viewport; image carries zoom and pan.
        let stageOpacity = motion.value(0, 0.001),
            stageRadius = motion.value(0, 0.1),
            stageScale = motion.value(1, 0.0005),
            stageX = motion.value(0, 0.1),
            stageY = motion.value(0, 0.1),
            x = motion.value(0, 0.1),
            y = motion.value(0, 0.1),
            zoom = motion.value(1, 0.0005);

        function center() {
            let rect = frame.getBoundingClientRect();

            return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        }

        function close() {
            if (!dialog.open) {
                return;
            }

            let generation = ++run;

            drag = null;
            dialog.classList.remove('--active');
            stage.classList.remove('--active');

            if (reduced()) {
                dialog.close();
                return;
            }

            let landed = landing();

            void Promise.all([
                stageOpacity.to(landed.opacity, HOME),
                stageRadius.to(landed.radius, HOME),
                stageScale.to(landed.scale, HOME),
                stageX.to(landed.x, HOME),
                stageY.to(landed.y, HOME),
                x.to(0, HOME),
                y.to(0, HOME),
                zoom.to(1, HOME)
            ]).then(() => {
                if (generation === run) {
                    dialog.close();
                }
            });
        }

        function finish() {
            let s = zoom.get();

            if (s < SNAP_HOME) {
                reset();
            }
            else {
                settle(s);
            }
        }

        function glide(s: number, nx: number, ny: number, spring: Spring = CELL) {
            let { mx, my } = limit(s),
                tx = clamp(nx, -mx, mx),
                ty = clamp(ny, -my, my);

            if (reduced()) {
                x.set(tx);
                y.set(ty);
                zoom.set(s);
            }
            else {
                void x.to(tx, spring);
                void y.to(ty, spring);
                void zoom.to(s, spring);
            }

            mark(s);
            settle(s);
        }

        function landing(): Landing {
            let element = origin?.();

            if (element && image.offsetWidth > 0) {
                let from = element.getBoundingClientRect(),
                    to = center();

                if (from.width > 0) {
                    let scale = from.width / image.offsetWidth;

                    return {
                        opacity: 1,
                        radius: (parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0) / scale,
                        scale,
                        x: from.left + from.width / 2 - to.x,
                        y: from.top + from.height / 2 - to.y
                    };
                }
            }

            return { opacity: 0, radius, scale: 0.97, x: 0, y: 10 };
        }

        function limit(s: number) {
            return {
                mx: Math.max(0, (image.offsetWidth * s - frame.clientWidth) / 2),
                my: Math.max(0, (image.offsetHeight * s - frame.clientHeight) / 2)
            };
        }

        function lock() {
            let body = document.body,
                gap = innerWidth - document.documentElement.clientWidth;

            locked = { overflow: body.style.overflow, padding: body.style.paddingRight };
            body.style.overflow = 'hidden';

            if (gap > 0) {
                body.style.paddingRight = `${(parseFloat(getComputedStyle(body).paddingRight) || 0) + gap}px`;
            }
        }

        function mark(s: number) {
            let next = step(s);

            if (view.step !== next) {
                view.step = next;
            }
        }

        function open() {
            let fresh = !dialog.open,
                generation = ++run;

            if (fresh) {
                lock();
                radius = parseFloat(getComputedStyle(dialog).getPropertyValue('--border-radius')) || 0;
                stageOpacity.set(0);
                x.set(0);
                y.set(0);
                zoom.set(1);
                mark(1);
                settle(1);
                paint();
                dialog.showModal();
                frame.focus({ preventScroll: true });
            }

            dialog.classList.add('--active');

            // Waits a frame so a 'src' swapped alongside 'active' is applied, then for the decode so
            // the flight is measured against the real image box instead of an empty one.
            requestAnimationFrame(() => {
                let ready = image.complete ? Promise.resolve() : image.decode().catch(() => {});

                void ready.then(() => {
                    if (generation !== run) {
                        return;
                    }

                    if (fresh && !reduced()) {
                        let landed = landing();

                        stageOpacity.set(landed.opacity);
                        stageRadius.set(landed.radius);
                        stageScale.set(landed.scale);
                        stageX.set(landed.x);
                        stageY.set(landed.y);
                        paint();
                    }

                    stage.classList.add('--active');

                    if (reduced()) {
                        stageOpacity.set(1);
                        stageRadius.set(radius);
                        stageScale.set(1);
                        stageX.set(0);
                        stageY.set(0);
                        return;
                    }

                    void stageOpacity.to(1, HOME);
                    void stageRadius.to(radius, HOME);
                    void stageScale.to(1, HOME);
                    void stageX.to(0, HOME);
                    void stageY.to(0, HOME);
                });
            });
        }

        function paint() {
            if (!stage) {
                return;
            }

            image.style.borderRadius = `${stageRadius.get()}px`;
            image.style.transform = `translate(${x.get()}px, ${y.get()}px) scale(${zoom.get()})`;
            stage.style.opacity = `${stageOpacity.get()}`;
            stage.style.transform = `translate(${stageX.get()}px, ${stageY.get()}px) scale(${stageScale.get()})`;
        }

        function place(s: number, nx: number, ny: number) {
            let { mx, my } = limit(s);

            x.set(clamp(nx, -mx, mx));
            y.set(clamp(ny, -my, my));
            zoom.set(s);
            mark(s);
        }

        function release(e: PointerEvent) {
            let held = drag;

            if (!held || held.id !== e.pointerId) {
                return;
            }

            drag = null;

            if (
                e.type === 'pointerup' &&
                !held.content &&
                zoom.get() <= NEAR_HOME &&
                Math.hypot(e.clientX - held.originX, e.clientY - held.originY) < SLOP
            ) {
                state.active = false;
                return;
            }

            finish();
        }

        function reset() {
            glide(1, 0, 0, HOME);
        }

        function settle(s: number) {
            clearTimeout(timer);
            timer = undefined;

            let next = step(s);

            if (view.settled !== next) {
                view.settled = next;
            }
        }

        function step(s: number) {
            return clamp(Math.round(((s - 1) / (top - 1)) * STEPS), 0, STEPS);
        }

        function toggle() {
            if (view.step > 0) {
                reset();
                return;
            }

            let { x, y } = center();

            zoomAt(Math.min(TOGGLE, top), x, y, true);
        }

        function unlock() {
            if (!locked) {
                return;
            }

            document.body.style.overflow = locked.overflow;
            document.body.style.paddingRight = locked.padding;
            locked = undefined;
        }

        function zoomAt(next: number, cx: number, cy: number, animated: boolean) {
            let { x: fx, y: fy } = center(),
                px = cx - fx,
                py = cy - fy,
                s = clamp(next, 1, top),
                s0 = zoom.get(),
                ax = (px - x.get()) / s0,
                ay = (py - y.get()) / s0;

            if (animated) {
                glide(s, px - ax * s, py - ay * s, s <= 1 ? HOME : CELL);
                return;
            }

            place(s, px - ax * s, py - ay * s);
            clearTimeout(timer);
            timer = setTimeout(() => settle(s), SETTLE_DELAY);
        }

        function wheel(e: WheelEvent) {
            e.preventDefault();
            zoomAt(zoom.get() * Math.exp(-e.deltaY / WHEEL_RATE), e.clientX, e.clientY, false);
        }

        return html`
            <dialog
                class='lightbox'
                aria-describedby='${id}-hint'
                aria-labelledby='${id}-title'
                ${this?.attributes}
                ${attributes}
                ${{
                    oncancel: (e) => {
                        e.preventDefault();
                        state.active = false;
                    },
                    onclose: () => {
                        run++;
                        dialog.classList.remove('--active');
                        stage.classList.remove('--active');
                        unlock();
                        state.active = false;
                    },
                    onconnect: (element: HTMLDialogElement) => {
                        dialog = element;
                        frame = element.querySelector('.lightbox-frame')!;
                        image = element.querySelector('.lightbox-image')!;
                        stage = element.querySelector('.lightbox-stage')!;
                        frame.addEventListener('wheel', wheel, { passive: false, signal: controller.signal });

                        stop = effect(() => {
                            let active = state.active;

                            untrack(() => active ? open() : close());
                        });
                    },
                    ondisconnect: () => {
                        stop?.();
                        clearTimeout(timer);
                        controller.abort();
                        motion.stop();
                        unlock();
                    },
                    onkeydown: (e) => {
                        if (e.key === 'Escape') {
                            // Handled here rather than in 'cancel' so the first press can unzoom without closing.
                            e.preventDefault();

                            if (zoom.get() > NEAR_HOME) {
                                reset();
                            }
                            else {
                                state.active = false;
                            }

                            return;
                        }

                        if (e.key === 'Tab') {
                            let nodes = [...dialog.querySelectorAll<HTMLElement>('[data-lightbox-focus]')],
                                here = nodes.indexOf(document.activeElement as HTMLElement);

                            e.preventDefault();
                            nodes[e.shiftKey ? (here <= 0 ? nodes.length - 1 : here - 1) : (here + 1) % nodes.length]?.focus();
                            return;
                        }

                        if (e.target !== frame) {
                            return;
                        }

                        let { x: cx, y: cy } = center(),
                            s = zoom.get();

                        if (e.key === '+' || e.key === '=') {
                            e.preventDefault();
                            zoomAt(s * KEY_ZOOM, cx, cy, true);
                        }
                        else if (e.key === '-' || e.key === '_') {
                            e.preventDefault();
                            zoomAt(s / KEY_ZOOM, cx, cy, true);
                        }
                        else if (e.key === '0') {
                            e.preventDefault();
                            reset();
                        }
                        else if (s > NEAR_HOME && e.key.startsWith('Arrow')) {
                            e.preventDefault();
                            glide(
                                s,
                                x.get() + (e.key === 'ArrowLeft' ? KEY_PAN : e.key === 'ArrowRight' ? -KEY_PAN : 0),
                                y.get() + (e.key === 'ArrowUp' ? KEY_PAN : e.key === 'ArrowDown' ? -KEY_PAN : 0)
                            );
                        }
                    },
                    onwindowblur: () => {
                        drag = null;
                    }
                }}
            >
                <div class='lightbox-veil' aria-hidden='true'></div>

                <div
                    class='lightbox-frame'
                    aria-describedby='${id}-hint'
                    aria-labelledby='${id}-title'
                    data-lightbox-focus
                    role='group'
                    tabindex='-1'
                    ${{
                        class: () => view.step > 0 && '--zoomed',
                        ondblclick: (e) => {
                            zoomAt(zoom.get() > SNAP_HOME ? 1 : Math.min(TOGGLE, top), e.clientX, e.clientY, true);
                        },
                        onlostpointercapture: release,
                        onpointercancel: release,
                        onpointerdown: function(e) {
                            if (e.pointerType === 'mouse' && e.button !== 0) {
                                return;
                            }

                            this.setPointerCapture(e.pointerId);
                            drag = {
                                content: image.contains(e.target as Node),
                                id: e.pointerId,
                                originX: e.clientX,
                                originY: e.clientY,
                                x: x.get(),
                                y: y.get()
                            };
                        },
                        onpointermove: (e) => {
                            let held = drag;

                            if (!held || held.id !== e.pointerId || zoom.get() <= 1) {
                                return;
                            }

                            place(zoom.get(), held.x + e.clientX - held.originX, held.y + e.clientY - held.originY);
                        },
                        onpointerup: release
                    }}
                >
                    <div class='lightbox-stage'>
                        <img
                            class='lightbox-image'
                            alt='${alt}'
                            draggable='false'
                            src='${src}'
                            ${{ height, width }}
                        />
                    </div>
                </div>

                <div class='lightbox-chrome'>
                    <p class='lightbox-caption' id='${id}-title'>
                        ${caption ?? alt}
                    </p>

                    <div class='lightbox-actions'>
                        <button
                            class='lightbox-button'
                            data-lightbox-focus
                            type='button'
                            ${{
                                'aria-label': () => view.step > 0 ? 'Zoom out' : 'Zoom in',
                                class: () => view.step > 0 && '--zoomed',
                                onclick: toggle
                            }}
                        >
                            <svg aria-hidden='true' viewBox='0 0 256 256'>
                                <circle cx='116' cy='116' r='84' />
                                <path d='M175.4 175.4 224 224M84 116h64' />
                                <path class='lightbox-button-plus' d='M116 84v64' />
                            </svg>
                        </button>

                        <button
                            class='lightbox-button'
                            aria-label='Close'
                            data-lightbox-focus
                            type='button'
                            ${{ onclick: () => state.active = false }}
                        >
                            <svg aria-hidden='true' viewBox='0 0 256 256'>
                                <path d='M200 56 56 200M200 200 56 56' />
                            </svg>
                        </button>
                    </div>
                </div>

                <p class='lightbox-assistive' id='${id}-hint'>
                    Scroll to zoom toward the pointer, or press plus and minus. Drag or use the arrow keys
                    to pan, and double-click to switch between fit and close-up. Press zero to return to
                    the starting frame; Escape returns home first, then closes.
                </p>

                <p class='lightbox-assistive' role='status'>
                    ${() => `Zoom ${(1 + (view.settled / STEPS) * (top - 1)).toFixed(1)} times`}
                </p>
            </dialog>
        `;
    }
);
