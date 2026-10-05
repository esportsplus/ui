import { peek, reactive, read, signal, write, type Signal } from '@esportsplus/reactivity';
import { html, type Attributes } from '@esportsplus/template';
import press from '~/shared/press';


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
    // The row a row or compact row segment on screen stands for, which a drag aims at.
    row: (element: HTMLElement) => T | undefined;
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


// Pointer events rather than native drag and drop: the rows are virtualized, so the pressed row can scroll out of
// the DOM mid-drag, taking a native drag's source and events with it; the viewport holds the pointer instead, and
// the feedback, Alt copy, auto-scroll and touch all stay in the tree's hands.
export default <T extends Row<T>>({ confirm, drop }: Drag<T['element']>, tree: Tree<T>) => {
    let gesture = press(DELAY),
        ghost: HTMLElement | undefined,
        // Whether a drag is under way; every row reads it, so only a drag's start and end re-render them all.
        held = signal(false),
        // 'target' is the key of the drop folder's row, -1 for the top level, and 'folder' the folder's own, which
        // differs for a segment of a compact row; 'last' is the key of the last row in the target's box. Rows and
        // segments test their own keys alone, so a new target re-renders the rows of the boxes it leaves and enters.
        marks = { folder: signal(0), last: signal(0), target: signal(0) },
        sources: T[] = [],
        // 'depth' is the target box's depth and 'x'/'y' where the ghost sits.
        ui = reactive({ count: 0, depth: null as number | null, effect: '' as Effect, label: '', x: 0, y: 0 });

    function drag(list: T[], e: PointerEvent) {
        let active = false,
            cancelled = false,
            carry = 0,
            copy = e.altKey,
            frame = 0,
            // Captured, ahead of the tree's own keys; only while this press lasts.
            keys = new AbortController(),
            opening: ReturnType<typeof setTimeout> | undefined,
            pointer = e.pointerId,
            // A folder, null for the top level, undefined when a release would drop nothing.
            target: T | null | undefined,
            time = 0,
            x = e.clientX,
            y = e.clientY;

        function activate() {
            active = true;
            sources = list;
            write(held, true);
            ui.count = list.length;
            ui.label = list[0].element.name;

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
                for (let node of viewport.querySelectorAll<HTMLElement>('.file-tree-row')) {
                    let row = tree.row(node);

                    if (!row) {
                        continue;
                    }

                    let rect = node.getBoundingClientRect();

                    if (y >= rect.top && y < rect.bottom) {
                        for (let element of node.querySelectorAll<HTMLElement>('.file-tree-segment')) {
                            let box = element.getBoundingClientRect(),
                                segment = tree.row(element);

                            if (segment && x >= box.left && x < box.right) {
                                row = segment;
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

            write(marks.folder, next ? next.key : 0);
            write(marks.last, box ? tree.last(box).key : 0);
            write(marks.target, box ? box.key : next === null ? -1 : 0);
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

        // Drops on the target it was released over, unless it was cancelled or never got going.
        async function end(e: PointerEvent | null) {
            let folder = active && e?.type === 'pointerup' ? target : undefined;

            keys.abort();
            stop();

            if (folder === undefined) {
                return;
            }

            let result = { copy, elements: list.map((row) => row.element), target: folder?.element ?? null };

            if (!confirm || await confirm(result)) {
                drop(result);
            }
        }

        function expand() {
            if (!target) {
                return;
            }

            let box = tree.host(target);

            tree.open(box);
            write(marks.last, tree.last(box).key);
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
            if (cancelled) {
                return;
            }

            copy = e.altKey;
            x = e.clientX;
            y = e.clientY;

            if (active) {
                place();
                aim();
            }
        }

        function place() {
            ui.x = x;
            ui.y = y;
        }

        function stop() {
            let viewport = tree.viewport();

            active = false;
            cancelAnimationFrame(frame);
            clearTimeout(opening);

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
            write(held, false);
            write(marks.folder, 0);
            write(marks.last, 0);
            write(marks.target, 0);
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

        gesture.begin(e, { end, move, start: activate });
        document.addEventListener('keydown', key, { capture: true, signal: keys.signal });
        document.addEventListener('keyup', key, { capture: true, signal: keys.signal });
    }

    // Where 'row' sits in the box drawn around the target folder and its open contents, as its classes.
    function mark(row: T) {
        for (let node: T | null = row; node; node = node.parent) {
            if (signal.selector(marks.target, node.key)) {
                let end = signal.selector(marks.last, row.key);

                return `file-tree-row--drop file-tree-row--drop-${node === row ? (end ? 'only' : 'start') : (end ? 'end' : 'middle')}`;
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
                    class: () => ui.effect && `file-tree-drag--${ui.effect}`,
                    onconnect: (element: HTMLElement) => {
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
            ...gesture.attributes,
            ondisconnect: () => gesture.cancel()
        } as Attributes,
        row: (row: T): Attributes => ({
            class: [
                () => read(held) && ui.effect === 'move' && sources.includes(row) && 'file-tree-row--dragged',
                () => mark(row)
            ],
            onpointerdown: (e: PointerEvent) => {
                if (gesture.busy() || row.locked || e.button !== 0 || !e.isPrimary) {
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
            }
        }),
        // Marks the segment of a compact row a drop lands in.
        segment: (row: T): Attributes => ({
            class: () => signal.selector(marks.folder, row.key) && 'file-tree-segment--drop'
        }),
        // The root carries the fold motion's inline styles, so the drop depth goes on the viewport instead.
        viewport: {
            class: [
                () => ui.effect && `file-tree-viewport--drag file-tree-viewport--drag-${ui.effect}`,
                () => read(marks.target) === -1 && 'file-tree-viewport--drop'
            ],
            style: () => ui.depth !== null && `--drop-depth: ${ui.depth}`
        } as Attributes
    };
};

export type { Drag, Drop };
