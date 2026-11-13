import { effect, flush, reactive } from '@esportsplus/reactivity';
import { html, type Renderable } from '@esportsplus/template';
import button from '~/components/button';
import { drag } from '~/shared/drag';
import type state from './model';


type Edge = 'left' | 'right';

// Each sidebar's elements as they connect, whether it is being dragged or resized, and where a drag holds it and the
// space beside the main area; undefined leaves each to the stylesheet. Peeking shows a closed sidebar for as long as
// the pointer stays over it.
type Frame = {
    dragging: boolean;
    edge?: HTMLElement;
    offset: number;
    peeking: boolean;
    resizing: boolean;
    sidebar?: HTMLElement;
    space: string | undefined;
    translate: string | undefined;
};

type Options = {
    // A closed sidebar opens while the pointer rests on its edge and closes the moment the pointer leaves it; its
    // toggle keeps it open.
    hover?: boolean;
    label?: string;
    // An open sidebar's inner border drags to resize it, between the layout's '--sidebar-min-width' and
    // '--sidebar-max-width', and never past leaving the main area '--main-min-width'.
    resizable?: boolean;
};

type Sidebars = {
    frames: Record<Edge, Frame>;
    id: string;
    options: Partial<Record<Edge, Options>>;
    // Whether the edge's dock holds a single static surface: only then does the sidebar itself swipe closed.
    stationary: (edge: Edge) => boolean;
    state: ReturnType<typeof state>;
};


// Presses in these keep their own text editing rather than dragging the sidebar.
const FIELDS = 'input, select, textarea, [contenteditable]';

// Below this width an open sidebar pushes the main area aside rather than narrowing it, so only one opens at a time.
const NARROW = '(max-width: 1024px)';


function close(sidebars: Sidebars, edge: Edge) {
    sidebars.state.toggle(edge, false);
}

// The direction a drag toward the center takes from this edge.
function direction(edge: Edge): -1 | 1 {
    return edge === 'left' ? 1 : -1;
}

// Marks the sidebar as following the pointer, flushed so its transitions stand down before the first move lands.
function hold(frame: Frame) {
    frame.dragging = true;
    flush();
}

function label(sidebars: Sidebars, edge: Edge) {
    return sidebars.options[edge]?.label ?? (edge === 'left' ? 'Left sidebar' : 'Right sidebar');
}

// A peeking sidebar closes once the pointer leaves it, unless it went on to the sidebar's own toggle or edge. The
// toggle is found by id: the sidebar button keeps its connect to itself.
function leave(sidebars: Sidebars, edge: Edge, e: PointerEvent) {
    let frame = sidebars.frames[edge],
        to = e.relatedTarget as Node | null;

    if (!frame.peeking || (to && [frame.sidebar, frame.edge, trigger(sidebars, edge)].some((element) => element?.contains(to)))) {
        return;
    }

    frame.peeking = false;
}

function open(sidebars: Sidebars, edge: Edge) {
    if (matchMedia(NARROW).matches) {
        close(sidebars, edge === 'left' ? 'right' : 'left');
    }

    sidebars.frames[edge].peeking = false;
    sidebars.state.toggle(edge, true);
}

// Shows 'shown' pixels of a sidebar 'width' wide. On small screens the main area slides with it, so the space beside it
// follows the pointer; elsewhere the sidebar passes over the main area, which keeps its layout until the sidebar
// settles.
function reveal(frame: Frame, edge: Edge, width: number, shown: number) {
    let clamped = Math.max(0, Math.min(width, shown));

    frame.space = matchMedia(NARROW).matches ? `${clamped}px` : undefined;
    frame.translate = `${(clamped - width) * direction(edge)}px 0`;
}

// Hands the sidebar and the main area back to their transitions, which carry both from where the drag left them to
// open or closed; flushed, so the transitions are back before the drag's values go.
function settle(frame: Frame) {
    frame.dragging = false;
    flush();
    frame.space = undefined;
    frame.translate = undefined;
}

function shown(sidebars: Sidebars, edge: Edge) {
    return sidebars.state.layout[edge].open || sidebars.frames[edge].peeking;
}

function trigger(sidebars: Sidebars, edge: Edge) {
    return document.getElementById(`${sidebars.id}-${edge}-toggle`);
}


// A sidebar's frame state, one per edge.
const frame = (): Frame => reactive({
    dragging: false,
    offset: 0,
    peeking: false,
    resizing: false,
    space: undefined as string | undefined,
    translate: undefined as string | undefined
});

// A strip along the layout's edge while the sidebar is closed: its handle follows the pointer up and down and stays
// where the pointer left it. Clicking it opens the sidebar, and dragging from it pulls the sidebar out: past a quarter
// of the sidebar or flicked it opens, otherwise it slides back. Resting on it peeks a sidebar that opens on hover.
const grip = (sidebars: Sidebars, edge: Edge) => {
    let current = sidebars.frames[edge],
        sign = direction(edge),
        gesture = drag({
            begin: (e) => e.button === 0 && !sidebars.state.layout[edge].open ? [{ axis: 'x', sign }] : null,
            capture: () => hold(current),
            measure: (element) => current.sidebar ?? element,
            move: (_, { x }) => {
                if (current.sidebar) {
                    reveal(current, edge, current.sidebar.offsetWidth, x * sign);
                }
            },
            release: (_, __, dismiss) => {
                settle(current);

                if (dismiss) {
                    open(sidebars, edge);
                }
            }
        });

    return html`
        <div
            aria-hidden='true'
            class='panels-edge-grip panels-edge-grip--${edge}'
            ${gesture}
            ${{
                // A drag swallows the click it ends with, so this is a tap or a click: either opens the sidebar.
                onclick: () => {
                    if (!sidebars.state.layout[edge].open) {
                        open(sidebars, edge);
                    }
                },
                onconnect: (element: HTMLElement) => {
                    current.edge = element;
                },
                onpointerenter: () => {
                    if (sidebars.options[edge]?.hover && !sidebars.state.layout[edge].open) {
                        current.peeking = true;
                    }
                },
                onpointerleave: (e: PointerEvent) => leave(sidebars, edge, e),
                onpointermove: function(this: HTMLElement, e: PointerEvent) {
                    let bounds = this.getBoundingClientRect();

                    current.offset = e.clientY - bounds.top - bounds.height / 2;
                    gesture.onpointermove(e);
                },
                style: () => `--offset: ${current.offset}px;`
            }}
        >
            <span class='panels-edge-handle'></span>
        </div>
    `;
};

// An open sidebar's inner border: pressing it resizes the sidebar to wherever the pointer goes, and the handle marking
// the border follows the pointer up and down as the edge strip's does. The stylesheet clamps the width.
const resizer = (sidebars: Sidebars, edge: Edge) => {
    let current = sidebars.frames[edge],
        pointer = reactive({ offset: 0 });

    function end() {
        current.resizing = false;
    }

    return html`
        <div
            aria-hidden='true'
            class='panels-sidebar-resize panels-sidebar-resize--${edge}'
            ${{
                class: () => current.resizing && '--active',
                onlostpointercapture: end,
                onpointerdown: function(this: HTMLElement, e: PointerEvent) {
                    if (e.button !== 0) {
                        return;
                    }

                    // Captured, so the moves and the release land here wherever the pointer goes; held from text selection.
                    e.preventDefault();
                    this.setPointerCapture(e.pointerId);
                    current.resizing = true;
                },
                onpointermove: function(this: HTMLElement, e: PointerEvent) {
                    let bounds = this.getBoundingClientRect();

                    pointer.offset = e.clientY - bounds.top - bounds.height / 2;

                    if (!current.resizing || !this.parentElement) {
                        return;
                    }

                    // Measured against the frame rather than the window, so a layout inside a page resizes within it.
                    let frame = this.parentElement.getBoundingClientRect();

                    sidebars.state.resizeDock(edge, edge === 'left' ? e.clientX - frame.left : frame.right - e.clientX);
                },
                onpointerup: end,
                style: () => `--offset: ${pointer.offset}px;`
            }}
        >
            <span class='panels-sidebar-resize-handle'></span>
        </div>
    `;
};

// The sidebar around its dock's groups. A static one drags toward its edge to close: past a quarter of its width or
// flicked it closes, otherwise it slides back; a tabbed one leaves its presses to the tabs. Closing it with focus
// inside hands focus to its toggle.
const sidebar = (sidebars: Sidebars, edge: Edge, content: Renderable<unknown>) => {
    let current = sidebars.frames[edge],
        gesture = drag({
            begin: (e) => {
                let target = e.target as HTMLElement;

                // A press past the target's client box is on its scrollbar.
                if (
                    e.button !== 0 ||
                    !sidebars.stationary(edge) ||
                    !shown(sidebars, edge) ||
                    target.closest(FIELDS) ||
                    (target.clientWidth > 0 && (e.offsetX > target.clientWidth || e.offsetY > target.clientHeight))
                ) {
                    return null;
                }

                return [{ axis: 'x', sign: direction(edge) === 1 ? -1 : 1 }];
            },
            capture: () => hold(current),
            move: (element, { x }) => {
                reveal(current, edge, element.offsetWidth, element.offsetWidth + x * direction(edge));
            },
            release: (_, __, dismiss) => {
                settle(current);

                if (dismiss) {
                    hide();
                }
            }
        });

    function hide() {
        if (current.peeking) {
            current.peeking = false;
        }
        else {
            close(sidebars, edge);
        }
    }

    return html`
        <aside
            aria-label='${label(sidebars, edge)}'
            class='panels-sidebar panels-sidebar--${edge}'
            id='${sidebars.id}-${edge}'
            ${{
                class: [
                    () => sidebars.state.layout[edge].open ? '--active' : current.peeking && '--peek',
                    () => current.dragging && 'panels-sidebar--dragging'
                ],
                // Delegated handlers stop at the nearest bound element, and the sidebar's content binds pointer events
                // of its own, so the drag listens on the sidebar directly.
                onconnect: (element: HTMLElement, on) => {
                    current.sidebar = element;

                    // Inert in the same pass that hands focus out, so focus is moved before inert drops it.
                    effect(() => {
                        let visible = shown(sidebars, edge);

                        if (!visible && element.contains(document.activeElement)) {
                            trigger(sidebars, edge)?.focus({ preventScroll: true });
                        }

                        element.inert = !visible;
                    });

                    // Links would otherwise start a native drag-and-drop mid-swipe and cancel the pointer.
                    on(element, 'dragstart', (e) => {
                        if (sidebars.stationary(edge)) {
                            e.preventDefault();
                        }
                    }, { direct: true });
                    on(element, 'pointercancel', gesture.onpointercancel, { direct: true });
                    on(element, 'pointerdown', gesture.onpointerdown, { direct: true });
                    on(element, 'pointerleave', (e) => leave(sidebars, edge, e), { direct: true });
                    on(element, 'pointermove', gesture.onpointermove, { direct: true });
                    on(element, 'pointerup', gesture.onpointerup, { direct: true });
                },
                onkeydown: (e: KeyboardEvent) => {
                    if (e.key === 'Escape' && !e.defaultPrevented && (current.peeking || sidebars.stationary(edge))) {
                        e.preventDefault();
                        hide();
                    }
                },
                style: () => ({ translate: current.translate })
            }}
        >
            ${content}
        </aside>
    `;
};

// The sidebar's toggle in its top corner. Clicked while its sidebar peeks, it keeps it open.
const toggle = (sidebars: Sidebars, edge: Edge) => {
    function text() {
        return `${sidebars.state.layout[edge].open ? 'Close' : 'Open'} ${label(sidebars, edge).toLowerCase()}`;
    }

    return button.sidebar({
        'aria-controls': `${sidebars.id}-${edge}`,
        'aria-label': text,
        class: `panels-toggle panels-toggle--${edge}`,
        id: `${sidebars.id}-${edge}-toggle`,
        onclick: () => sidebars.state.layout[edge].open ? close(sidebars, edge) : open(sidebars, edge),
        // The button keeps 'pointerleave' for itself; moves into its own glyph are ignored like any within the sidebar.
        onpointerout: (e: PointerEvent) => leave(sidebars, edge, e),
        open: () => sidebars.state.layout[edge].open,
        side: edge,
        title: text
    });
};


export { frame, grip, NARROW, resizer, sidebar, toggle };
export type { Edge, Frame, Options, Sidebars };
