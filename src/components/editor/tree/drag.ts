import { peek, reactive, read, signal, write, type Signal } from '@esportsplus/reactivity';
import { html, type Attributes } from '@esportsplus/template';
import press from '~/shared/press';
import { attach, collect, type Export, type ImportEntry } from './transfer';


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

type Handlers<E> = {
    drag?: Drag<E>;
    export?: (element: E) => Export | null;
    import?: (target: E | null, entries: readonly ImportEntry[]) => void | Promise<void>;
};

// What's being dragged: rows by a press, rows by the browser's own drag on their way out, or files from outside.
type Mode = '' | 'files' | 'native' | 'pointer';

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

// The browser repeats 'dragover' at least this often while a drag stays over the viewport, even holding still; past
// it the drag has left without a 'dragleave' saying so, which some browsers skip.
const STALE = 600;


// Pointer events rather than native drag and drop for moves within the tree: the rows are virtualized, so the pressed
// row can scroll out of the DOM mid-drag, taking a native drag's source and events with it; the viewport holds the
// pointer instead, and the feedback, Alt copy, auto-scroll and touch all stay in the tree's hands. Native drag and
// drop comes in only where the OS is at the other end: files dropped in, and, given 'export', rows dragged out by a
// mouse, which then move within the tree the native way too, since one drag can't be both.
export default <T extends Row<T>>({ drag, export: give, import: take }: Handlers<T['element']>, tree: Tree<T>) => {
    let carry = 0,
        copy = false,
        frame = 0,
        gesture = press(DELAY),
        ghost: HTMLElement | undefined,
        // Whether a drag is under way; every row reads it, so only a drag's start and end re-render them all.
        held = signal(false),
        list: T[] = [],
        // 'target' is the key of the drop folder's row, -1 for the top level, and 'folder' the folder's own, which
        // differs for a segment of a compact row; 'last' is the key of the last row in the target's box. Rows and
        // segments test their own keys alone, so a new target re-renders the rows of the boxes it leaves and enters.
        marks = { folder: signal(0), last: signal(0), target: signal(0) },
        mode: Mode = '',
        opening: ReturnType<typeof setTimeout> | undefined,
        pointer = 0,
        // When a native drag last passed over the viewport.
        seen = 0,
        sources = new Set<T>(),
        // A folder, null for the top level, undefined when a release would drop nothing.
        target: T | null | undefined,
        time = 0,
        // 'depth' is the target box's depth and 'x'/'y' where the ghost sits.
        ui = reactive({ count: 0, depth: null as number | null, effect: '' as Effect, label: '', x: 0, y: 0 }),
        x = 0,
        y = 0;

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

    // Files from outside go anywhere unlocked; rows only where they'd move or be copied, never into themselves.
    function allowed(folder: T | null) {
        if (folder === null ? !tree.top : folder.locked) {
            return false;
        }

        if (mode === 'files') {
            return true;
        }

        if (!drag) {
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

    // Reports the rows dropped on 'folder', once confirmed.
    async function deliver(folder: T | null, rows: T[], copied: boolean) {
        if (!drag) {
            return;
        }

        let result = { copy: copied, elements: rows.map((row) => row.element), target: folder?.element ?? null };

        if (!drag.confirm || await drag.confirm(result)) {
            drag.drop(result);
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

    // The rows a press or a native drag on 'row' takes along; a row inside another dragged folder travels with it.
    function grabbed(row: T) {
        let grabbed = tree.grab(row),
            lookup = new Set(grabbed),
            out: T[] = [];

        for (let i = 0, n = grabbed.length; i < n; i++) {
            let item = grabbed[i],
                inside = item.locked;

            for (let node = item.parent; node && !inside; node = node.parent) {
                inside = lookup.has(node);
            }

            if (!inside) {
                out.push(item);
            }
        }

        return out;
    }

    // A native drag left the viewport: files from outside are done with, while rows dragged out may come back.
    function leave() {
        if (mode === 'files') {
            stop();
            return;
        }

        cancelAnimationFrame(frame);
        frame = 0;
        x = y = NaN;
        aim();
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

    // 'dragenter' and 'dragover' alike: a native drag over the viewport aims as a press does, and files from outside
    // start a drag of their own when there's somewhere to import them.
    function over(e: DragEvent) {
        let transfer = e.dataTransfer;

        if (!transfer || mode === 'pointer') {
            return;
        }

        if (!mode) {
            if (!take || !transfer.types.includes('Files')) {
                return;
            }

            start([], 'files');
        }

        e.preventDefault();
        copy = mode === 'files' || e.altKey;
        seen = performance.now();
        x = e.clientX;
        y = e.clientY;
        aim();
        transfer.dropEffect = ui.effect || 'none';

        if (!frame) {
            time = 0;
            frame = requestAnimationFrame(tick);
        }
    }

    function place() {
        ui.x = x;
        ui.y = y;
    }

    function pressed(rows: T[], e: PointerEvent) {
        let cancelled = false,
            // Captured, ahead of the tree's own keys; only while this press lasts.
            keys = new AbortController();

        // Drops on the target it was released over, unless it was cancelled or never got going.
        function end(e: PointerEvent | null) {
            let folder = mode === 'pointer' && e?.type === 'pointerup' ? target : undefined,
                copied = copy;

            keys.abort();
            stop();

            if (folder !== undefined) {
                void deliver(folder, rows, copied);
            }
        }

        function key(e: KeyboardEvent) {
            if (mode !== 'pointer') {
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

            if (mode === 'pointer') {
                place();
                aim();
            }
        }

        copy = e.altKey;
        pointer = e.pointerId;
        x = e.clientX;
        y = e.clientY;

        gesture.begin(e, {
            end,
            move,
            start: () => {
                start(rows, 'pointer');

                // Held by the viewport, so the pointer stays with the drag once the pressed row scrolls out of the DOM.
                tree.viewport()?.setPointerCapture(pointer);
                ghost?.showPopover();
                place();
                aim();

                time = 0;
                frame = requestAnimationFrame(tick);
            }
        });
        document.addEventListener('keydown', key, { capture: true, signal: keys.signal });
        document.addEventListener('keyup', key, { capture: true, signal: keys.signal });
    }

    function start(rows: T[], value: Mode) {
        list = rows;
        mode = value;
        sources = new Set(rows);
        ui.count = rows.length;
        ui.label = rows[0]?.element.name ?? '';
        write(held, true);
    }

    function stop() {
        let viewport = tree.viewport();

        cancelAnimationFrame(frame);
        clearTimeout(opening);

        if (ghost?.matches(':popover-open')) {
            ghost.hidePopover();
        }

        if (mode === 'pointer' && viewport?.hasPointerCapture(pointer)) {
            viewport.releasePointerCapture(pointer);
        }

        carry = 0;
        copy = false;
        frame = 0;
        list = [];
        mode = '';
        sources = new Set();
        target = undefined;
        ui.depth = null;
        ui.effect = '';
        write(held, false);
        write(marks.folder, 0);
        write(marks.last, 0);
        write(marks.target, 0);
    }

    function tick(now: number) {
        if (mode !== 'pointer' && performance.now() - seen > STALE) {
            frame = 0;
            leave();
            return;
        }

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
            ondisconnect: () => {
                gesture.cancel();

                if (mode) {
                    stop();
                }
            }
        } as Attributes,
        row: (row: T): Attributes => ({
            class: [
                () => read(held) && ui.effect === 'move' && sources.has(row) && 'file-tree-row--dragged',
                () => mark(row)
            ],
            // A mouse drags a row out natively; touch keeps to the press, which a native drag would cut short.
            ...(give && !row.locked && {
                draggable: 'true',
                ondragstart: (e: DragEvent) => {
                    let transfer = e.dataTransfer,
                        rows = transfer && !gesture.busy() ? grabbed(row) : [],
                        files: Export[] = [];

                    for (let i = 0, n = rows.length; i < n; i++) {
                        let file = give(rows[i].element);

                        if (file) {
                            files.push(file);
                        }
                    }

                    if (!transfer || !rows.length || (!drag && !files.length)) {
                        e.preventDefault();
                        return;
                    }

                    transfer.effectAllowed = drag ? 'copyMove' : 'copy';
                    attach(transfer, files.length ? files : rows.map((row) => ({ name: row.element.name })));

                    // Straight on the row rather than through the template: the row may have scrolled out of the
                    // DOM by the time the drag ends, and a detached node's events never reach the document.
                    (e.currentTarget as HTMLElement).addEventListener('dragend', () => {
                        if (mode === 'native') {
                            stop();
                        }
                    }, { once: true });

                    start(rows, 'native');
                }
            }),
            onpointerdown: (e: PointerEvent) => {
                let mouse = e.pointerType !== 'touch';

                // Text in a rename field inside the row selects with the mouse rather than dragging the row.
                if (give && !row.locked) {
                    (e.currentTarget as HTMLElement).draggable = mouse && !(e.target as HTMLElement).closest('input, textarea, [contenteditable]');
                }

                if (!drag || (give && mouse) || gesture.busy() || row.locked || e.button !== 0 || !e.isPrimary) {
                    return;
                }

                let rows = grabbed(row);

                if (rows.length) {
                    pressed(rows, e);
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
            ondragenter: over,
            ondragleave: (e: DragEvent) => {
                if (mode !== 'files' && mode !== 'native') {
                    return;
                }

                let viewport = tree.viewport();

                if (!viewport) {
                    return;
                }

                // Safari leaves 'relatedTarget' empty, so moving between rows would read as leaving; the point the
                // drag left at tells instead, and the stale check catches a leave through the viewport's edge.
                if (e.relatedTarget instanceof Node) {
                    if (viewport.contains(e.relatedTarget)) {
                        return;
                    }
                }
                else {
                    let bounds = viewport.getBoundingClientRect();

                    if (e.clientX > bounds.left && e.clientX < bounds.right - 1 && e.clientY > bounds.top && e.clientY < bounds.bottom - 1) {
                        return;
                    }
                }

                leave();
            },
            ondragover: over,
            ondrop: async (e: DragEvent) => {
                if (mode !== 'files' && mode !== 'native') {
                    return;
                }

                e.preventDefault();
                copy = mode === 'files' || e.altKey;
                x = e.clientX;
                y = e.clientY;
                aim();

                let copied = copy,
                    folder = target,
                    // Read now, while the drop's data lasts.
                    pending = mode === 'files' ? collect(e.dataTransfer!) : null,
                    rows = list;

                stop();

                if (folder === undefined) {
                    return;
                }

                if (!pending) {
                    void deliver(folder, rows, copied);
                    return;
                }

                let entries = await pending;

                if (entries.length) {
                    void take!(folder?.element ?? null, entries);
                }
            },
            style: () => ui.depth !== null && `--drop-depth: ${ui.depth}`
        } as Attributes
    };
};

export type { Drag, Drop, Handlers };
