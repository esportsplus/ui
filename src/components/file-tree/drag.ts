import { peek, reactive, type Signal } from '@esportsplus/reactivity';
import { html, type Attributes } from '@esportsplus/template';


type Drag<E> = {
    // Asked before 'drop', like VS Code's 'explorer.confirmDragAndDrop'; false cancels it.
    confirm?: (drop: Drop<E>) => boolean | Promise<boolean>;
    drop: (drop: Drop<E>) => void;
};

type Drop<E> = {
    // Alt/Option was held: the elements are copied into the target rather than moved.
    copy: boolean;
    elements: E[];
    // The folder receiving them, or null for the top level.
    target: E | null;
};

type Effect = '' | 'copy' | 'move' | 'none';

type Row<T> = {
    depth: number;
    element: { name: string };
    key: number;
    locked: boolean;
    open: Signal<boolean> | null;
    parent: T | null;
};

type Tree<T> = {
    // The rows a press on 'row' drags.
    grab: (row: T) => T[];
    // The row on screen standing for a folder, which differs for one shown as a segment of a compact row.
    host: (row: T) => T;
    // The last row on screen inside a folder, or the folder itself when closed.
    last: (row: T) => T;
    open: (row: T) => void;
    // Whether the space past the last row drops into the top level; a tree of roots holds nothing else there.
    top: boolean;
    viewport: () => HTMLElement | undefined;
};


// Touch has to hold still this long before a drag starts, so a swipe across the rows still scrolls them.
const DELAY = 300;

// Within this far of the viewport's top or bottom a drag scrolls it, faster the closer it gets.
const EDGE = 32;

// How long a folder is hovered before it opens, after VS Code.
const HOVER = 500;

// Pixels per second at the edge itself.
const SPEED = 600;

const THRESHOLD = 4;


function prevent(e: Event) {
    e.preventDefault();
}

function swallow(e: Event) {
    e.preventDefault();
    e.stopPropagation();
}


// Pointer events rather than native drag and drop: the rows are virtualized, so the pressed row can scroll out of
// the DOM mid-drag, taking a native drag's source and events with it; the viewport holds the pointer instead, and
// the feedback, Alt copy, auto-scroll and touch all stay in the tree's hands.
export default <T extends Row<T>>({ confirm, drop }: Drag<T['element']>, tree: Tree<T>) => {
    let busy = false,
        ghost: HTMLElement | undefined,
        // Rows and compact row segments on screen, which a drag aims at.
        rows = new Map<HTMLElement, T>(),
        segments = new Map<HTMLElement, T>(),
        sources: T[] = [],
        // 'target' is the key of the drop folder's row, -1 for the top level, and 'folder' the folder's own, which
        // differs for a segment of a compact row; 'last' is the key of the last row in the target's box. 'depth' is the
        // target box's depth and 'x'/'y' where the ghost sits.
        ui = reactive({ count: 0, depth: null as number | null, effect: '' as Effect, folder: 0, label: '', last: 0, target: 0, x: 0, y: 0 });

    function drag(list: T[], e: PointerEvent) {
        let active = false,
            cancelled = false,
            carry = 0,
            copy = e.altKey,
            frame = 0,
            opening: ReturnType<typeof setTimeout> | undefined,
            originX = e.clientX,
            originY = e.clientY,
            pointer = e.pointerId,
            // A folder, null for the top level, undefined when a release would drop nothing.
            target: T | null | undefined,
            time = 0,
            touch = e.pointerType === 'touch',
            timer = touch ? setTimeout(activate, DELAY) : undefined,
            x = e.clientX,
            y = e.clientY;

        function activate() {
            clearTimeout(timer);

            active = true;
            sources = list;
            ui.count = list.length;
            ui.label = list[0].element.name;

            getSelection()?.removeAllRanges();
            // Held by the viewport, so the pointer stays with the drag once the pressed row scrolls out of the DOM.
            tree.viewport()?.setPointerCapture(pointer);
            ghost?.showPopover();
            place();
            aim();

            frame = requestAnimationFrame(tick);
        }

        function aim() {
            let viewport = tree.viewport();

            if (!viewport) {
                return;
            }

            let bounds = viewport.getBoundingClientRect(),
                next: T | null | undefined;

            if (x >= bounds.left && x < bounds.right && y >= bounds.top && y < bounds.bottom) {
                let bottom = bounds.top,
                    found = false;

                // By height alone: a nested row starts at its indent, and the space left of it is still that row.
                for (let [node, row] of rows) {
                    let rect = node.getBoundingClientRect();

                    if (y >= rect.top && y < rect.bottom) {
                        for (let [element, folder] of segments) {
                            let box = element.getBoundingClientRect();

                            if (node.contains(element) && x >= box.left && x < box.right) {
                                row = folder;
                                break;
                            }
                        }

                        found = true;
                        next = row.open ? row : row.parent;
                        break;
                    }

                    bottom = Math.max(bottom, rect.bottom);
                }

                if (!found) {
                    // Past the last row is the top level; anywhere else, rows are still rendering in behind a scroll.
                    if (y < bottom || viewport.scrollTop + viewport.clientHeight < viewport.scrollHeight - 1) {
                        return;
                    }

                    next = null;
                }
            }

            if (next !== undefined && !allowed(next)) {
                next = undefined;
            }

            ui.effect = next === undefined ? 'none' : copy ? 'copy' : 'move';

            if (next === target) {
                return;
            }

            target = next;
            clearTimeout(opening);

            let box = next && tree.host(next);

            if (box) {
                ui.depth = box.depth;

                if (box.open && !peek(box.open)) {
                    opening = setTimeout(expand, HOVER);
                }
            }

            ui.folder = next ? next.key : 0;
            ui.last = box ? tree.last(box).key : 0;
            ui.target = box ? box.key : next === null ? -1 : 0;
        }

        function allowed(folder: T | null) {
            if (folder === null ? !tree.top : folder.locked) {
                return false;
            }

            let moves = false;

            for (let i = 0, n = list.length; i < n; i++) {
                let row = list[i];

                for (let node = folder; node; node = node.parent) {
                    if (node === row) {
                        return false;
                    }
                }

                if (row.parent !== folder) {
                    moves = true;
                }
            }

            return copy || moves;
        }

        function cleanup() {
            stop();
            busy = false;

            document.removeEventListener('contextmenu', prevent);
            document.removeEventListener('dragstart', prevent);
            document.removeEventListener('keydown', key, true);
            document.removeEventListener('keyup', key, true);
            document.removeEventListener('pointercancel', release);
            document.removeEventListener('pointermove', move);
            document.removeEventListener('pointerup', release);
            document.removeEventListener('selectstart', prevent);
            document.removeEventListener('touchmove', scroll);
        }

        function expand() {
            if (!target) {
                return;
            }

            let box = tree.host(target);

            tree.open(box);
            ui.last = tree.last(box).key;
        }

        function key(e: KeyboardEvent) {
            if (!active) {
                return;
            }

            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                cancelled = true;
                stop();
            }
            else if (e.key === 'Alt') {
                // Pressed and released alone, Alt would move focus to the browser's menu on Windows.
                e.preventDefault();
                copy = e.altKey;
                aim();
            }
        }

        function move(e: PointerEvent) {
            if (e.pointerId !== pointer || cancelled) {
                return;
            }

            copy = e.altKey;
            x = e.clientX;
            y = e.clientY;

            if (active) {
                place();
                aim();
                return;
            }

            if (Math.hypot(x - originX, y - originY) < THRESHOLD) {
                return;
            }

            if (touch) {
                cleanup();
            }
            else {
                activate();
            }
        }

        function place() {
            ui.x = x;
            ui.y = y;
        }

        async function release(e: PointerEvent) {
            if (e.pointerId !== pointer) {
                return;
            }

            let folder = active && e.type === 'pointerup' ? target : undefined,
                moved = active || cancelled;

            cleanup();

            if (moved) {
                // The pointerup that ended the drag is followed by a click on whatever sits under the pointer.
                addEventListener('click', swallow, true);
                setTimeout(() => removeEventListener('click', swallow, true));
            }

            if (folder === undefined) {
                return;
            }

            let result = { copy, elements: list.map((row) => row.element), target: folder?.element ?? null };

            if (!confirm || await confirm(result)) {
                drop(result);
            }
        }

        function scroll(e: TouchEvent) {
            if (active) {
                e.preventDefault();
            }
        }

        function stop() {
            let viewport = tree.viewport();

            active = false;
            cancelAnimationFrame(frame);
            clearTimeout(opening);
            clearTimeout(timer);

            if (ghost?.matches(':popover-open')) {
                ghost.hidePopover();
            }

            if (viewport?.hasPointerCapture(pointer)) {
                viewport.releasePointerCapture(pointer);
            }

            sources = [];
            target = undefined;
            ui.depth = null;
            ui.effect = '';
            ui.folder = 0;
            ui.last = 0;
            ui.target = 0;
        }

        function tick(now: number) {
            frame = requestAnimationFrame(tick);

            let dt = time ? Math.min((now - time) / 1000, 1 / 30) : 0,
                viewport = tree.viewport();

            time = now;

            if (viewport) {
                let bounds = viewport.getBoundingClientRect(),
                    pull = 0,
                    zone = Math.min(EDGE, bounds.height / 4);

                if (x >= bounds.left && x < bounds.right) {
                    if (y < bounds.top + zone) {
                        pull = Math.max(-1, (y - bounds.top - zone) / zone);
                    }
                    else if (y > bounds.bottom - zone) {
                        pull = Math.min(1, (y - bounds.bottom + zone) / zone);
                    }
                }

                // Whole pixels only, the remainder carried: a slow pull moves less than a pixel a frame.
                carry = pull ? carry + pull * SPEED * dt : 0;

                let step = Math.trunc(carry);

                if (step) {
                    carry -= step;
                    viewport.scrollTop += step;
                }
            }

            aim();
        }

        busy = true;

        document.addEventListener('contextmenu', prevent);
        document.addEventListener('dragstart', prevent);
        document.addEventListener('keydown', key, true);
        document.addEventListener('keyup', key, true);
        document.addEventListener('pointercancel', release);
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', release);
        document.addEventListener('selectstart', prevent);
        document.addEventListener('touchmove', scroll, { passive: false });
    }

    // Where 'row' sits in the box drawn around the target folder and its open contents.
    function mark(row: T) {
        let target = ui.target;

        if (target <= 0) {
            return false;
        }

        for (let node: T | null = row; node; node = node.parent) {
            if (node.key === target) {
                let end = row.key === ui.last;

                return node === row ? (end ? 'only' : 'start') : (end ? 'end' : 'middle');
            }
        }

        return false;
    }

    return {
        ghost: html`
            <div
                aria-hidden='true'
                class='file-tree-drag'
                popover='manual'
                ${{
                    'data-effect': () => ui.effect || false,
                    onrender: (element: HTMLElement) => {
                        ghost = element;
                    },
                    style: () => `translate: ${ui.x}px ${ui.y}px`
                }}
            >
                <span class='file-tree-drag-name'>${() => ui.label}</span>
                ${() => ui.count > 1 && html`<span class='file-tree-drag-count'>${ui.count}</span>`}
                <span class='file-tree-drag-copy'>+</span>
            </div>
        `,
        root: {
            'data-drag': () => ui.effect || false,
            'data-drop': () => ui.target === -1 ? 'root' : false
        } as Attributes,
        row: (row: T): Attributes => ({
            'data-dragged': () => ui.effect !== '' && sources.includes(row) ? 'true' : false,
            'data-drop': () => mark(row),
            ondisconnect: (element: HTMLElement) => {
                rows.delete(element);
            },
            onpointerdown: (e: PointerEvent) => {
                if (busy || row.locked || e.button !== 0 || !e.isPrimary) {
                    return;
                }

                let grabbed = tree.grab(row),
                    // A row inside another dragged folder travels with it.
                    list = grabbed.filter((item) => {
                        if (item.locked) {
                            return false;
                        }

                        for (let node = item.parent; node; node = node.parent) {
                            if (grabbed.includes(node)) {
                                return false;
                            }
                        }

                        return true;
                    });

                if (list.length) {
                    drag(list, e);
                }
            },
            onrender: (element: HTMLElement) => {
                rows.set(element, row);
            }
        }),
        // Marks the segment of a compact row a drop lands in.
        segment: (row: T): Attributes => ({
            'data-drop': () => ui.folder === row.key && 'true',
            ondisconnect: (element: HTMLElement) => {
                segments.delete(element);
            },
            onrender: (element: HTMLElement) => {
                segments.set(element, row);
            }
        }),
        // The root carries the fold motion's inline styles, so the drop depth goes on the viewport instead.
        viewport: {
            style: () => ui.depth !== null && `--drop-depth: ${ui.depth}`
        } as Attributes
    };
};

export type { Drag, Drop };
