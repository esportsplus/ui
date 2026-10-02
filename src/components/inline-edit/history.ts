import type { Doc, Selection } from './model';


type Entry = {
    doc: Doc;
    selection: Selection | null;
};

// Typing and deleting merge into one step while they continue from where the last one left off.
type Kind = 'delete' | 'other' | 'type';


const LIMIT = 200;

// Long enough to take a word typed at an even pace as one step, short enough that a pause starts the next.
const MERGE_WITHIN = 1000;


function equal(a: Selection | null, b: Selection | null) {
    return !!a && !!b
        && a.anchor.block === b.anchor.block
        && a.anchor.offset === b.anchor.offset
        && a.focus.block === b.focus.block
        && a.focus.offset === b.focus.offset;
}


export default () => {
    let last: { after: Selection | null, at: number, kind: Kind } = { after: null, at: 0, kind: 'other' },
        redo: Entry[] = [],
        undo: Entry[] = [];

    function step(from: Entry[], to: Entry[], current: Entry) {
        let entry = from.pop();

        if (entry) {
            to.push(current);
        }

        last = { after: null, at: 0, kind: 'other' };

        return entry ?? null;
    }

    return {
        clear: () => {
            last = { after: null, at: 0, kind: 'other' };
            redo.length = 0;
            undo.length = 0;
        },
        // 'before' is the document and selection the change started from, 'after' the selection it left.
        push: (before: Entry, after: Selection, kind: Kind) => {
            let now = Date.now();

            if (kind === 'other' || kind !== last.kind || now - last.at > MERGE_WITHIN || !equal(before.selection, last.after)) {
                undo.push(before);

                if (undo.length > LIMIT) {
                    undo.shift();
                }
            }

            last = { after, at: now, kind };
            redo.length = 0;
        },
        redo: (current: Entry) => step(redo, undo, current),
        undo: (current: Entry) => step(undo, redo, current)
    };
};

export type { Entry, Kind };
