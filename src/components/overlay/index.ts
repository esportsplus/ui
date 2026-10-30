import { flush, reactive, root } from '@esportsplus/reactivity';
import { component, html, setProperties, type Attributes, type Element as Bound } from '@esportsplus/template';
import { noop } from '@esportsplus/utilities';
import { edge } from '~/shared/anchor';
import { finished, ms } from '~/shared/animation';
import { drag, fling, INTERACTIVE, toward, type Direction, type Drag } from '~/shared/drag';
import { observer, type Observer } from '~/shared/resize';
import popup, { lifecycle } from './popup';
import './scss/index.scss';


type A = Attributes<HTMLDialogElement> & {
    [OVERLAY_HANDLE]?: Attributes;
    flow?: boolean;
    modal?: boolean;
    oncancel?: never;
    onclick?: never;
    onclose?: never;
    onconnect?: never;
    ondisconnect?: never;
    onfocusin?: never;
    onfocusout?: never;
    onpointercancel?: never;
    onpointerdown?: never;
    onpointerenter?: never;
    onpointerleave?: never;
    onpointermove?: never;
    onpointerup?: never;
    rail?: boolean;
    state?: { active: boolean };
};

type Layer = {
    dragging: boolean;
    element: HTMLDialogElement;
    // Modal layers stack in the top layer over <body>, non-modal ones within their container; each is its own stack.
    host: HTMLElement;
    progress: number;
    view: View;
};

type Parent = {
    active: boolean;
    background: string | undefined;
    depth: number | undefined;
    dragging: boolean;
    height: string | undefined;
};

type View = ReturnType<typeof view>;


// Centered overlays dismiss downward, like a card being put away; placed ones back toward the edges they touch.
const CENTER: Direction = { axis: 'y', sign: 1 };

const OVERLAY_HANDLE = Symbol.for('@esportsplus/ui/overlay.handle');

const PARENT_STATE = Symbol('overlay.parent');


// Open overlays in the order they opened. It is global because the top layer they stack in is.
let layers: Layer[] = [],
    overlaid = new Set<HTMLElement>();


// Rails expand while a mouse or pen rests on them or keyboard focus is inside. Touch has no hover, and a tap
// would enter and leave at once; a click that leaves focus on a link shouldn't hold the rail open either.
function expandable(state: { active: boolean }): Attributes<HTMLDialogElement> {
    let hovered = false;

    return {
        onfocusin: (e: FocusEvent) => {
            if ((e.target as HTMLElement).matches(':focus-visible')) {
                state.active = true;
            }
        },
        onfocusout: function(this: HTMLDialogElement, e: FocusEvent) {
            if (!this.contains(e.relatedTarget as Node | null)) {
                state.active = hovered;
            }
        },
        onpointerenter: (e: PointerEvent) => {
            if (e.pointerType === 'touch') {
                return;
            }

            hovered = true;
            state.active = true;
        },
        onpointerleave: function(this: HTMLDialogElement, e: PointerEvent) {
            if (e.pointerType === 'touch') {
                return;
            }

            hovered = false;
            state.active = this.matches(':has(:focus-visible)');
        }
    };
}

// The color an overlay shows: its own background, or its content's where the container is transparent, as
// announcement leaves the surface to its content.
function background(element: Element) {
    let surface = element,
        background = getComputedStyle(surface).backgroundColor;

    while (background === 'transparent' || background.endsWith(', 0)') || background.endsWith('/ 0)')) {
        let child = surface.querySelector(':scope > :not([hidden]):not(.overlay-handle)');

        if (!child) {
            break;
        }

        surface = child;
        background = getComputedStyle(surface).backgroundColor;
    }

    return background;
}

function layer(element: HTMLDialogElement) {
    for (let i = 0, n = layers.length; i < n; i++) {
        if (layers[i].element === element) {
            return layers[i];
        }
    }
}

// Touch can only drag what the browser won't pan, so an overlay whose own content scrolls gives touch-drag up
// to its handle. The edge fill is border paint and does not contribute to scrollable overflow.
function measure(element: HTMLElement, view: View) {
    view.scrollable = element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth;
}

function outside(element: HTMLElement, e: MouseEvent) {
    let rect = element.getBoundingClientRect();

    return e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom;
}

// The page's own element an overlay writes to: the host a stack sits in, or a flow overlay's space. One store per
// element, shared by every overlay over it and bound once, so only 'restack()' and the flow drag write it. Bound in
// its own root rather than the overlay that first needs it, so it outlives that overlay; its binding stops once the
// element leaves the document.
function parent(element: HTMLElement) {
    let store = element as HTMLElement & { [PARENT_STATE]?: Parent };

    return store[PARENT_STATE] ??= root(() => {
        let state: Parent = reactive({
                active: false,
                background: undefined as string | undefined,
                depth: undefined as number | undefined,
                dragging: false,
                height: undefined as string | undefined
            });

        setProperties(element as Bound, {
            class: () => [state.active && 'overlay-host--active', state.dragging && 'overlay-host--dragging'],
            style: () => ({ '--overlay-depth': state.depth, 'background-color': state.background, height: state.height })
        });

        return state;
    });
}

// Clears what a drag dismissal left behind, once the overlay has closed or is opening again.
function reset(view: View) {
    view.edgeBackground = undefined;
    view.edgeFill = false;
    view.opacity = undefined;
    view.scale = undefined;
    view.transform = undefined;
    view.transitionDuration = undefined;
    view.transitionTimingFunction = undefined;
    view.translate = undefined;
}

// Each layer recedes by how much of every layer above it in the same host is still open, so dragging the top
// one lets the rest follow the finger back. The host's '.overlay-page' child, if it opts in, recedes under all.
function restack() {
    let hosts = new Map<HTMLElement, { depth: number; tracking: boolean }>();

    // Walking down from the top, so every layer sees what is already stacked over it.
    for (let i = layers.length - 1; i >= 0; i--) {
        let { dragging, host, progress, view } = layers[i],
            entry = hosts.get(host) ?? { depth: 0, tracking: false },
            covered = entry.depth > 0;

        view.covered = covered;
        view.depth = entry.depth || undefined;
        view.tracking = covered && entry.tracking;

        entry.depth += 1 - progress;
        entry.tracking ||= dragging;
        hosts.set(host, entry);
    }

    let seen = new Set<HTMLElement>();

    // Only the lowest backdrop dims the page; covered layers dim themselves rather than stacking dimmers.
    for (let i = 0, n = layers.length; i < n; i++) {
        let { host, view } = layers[i];

        view.stacked = seen.has(host);
        seen.add(host);
    }

    for (let host of overlaid) {
        if (!hosts.has(host)) {
            let state = parent(host);

            state.active = false;
            state.depth = undefined;
            state.dragging = false;
        }
    }

    // Custom properties inherit, so writing one on <body> every drag move restyles the whole page; only a host with
    // a receding page reads it.
    for (let [host, entry] of hosts) {
        let state = parent(host);

        state.active = true;
        state.depth = host.querySelector(':scope > .overlay-page') ? entry.depth || undefined : undefined;
        state.dragging = entry.tracking;
    }

    overlaid = new Set(hosts.keys());
}

function unstack(element: HTMLDialogElement) {
    let current = layer(element);

    if (!current) {
        return;
    }

    let view = current.view;

    layers.splice(layers.indexOf(current), 1);
    view.covered = false;
    view.depth = undefined;
    view.stacked = false;
    view.tracking = false;
    restack();
}

// Everything the overlay writes to its own class and style, in one fixed shape: the dialog binds a class array and a
// style object over it, each diffed whole into one write, and an undefined value leaves its declaration out.
function view() {
    return reactive({
        active: false,
        covered: false,
        depth: undefined as number | undefined,
        dragging: false,
        edgeBackground: undefined as string | undefined,
        edgeFill: false,
        opacity: undefined as string | undefined,
        progress: undefined as number | undefined,
        scale: undefined as string | undefined,
        scrollable: false,
        // From 'show()' until 'close()': inert outside it, so opening focuses nothing it contains.
        shown: false,
        stacked: false,
        tracking: false,
        transform: undefined as string | undefined,
        transitionDuration: undefined as string | undefined,
        transitionTimingFunction: undefined as string | undefined,
        translate: undefined as string | undefined
    });
}


export default component(
    function(this, { flow = false, modal = !flow, rail = false, state = reactive({ active: false }), ...attributes }: A, content) {
        let fill = 0,
            height = 0,
            motion: Animation | undefined,
            resize: Observer | undefined,
            self = view(),
            space: HTMLElement | undefined,
            stop: VoidFunction | undefined;

        // Flow overlays give their space back as they are dragged out, without moving the page into a layer stack.
        function resetSpace() {
            let previous = motion;

            motion = undefined;
            previous?.cancel();

            if (space) {
                let state = parent(space);

                state.background = undefined;
                state.height = undefined;
                space = undefined;
            }
        }

        function settle(element: HTMLDialogElement, close: boolean, drag: Drag) {
            let current = layer(element),
                thrown = close && !flow ? fling(element, drag) : null;

            self.dragging = false;
            self.progress = undefined;

            // Snapping back, the drag's transform eases home. Dismissing, it is thrown on the way it was dragged
            // until it has left the screen, still fading as the drag faded it; its own exit stands down so the path
            // neither bends nor shrinks. Under reduced motion it fades where it was let go instead.
            if (thrown) {
                self.opacity = '0';
                self.scale = '1';
                self.transform = `translate(${drag.x + thrown.x}px, ${drag.y + thrown.y}px)`;
                self.transitionDuration = `${thrown.duration}ms`;
                self.transitionTimingFunction = thrown.easing;
                self.translate = '0px';
            }
            else if (close) {
                self.opacity = '0';

                if (flow) {
                    self.transform = undefined;
                }
            }
            else {
                self.transform = undefined;
            }

            if (current) {
                current.dragging = false;
                current.progress = 0;
                restack();
            }

            if (close) {
                state.active = false;
            }

            if (space) {
                let computed = getComputedStyle(element),
                    end = `${close ? 0 : height}px`,
                    room = parent(space),
                    start = room.height;

                // Closing, the overlay fades in its space, so the space stops standing in for it.
                if (close) {
                    room.background = undefined;
                }

                room.height = end;
                motion = space.animate([{ height: start }, { height: end }], {
                    duration: ms(computed.getPropertyValue(close ? '--close-duration' : '--open-duration')),
                    easing: computed.getPropertyValue('--ease').trim() || 'ease'
                });

                let current = motion;

                void current.finished.then(() => {
                    if (motion === current) {
                        resetSpace();
                    }
                }, noop);
            }

            if (self.edgeFill) {
                let generation = fill;

                // Written now, so the snap-back has started by the time its animations are read.
                flush();

                // Keep the fill attached through the snap-back; a new drag owns its own cleanup.
                void finished(element).then(() => {
                    if (generation === fill) {
                        self.edgeBackground = undefined;
                        self.edgeFill = false;
                    }
                });
            }
        }

        let gesture = drag({
            begin: (e, element) => {
                if (rail || e.button !== 0 || !state.active) {
                    return null;
                }

                let target = e.target as HTMLElement;

                // Only the top layer drags, and a press past the target's client box is on its scrollbar.
                if (
                    self.covered ||
                    outside(element, e) ||
                    target.closest(INTERACTIVE) ||
                    (target.clientWidth > 0 && (e.offsetX > target.clientWidth || e.offsetY > target.clientHeight))
                ) {
                    return null;
                }

                let placement = edge(element, 'overlay');

                return placement ? toward(placement) : [CENTER];
            },
            capture: (element) => {
                self.dragging = true;

                if (flow) {
                    resetSpace();
                    space = element.parentElement!;
                    height = element.offsetHeight;

                    let room = parent(space);

                    // Painted in the overlay's color, so dragged away from its closing edge only the content seems
                    // to move; its own edges meet the same color, leaving no seam.
                    room.background = background(element);
                    room.height = `${height}px`;
                }
                else if (edge(element, 'overlay') && !element.classList.contains('overlay--floating')) {
                    fill++;
                    self.edgeBackground = background(element);
                    self.edgeFill = true;
                }
            },
            move: (element, { x, y }, progress) => {
                let current = layer(element as HTMLDialogElement);

                self.progress = progress;
                self.transform = `translate(${x}px, ${y}px)`;

                if (space) {
                    let sign = edge(element, 'overlay')?.y || 1;

                    parent(space).height = `${Math.max(0, height - Math.max(y * sign, 0))}px`;
                }

                if (current) {
                    current.dragging = true;
                    current.progress = progress;
                    restack();
                }
            },
            release: (element, drag, dismiss) => settle(element as HTMLDialogElement, dismiss, drag)
        });

        return html`
            <dialog
                class='overlay'
                ${flow && { class: 'overlay--flow' }}
                ${rail
                    ? { class: ['overlay--rail', () => state.active && '--active'], ...expandable(state) }
                    : { class: 'overlay--draggable', tabindex: -1 }}
                ${this?.attributes}
                ${attributes}
                ${{
                    ...gesture,
                    class: () => [
                        self.active && '--active',
                        self.covered && 'overlay--covered',
                        self.dragging && 'overlay--dragging',
                        self.edgeFill && 'overlay--edge-fill',
                        self.scrollable && 'overlay--scrollable',
                        self.stacked && 'overlay--stacked',
                        self.tracking && 'overlay--tracking'
                    ],
                    inert: !rail && (() => !self.shown || self.covered),
                    oncancel: (e) => {
                        e.preventDefault();
                        state.active = false;
                    },
                    onclick: (e) => {
                        let element = e.currentTarget as HTMLDialogElement;

                        if (e.target === element && outside(element, e)) {
                            state.active = false;
                        }
                    },
                    onclose: () => {
                        state.active = false;
                    },
                    onconnect: (element: HTMLDialogElement) => {
                        // A rail never closes; hover, focus or 'state.active' only expand it, through its bound class.
                        if (rail) {
                            let previous = document.activeElement;

                            // 'show' focuses the first control, but a rail is part of the page rather than
                            // something the user opened, so focus stays where it was.
                            element.show();
                            (document.activeElement as HTMLElement | null)?.blur();

                            if (previous instanceof HTMLElement && previous !== document.body) {
                                previous.focus({ preventScroll: true });
                            }

                            return;
                        }

                        // '--active' follows the dialog's own open and close rather than 'state.active': it has to
                        // land after 'showModal()' and the closed styles are committed, so the transition runs.
                        stop = lifecycle(element, {
                            state,
                            open: () => {
                                resetSpace();
                                reset(self);

                                if (!element.open) {
                                    let previous = flow ? document.activeElement : null;

                                    // Opening focuses the first control, scrolling a contained overlay's container
                                    // toward where it starts its transition and raising the on-screen keyboard
                                    // for inputs. Still inert through the call it focuses nothing; the overlay
                                    // takes focus itself unless its content asks for it, once 'shown' has landed.
                                    if (modal && !flow) {
                                        element.showModal();
                                    }
                                    else {
                                        element.show();
                                    }

                                    self.shown = true;

                                    if (flow) {
                                        if (previous instanceof HTMLElement && previous !== document.activeElement) {
                                            previous.focus({ preventScroll: true });
                                        }
                                    }
                                    else {
                                        queueMicrotask(() => {
                                            if (self.active && element.open) {
                                                (element.querySelector<HTMLElement>('[autofocus]') ?? element).focus({ preventScroll: true });
                                            }
                                        });
                                    }

                                    resize?.disconnect();
                                    resize = observer(() => measure(element, self));
                                    resize.observe(element);

                                    for (let i = 0, n = element.children.length; i < n; i++) {
                                        resize.observe(element.children[i]);
                                    }

                                    // Commit the closed styles first so adding '--active' transitions in.
                                    element.getBoundingClientRect();
                                }

                                if (!flow && !layer(element)) {
                                    layers.push({
                                        dragging: false,
                                        element,
                                        host: modal ? document.body : element.parentElement ?? document.body,
                                        progress: 0,
                                        view: self
                                    });
                                    restack();
                                }

                                self.active = true;
                            },
                            close: () => {
                                self.active = false;
                                unstack(element);
                            },
                            closed: () => {
                                resize?.disconnect();
                                resize = undefined;
                                element.close();
                                self.shown = false;
                                resetSpace();
                                reset(self);
                            }
                        });
                    },
                    ondisconnect: (element: HTMLDialogElement) => {
                        resize?.disconnect();
                        resize = undefined;
                        stop?.();
                        resetSpace();
                        unstack(element);
                    },
                    style: () => ({
                        '--depth': self.depth,
                        '--edge-background': self.edgeBackground,
                        '--opacity': self.opacity,
                        '--progress': self.progress,
                        '--scale': self.scale,
                        '--transition-duration': self.transitionDuration,
                        '--transition-timing-function': self.transitionTimingFunction,
                        '--translate': self.translate,
                        transform: self.transform
                    })
                }}
            >
                ${!rail && html`
                    <div
                        aria-hidden='true'
                        class='overlay-handle'
                        ${this?.attributes?.[OVERLAY_HANDLE]}
                        ${attributes[OVERLAY_HANDLE]}
                    ></div>
                `}
                ${content}
            </dialog>
        `;
    },
    { handle: OVERLAY_HANDLE, popup }
);
