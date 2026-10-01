import { effect, reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes } from '@esportsplus/template';
import { edge } from '~/shared/anchor';
import { finished } from '~/shared/animation';
import { drag, fling, INTERACTIVE, toward, type Direction, type Drag } from '~/shared/drag';
import './scss/index.scss';


type A = Attributes<HTMLDialogElement> & {
    [OVERLAY_HANDLE]?: Attributes;
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
};


// Centered overlays dismiss downward, like a card being put away; placed ones back toward the edges they touch.
const CENTER: Direction = { axis: 'y', sign: 1 };

const OVERLAY_HANDLE = Symbol.for('@esportsplus/ui/overlay.handle');


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

function layer(element: HTMLDialogElement) {
    for (let i = 0, n = layers.length; i < n; i++) {
        if (layers[i].element === element) {
            return layers[i];
        }
    }
}

// Touch can only drag what the browser won't pan, so an overlay whose own content scrolls gives touch-drag up
// to its handle. The surface extension past the edge would count as overflow, so it is hidden while measuring.
function measure(element: HTMLElement) {
    element.classList.add('--measuring');

    let scrollable = element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth;

    element.classList.remove('--measuring');
    element.classList.toggle('--scrollable', scrollable);
}

function outside(element: HTMLElement, e: MouseEvent) {
    let rect = element.getBoundingClientRect();

    return e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom;
}

// Clears what a drag dismissal left behind, once the overlay has closed or is opening again.
function reset(element: HTMLElement) {
    element.style.removeProperty('--opacity');
    element.style.removeProperty('--scale');
    element.style.removeProperty('--transition-duration');
    element.style.removeProperty('--transition-timing-function');
    element.style.removeProperty('--translate');
    element.style.removeProperty('transform');
}

// Each layer recedes by how much of every layer above it in the same host is still open, so dragging the top
// one lets the rest follow the finger back. The host's '.overlay-page' child, if it opts in, recedes under all.
function restack() {
    let hosts = new Map<HTMLElement, { depth: number; tracking: boolean }>();

    // Walking down from the top, so every layer sees what is already stacked over it.
    for (let i = layers.length - 1; i >= 0; i--) {
        let { dragging, element, host, progress } = layers[i],
            entry = hosts.get(host) ?? { depth: 0, tracking: false };

        element.classList.toggle('--covered', entry.depth > 0);
        element.classList.toggle('--tracking', entry.depth > 0 && entry.tracking);
        element.inert = entry.depth > 0;

        if (entry.depth > 0) {
            element.style.setProperty('--depth', String(entry.depth));
        }
        else {
            element.style.removeProperty('--depth');
        }

        entry.depth += 1 - progress;
        entry.tracking ||= dragging;
        hosts.set(host, entry);
    }

    // Only the lowest backdrop dims the page; covered layers dim themselves rather than stacking dimmers.
    for (let i = 0, n = layers.length; i < n; i++) {
        let { element, host } = layers[i];

        element.classList.toggle('--stacked', layers.findIndex((layer) => layer.host === host) < i);
    }

    for (let host of overlaid) {
        if (!hosts.has(host)) {
            host.classList.remove('--overlaid', '--overlay-dragging');
            host.style.removeProperty('--overlay-depth');
        }
    }

    for (let [host, entry] of hosts) {
        host.classList.add('--overlaid');
        host.classList.toggle('--overlay-dragging', entry.tracking);
        host.style.setProperty('--overlay-depth', String(entry.depth));
    }

    overlaid = new Set(hosts.keys());
}

function unstack(element: HTMLDialogElement) {
    let current = layer(element);

    if (!current) {
        return;
    }

    layers.splice(layers.indexOf(current), 1);
    element.classList.remove('--covered', '--stacked', '--tracking');
    element.inert = false;
    element.style.removeProperty('--depth');
    restack();
}


export default component(
    function(this, { modal = true, rail = false, state = reactive({ active: false }), ...attributes }: A, content) {
        let observer: ResizeObserver | undefined,
            stop: VoidFunction | undefined;

        function settle(element: HTMLDialogElement, close: boolean, drag: Drag) {
            let current = layer(element),
                thrown = close ? fling(element, drag) : null;

            element.classList.remove('--dragging');
            element.style.removeProperty('--progress');

            // Snapping back, the drag's transform eases home. Dismissing, it is thrown on the way it was dragged
            // until it has left the screen, still fading as the drag faded it; its own exit stands down so the path
            // neither bends nor shrinks. Under reduced motion it fades where it was let go instead.
            if (thrown) {
                element.style.setProperty('--opacity', '0');
                element.style.setProperty('--scale', '1');
                element.style.setProperty('--transition-duration', `${thrown.duration}ms`);
                element.style.setProperty('--transition-timing-function', thrown.easing);
                element.style.setProperty('--translate', '0px');
                element.style.transform = `translate(${drag.x + thrown.x}px, ${drag.y + thrown.y}px)`;
            }
            else if (close) {
                element.style.setProperty('--opacity', '0');
            }
            else {
                element.style.removeProperty('transform');
            }

            if (current) {
                current.dragging = false;
                current.progress = 0;
                restack();
            }

            if (close) {
                state.active = false;
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
                    element.classList.contains('--covered') ||
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
                element.classList.add('--dragging');
            },
            move: (element, { x, y }, progress) => {
                let current = layer(element as HTMLDialogElement);

                element.style.setProperty('--progress', String(progress));
                element.style.transform = `translate(${x}px, ${y}px)`;

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
                ${rail
                    ? { class: ['--rail', () => state.active && '--active'], ...expandable(state) }
                    : { class: '--draggable', tabindex: -1 }}
                ${this?.attributes}
                ${attributes}
                ${{
                    ...gesture,
                    oncancel: (e) => {
                        e.preventDefault();
                        state.active = false;
                    },
                    onclick: (e) => {
                        let element = e.currentTarget as HTMLDialogElement;

                        gesture.onclick(e);

                        if (e.defaultPrevented) {
                            return;
                        }

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

                        // '--active' is written here rather than bound: it has to land between 'showModal()' and the
                        // style flush that starts the transition, and closing waits on the transitions it starts.
                        stop = effect(() => {
                            if (state.active) {
                                reset(element);

                                if (!element.open) {
                                    // Opening focuses the first control, scrolling a contained overlay's container
                                    // toward where it starts its transition and raising the on-screen keyboard
                                    // for inputs. Inert through the call it focuses nothing; the overlay takes
                                    // focus itself unless its content asks for it.
                                    element.inert = true;

                                    if (modal) {
                                        element.showModal();
                                    }
                                    else {
                                        element.show();
                                    }

                                    element.inert = false;
                                    (element.querySelector<HTMLElement>('[autofocus]') ?? element).focus({ preventScroll: true });

                                    observer = new ResizeObserver(() => measure(element));
                                    observer.observe(element);

                                    for (let i = 0, n = element.children.length; i < n; i++) {
                                        observer.observe(element.children[i]);
                                    }

                                    // Commit the closed styles first so adding '--active' transitions in.
                                    element.getBoundingClientRect();
                                }

                                if (!layer(element)) {
                                    layers.push({
                                        dragging: false,
                                        element,
                                        host: modal ? document.body : element.parentElement ?? document.body,
                                        progress: 0
                                    });
                                    restack();
                                }

                                element.classList.add('--active');
                                return;
                            }

                            element.classList.remove('--active');
                            unstack(element);

                            if (!element.open) {
                                return;
                            }

                            void finished(element).then(() => {
                                if (state.active) {
                                    return;
                                }

                                observer?.disconnect();
                                element.close();
                                reset(element);
                            });
                        });
                    },
                    ondisconnect: (element: HTMLDialogElement) => {
                        observer?.disconnect();
                        stop?.();
                        unstack(element);
                    }
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
    { handle: OVERLAY_HANDLE }
);
