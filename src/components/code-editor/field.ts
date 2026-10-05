type NativeEdit = { from: number; insert: string; to: number };

// Native edits of the model's last change, against the field text they apply to.
type Pending = { base: string; edits: NativeEdit[] };


// At most this many native edits go in one by one; more are written as one covering range.
const RANGES = 8;

// A covering replacement larger than this share of the text is written whole.
const SHARE = 0.5;


// The range two texts differ in, by binary search over slices so the comparisons run as native memcmp.
function difference(a: string, b: string): NativeEdit {
    let hi = Math.min(a.length, b.length),
        lo = 0;

    while (lo < hi) {
        let mid = (lo + hi + 1) >>> 1;

        if (a.slice(lo, mid) === b.slice(lo, mid)) {
            lo = mid;
        }
        else {
            hi = mid - 1;
        }
    }

    let prefix = lo;

    hi = Math.min(a.length, b.length) - prefix;
    lo = 0;

    while (lo < hi) {
        let mid = (lo + hi + 1) >>> 1;

        if (a.slice(a.length - mid, a.length - lo) === b.slice(b.length - mid, b.length - lo)) {
            lo = mid;
        }
        else {
            hi = mid - 1;
        }
    }

    return { from: prefix, insert: b.slice(prefix, b.length - lo), to: a.length - lo };
}


// Brings a focused textarea from 'written' to 'value'. Edits go in through 'insertText', which Chrome lays out
// incrementally; assigning the value lays out all of it again, a quarter second for 50k lines. That fallback is left
// for unfocused fields, which 'insertText' can't reach, and for rewrites of most of the text. The field fires 'input'
// for each edit, so the caller ignores input while this runs.
const write = (field: HTMLTextAreaElement, written: string, value: string, pending: Pending | null) => {
    let focused = field.ownerDocument.activeElement === field,
        edits: NativeEdit[] | null = null,
        verify = false;

    if (pending && pending.base === written && pending.edits.length <= RANGES) {
        edits = pending.edits;
        verify = edits.length > 1;
    }
    else if (written && focused) {
        let range = difference(written, value);

        edits = range.to - range.from + range.insert.length <= value.length * SHARE ? [range] : null;
    }

    if (!edits || !focused) {
        field.value = value;
        return;
    }

    for (let i = edits.length - 1; i >= 0; i--) {
        let edit = edits[i];

        if (edit.from === edit.to && !edit.insert) {
            continue;
        }

        field.setSelectionRange(edit.from, edit.to);

        if (!field.ownerDocument.execCommand(edit.insert ? 'insertText' : 'delete', false, edit.insert)) {
            verify = true;
            break;
        }
    }

    if (field.textLength !== value.length || (verify && field.value !== value)) {
        field.value = value;
    }
};


export { difference, RANGES, write };
export type { NativeEdit, Pending };
