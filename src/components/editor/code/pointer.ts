import { reactive } from '@esportsplus/reactivity';
import type { EditorDocument, Edit, Selection } from './document';
import type { Placeholder } from './projection';


type Host = {
    // True while an IME composition owns the field.
    busy: () => boolean;
    // Reads the native selection back into the document.
    capture: VoidFunction;
    document: EditorDocument;
    // Shows the drop caret at a source offset, or hides it.
    drop: (offset: number | null) => void;
    focus: VoidFunction;
    insert: (text: string) => boolean;
    offsetAt: (x: number, y: number) => number | null;
    // The fold placeholder under a client point.
    placeholder: (x: number, y: number) => Placeholder | null;
    readonly: () => boolean;
    // Client y of the middle of every visual row from one client y to another, inclusive.
    rows: (from: number, to: number) => number[];
    select: (ranges: readonly Partial<Selection>[], reveal?: boolean) => void;
    transact: (edits: Edit[], caret: number) => void;
    unfold: (placeholder: Placeholder) => void;
};


// Rectangular selections stop growing past this many rows.
const ROWS = 1000;


// Pointer gestures on the native field: Alt+click adds a caret, Alt+Shift+drag selects a rectangle (with pointer
// capture, so the gesture ends with its pointer however it leaves), a click on a fold placeholder unfolds it, and
// dragging a selection moves it, or copies it with a modifier.
const pointer = (host: Host) => {
    let anchor: { x: number; y: number } | null = null,
        dragging: { ranges: readonly Selection[]; revision: number; text: string } | null = null,
        state = reactive({ crosshair: false });

    function end() {
        anchor = null;
    }

    return {
        // Alt shows the crosshair cursor of Alt+click.
        alt: (e: KeyboardEvent | PointerEvent) => {
            state.crosshair = e.altKey;
        },
        end,
        ondragend: () => {
            dragging = null;
            host.drop(null);
        },
        ondragleave: () => {
            host.drop(null);
        },
        ondragover: (e: DragEvent) => {
            if (host.readonly()) {
                return;
            }

            e.preventDefault();
            host.drop(host.offsetAt(e.clientX, e.clientY));
        },
        ondragstart: (e: DragEvent) => {
            host.capture();

            let document = host.document,
                ranges = document.selections.filter((range) => range.start !== range.end);

            if (!ranges.length || !e.dataTransfer) {
                return;
            }

            let text = ranges.map((range) => document.value.slice(range.start, range.end)).join(document.eol);

            dragging = { ranges, revision: document.revision, text };
            e.dataTransfer.setData('text/plain', text);
            e.dataTransfer.effectAllowed = host.readonly() ? 'copy' : 'copyMove';
        },
        ondrop: (e: DragEvent) => {
            let offset = host.offsetAt(e.clientX, e.clientY),
                source = dragging,
                text = e.dataTransfer?.getData('text/plain');

            dragging = null;
            host.drop(null);

            if (host.readonly() || host.busy() || text === undefined || offset === null) {
                return;
            }

            e.preventDefault();

            if (!source || source.revision !== host.document.revision || e.ctrlKey || e.altKey || e.metaKey) {
                host.select([{ start: offset }], false);
                host.insert(text);
                return;
            }

            let at = offset,
                edits: Edit[] = [],
                shift = 0;

            for (let i = 0, n = source.ranges.length; i < n; i++) {
                let range = source.ranges[i];

                if (at >= range.start && at <= range.end) {
                    return;
                }

                edits.push({ from: range.start, insert: '', to: range.end });

                if (range.start < at) {
                    shift -= range.end - range.start;
                }
            }

            edits.push({ from: at, insert: source.text, to: at });
            host.transact(edits, at + shift + source.text.length);
        },
        onlostpointercapture: end,
        onpointercancel: end,
        onpointerdown: (e: PointerEvent) => {
            if (host.busy()) {
                return;
            }

            let placeholder = host.placeholder(e.clientX, e.clientY);

            if (placeholder) {
                e.preventDefault();
                host.unfold(placeholder);
                host.focus();
                return;
            }

            let document = host.document;

            if (!e.altKey) {
                if (document.selections.length > 1) {
                    host.select([document.selection], false);
                }

                return;
            }

            e.preventDefault();

            let offset = host.offsetAt(e.clientX, e.clientY);

            if (offset === null) {
                return;
            }

            if (e.shiftKey) {
                anchor = { x: e.clientX, y: e.clientY };
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                host.select([{ start: offset }], false);
            }
            else {
                host.select([...document.selections, { start: offset }], false);
            }

            host.focus();
        },
        onpointermove: (e: PointerEvent) => {
            state.crosshair = e.altKey;

            if (!anchor) {
                return;
            }

            e.preventDefault();

            let rows = host.rows(anchor.y, e.clientY),
                ranges: Partial<Selection>[] = [];

            for (let i = 0, n = Math.min(rows.length, ROWS); i < n; i++) {
                let end = host.offsetAt(e.clientX, rows[i]),
                    start = host.offsetAt(anchor.x, rows[i]);

                if (start !== null && end !== null) {
                    ranges.push({ direction: end < start ? 'backward' : 'forward', end, start });
                }
            }

            host.select(ranges, false);
        },
        reset: () => {
            anchor = null;
            state.crosshair = false;
        },
        state
    };
};


export { pointer };
