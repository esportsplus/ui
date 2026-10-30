import { flush, reactive } from '@esportsplus/reactivity';
import { html, type Renderable } from '@esportsplus/template';
import { drag } from '~/shared/drag';
import button from '~/components/button';
import scrollbar from '~/modifiers/scrollbar';
import '~/components/card/scss/index.scss';
import './scss/index.scss';


type Edge = 'left' | 'right';

// Each edge's sidebar and strip as they connect, whether its sidebar is being dragged, and where the drag holds the
// sidebar and the card's edge; undefined leaves each to the stylesheet.
type Frame = Record<Edge, {
    dragging: boolean,
    edge?: HTMLElement,
    gap: string | undefined,
    offset: number,
    reach: string | undefined,
    sidebar?: HTMLElement,
    space: string | undefined,
    translate: string | undefined
}>;

// Which closed sidebars are showing for as long as the pointer stays over them.
type Peeking = Record<Edge, boolean>;

type Side = {
    class?: string;
    content?: Renderable<unknown>;
    // A closed sidebar opens while the pointer rests on its edge and closes the moment the pointer leaves it; its toggle
    // keeps it open.
    hover?: boolean;
    id: string;
    label: string;
    state: { active: boolean };
};

type Sides = Record<Edge, Side>;


// Presses in these keep their own text editing rather than dragging the sidebar.
const FIELDS = 'input, select, textarea, [contenteditable]';

// Below this width an open sidebar pushes the card aside rather than narrowing it, so only one opens at a time.
const NARROW = '(max-width: 1024px)';


// Found by id, since a page closes a side it only holds the config of.
function close(side: Pick<Side, 'id' | 'state'>) {
    if (document.getElementById(side.id)?.contains(document.activeElement)) {
        document.getElementById(`${side.id}-toggle`)?.focus({ preventScroll: true });
    }

    side.state.active = false;
}

// The direction a drag toward the center takes from this edge.
function direction(edge: Edge): -1 | 1 {
    return edge === 'left' ? 1 : -1;
}

// A strip along the window edge while the sidebar is closed: its handle follows the pointer up and down and stays where
// the pointer left it. Clicking it opens the sidebar, and dragging from it pulls the sidebar out, with the overlay's drag:
// past a quarter of the sidebar or flicked it opens, otherwise it slides back. Resting on it peeks a sidebar that opens
// on hover.
function grip(sides: Sides, peeking: Peeking, frame: Frame, edge: Edge) {
    let side = sides[edge],
        sign = direction(edge),
        gesture = drag({
            begin: (e) => e.button === 0 && !side.state.active ? [{ axis: 'x', sign }] : null,
            capture: () => hold(frame, edge),
            measure: (element) => frame[edge].sidebar ?? element,
            move: (_, { x }) => {
                let element = frame[edge].sidebar;

                if (element) {
                    reveal(frame, edge, element.offsetWidth, x * sign);
                }
            },
            release: (_, __, dismiss) => {
                settle(frame, edge);

                if (dismiss) {
                    open(sides, peeking, edge);
                }
            }
        });

    return html`
        <div
            aria-hidden='true'
            class='shell-edge shell-edge--${edge}'
            id='${side.id}-edge'
            ${gesture}
            ${{
                // A drag swallows the click it ends with, so this is a tap or a click: either opens the sidebar.
                onclick: () => {
                    if (!side.state.active) {
                        open(sides, peeking, edge);
                    }
                },
                onpointerenter: () => {
                    if (side.hover && !side.state.active) {
                        peeking[edge] = true;
                    }
                },
                onconnect: (element: HTMLElement) => {
                    frame[edge].edge = element;
                },
                onpointerleave: (e: PointerEvent) => leave(side, peeking, frame, edge, e),
                onpointermove: function(this: HTMLElement, e: PointerEvent) {
                    let bounds = this.getBoundingClientRect();

                    frame[edge].offset = e.clientY - bounds.top - bounds.height / 2;
                    gesture.onpointermove(e);
                },
                style: () => `--offset: ${frame[edge].offset}px;`
            }}
        >
            <span class='shell-handle'></span>
        </div>
    `;
}

// Marks the sidebar as following the pointer, flushed so its transitions stand down before the first move lands.
function hold(frame: Frame, edge: Edge) {
    frame[edge].dragging = true;
    flush();
}

// A peeking sidebar closes once the pointer leaves it, unless it went on to the sidebar's own toggle or edge. The
// toggle is found by id: it is the sidebar button's own, which keeps its connect to itself.
function leave(side: Side, peeking: Peeking, frame: Frame, edge: Edge, e: PointerEvent) {
    let to = e.relatedTarget as Node | null;

    if (!peeking[edge] || (to && [frame[edge].sidebar, frame[edge].edge, document.getElementById(`${side.id}-toggle`)].some((element) => element?.contains(to)))) {
        return;
    }

    peeking[edge] = false;
}

function motion(): Frame[Edge] {
    return reactive({
        dragging: false,
        gap: undefined as string | undefined,
        offset: 0,
        reach: undefined as string | undefined,
        space: undefined as string | undefined,
        translate: undefined as string | undefined
    });
}

function open(sides: Sides, peeking: Peeking, edge: Edge) {
    if (matchMedia(NARROW).matches) {
        close(sides[edge === 'left' ? 'right' : 'left']);
    }

    peeking[edge] = false;
    sides[edge].state.active = true;
}

// Dragged toward its edge with the overlay's drag, the sidebar follows the pointer; past a quarter of its width or
// flicked it closes, otherwise it slides back.
function panel(side: Side, peeking: Peeking, frame: Frame, edge: Edge) {
    let gesture = drag({
            begin: (e) => {
                let target = e.target as HTMLElement;

                // A press past the target's client box is on its scrollbar.
                if (
                    e.button !== 0 ||
                    !(side.state.active || peeking[edge]) ||
                    target.closest(FIELDS) ||
                    (target.clientWidth > 0 && (e.offsetX > target.clientWidth || e.offsetY > target.clientHeight))
                ) {
                    return null;
                }

                return [{ axis: 'x', sign: direction(edge) === 1 ? -1 : 1 }];
            },
            capture: () => hold(frame, edge),
            move: (element, { x }) => {
                reveal(frame, edge, element.offsetWidth, element.offsetWidth + x * direction(edge));
            },
            release: (_, __, dismiss) => {
                settle(frame, edge);

                if (dismiss) {
                    hide();
                }
            }
        }),
        listening: AbortController | undefined;

    function hide() {
        if (peeking[edge]) {
            peeking[edge] = false;
        }
        else {
            close(side);
        }
    }

    return html`
        <aside
            aria-label='${side.label}'
            class='shell-sidebar shell-sidebar--${edge} ${side.class ?? ''}'
            id='${side.id}'
            ${{
                class: [
                    () => side.state.active ? '--active' : peeking[edge] && '--peek',
                    () => frame[edge].dragging && 'shell-sidebar--dragging'
                ],
                inert: () => !side.state.active && !peeking[edge],
                // Delegated handlers stop at the nearest bound element, and the sidebar's content binds pointer events
                // of its own, so the drag listens on the sidebar directly.
                onconnect: (element: HTMLElement) => {
                    frame[edge].sidebar = element;
                    listening?.abort();
                    listening = new AbortController();

                    let signal = listening.signal;

                    // Links would otherwise start a native drag-and-drop mid-swipe and cancel the pointer.
                    element.addEventListener('dragstart', (e) => e.preventDefault(), { signal });
                    element.addEventListener('pointercancel', gesture.onpointercancel, { signal });
                    element.addEventListener('pointerdown', gesture.onpointerdown, { signal });
                    element.addEventListener('pointerleave', (e) => leave(side, peeking, frame, edge, e), { signal });
                    element.addEventListener('pointermove', gesture.onpointermove, { signal });
                    element.addEventListener('pointerup', gesture.onpointerup, { signal });
                },
                ondisconnect: () => listening?.abort(),
                onkeydown: (e: KeyboardEvent) => {
                    if (e.key === 'Escape' && !e.defaultPrevented) {
                        e.preventDefault();
                        hide();
                    }
                },
                style: () => ({ translate: frame[edge].translate })
            }}
        >
            ${side.content}
        </aside>
    `;
}

// Shows 'shown' pixels of a sidebar 'width' wide and moves the card's edge to meet it, narrowing its gap to none as it
// comes. The card's surface moves while its content keeps its layout, clipped where the sidebar covers it, until the
// sidebar settles; on small screens the card keeps its width and slides, so it moves outright. The shell's transitions
// stand down so both follow the pointer.
function reveal(frame: Frame, edge: Edge, width: number, shown: number) {
    let clamped = Math.max(0, Math.min(width, shown)),
        rest = `calc(var(--gap-horizontal) * ${width ? 1 - clamped / width : 1})`,
        state = frame[edge];

    state.translate = `${(clamped - width) * direction(edge)}px 0`;

    if (matchMedia(NARROW).matches) {
        state.gap = rest;
        state.reach = undefined;
        state.space = `${clamped}px`;
    }
    else {
        state.gap = undefined;
        state.reach = `calc(${clamped}px + ${rest})`;
        state.space = undefined;
    }
}

// Hands the sidebar and the card back to their transitions, which carry both from where the drag left them to open or
// closed; flushed, so the transitions are back before the drag's values go.
function settle(frame: Frame, edge: Edge) {
    let state = frame[edge];

    state.dragging = false;
    flush();
    state.gap = undefined;
    state.reach = undefined;
    state.space = undefined;
    state.translate = undefined;
}

// Clicked while its sidebar peeks, the toggle keeps it open.
function toggle(sides: Sides, peeking: Peeking, frame: Frame, edge: Edge) {
    let side = sides[edge];

    function label() {
        return `${side.state.active ? 'Close' : 'Open'} ${side.label.toLowerCase()}`;
    }

    return button.sidebar({
        'aria-controls': side.id,
        'aria-label': label,
        class: `shell-toggle shell-toggle--${edge}`,
        id: `${side.id}-toggle`,
        onclick: () => side.state.active ? close(side) : open(sides, peeking, edge),
        // The button keeps 'pointerleave' for itself; moves into its own glyph are ignored like any within the sidebar.
        onpointerout: (e: PointerEvent) => leave(side, peeking, frame, edge, e),
        open: () => side.state.active,
        side: edge,
        title: label
    });
}


// The app frame: a sidebar on either edge, each with its toggle in its own top corner, around a card the page scrolls
// in. The card insets from the window by a gap that closes on the side of an open sidebar, and a closed sidebar's gap
// holds a handle to drag it open by, which slides in over the card while the pointer is on that edge.
const shell = (sides: Sides, content: Renderable<unknown>) => {
    let frame: Frame = { left: motion(), right: motion() },
        peeking = reactive<Peeking>({ left: false, right: false });

    return html`
        <div
            class='shell ${() => sides.left.state.active && '--left-open'} ${() => sides.right.state.active && '--right-open'}'
            ${{
                class: () => (frame.left.dragging || frame.right.dragging) && 'shell--dragging',
                style: () => ({
                    '--left-edge': frame.left.reach,
                    '--left-gap-horizontal': frame.left.gap,
                    '--left-space': frame.left.space,
                    '--right-edge': frame.right.reach,
                    '--right-gap-horizontal': frame.right.gap,
                    '--right-space': frame.right.space
                })
            }}
        >
            <div aria-hidden='true' class='shell-backdrop'></div>
            <div aria-hidden='true' class='shell-surface'></div>
            ${panel(sides.left, peeking, frame, 'left')}
            ${panel(sides.right, peeking, frame, 'right')}
            ${grip(sides, peeking, frame, 'left')}
            ${grip(sides, peeking, frame, 'right')}
            ${toggle(sides, peeking, frame, 'left')}
            ${toggle(sides, peeking, frame, 'right')}
            <div class='card shell-main' ${scrollbar()}>
                ${content}
            </div>
        </div>
    `;
};


const layout: typeof shell & { close: typeof close } = Object.assign(shell, { close });


export default layout;
export type { Side };
