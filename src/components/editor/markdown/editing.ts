import { deleteCharacter } from '../code/commands';
import { EditorDocument, type Edit, type Selection } from '../code/document';
import { markdownBackspace, markdownEnter, toggleMarkdown, type Kind } from './model';


type Command = 'backspace' | 'bold' | 'enter' | 'italic';

// The kind of block at a source offset, from the caller's parse; without one the command parses for itself.
type KindAt = (offset: number) => Kind | undefined;


const FENCE = /^((?: {0,3}>[ \t]?)*) {0,3}(`{3,}|~{3,})[^`]*$/;


// Enter at the end of a fence's opening line, when nothing after it closes the fence, adds the closing line too.
function fence(document: EditorDocument) {
    let { end, start } = document.selection,
        index = document.lineAt(start),
        line = document.lineText(index),
        open = FENCE.exec(line);

    if (!open || start !== end || start !== document.lineStart(index) + line.length) {
        return false;
    }

    let marker = open[2],
        close = new RegExp(`^${open[1]} {0,3}${marker[0] === '`' ? '`' : '~'}{${marker.length},}[ \\t]*$`);

    for (let i = index + 1, n = document.lineCount; i < n; i++) {
        if (close.test(document.lineText(i))) {
            return false;
        }
    }

    let eol = document.eol;

    return document.replace(start, start, eol + open[1] + eol + open[1] + marker, {
        selection: { start: start + eol.length + open[1].length },
        source: 'markdown-enter'
    });
}

function run(document: EditorDocument, command: Command, kind?: KindAt) {
    if (command === 'bold' || command === 'italic') {
        return toggleMarkdown(document, command === 'bold' ? '**' : '*');
    }

    if (command === 'backspace') {
        return markdownBackspace(document) || deleteCharacter(document, true);
    }

    let at = kind?.(document.selection.start);

    if (markdownEnter(document, at) || fence(document)) {
        return true;
    }

    let { end, start } = document.selection,
        eol = document.eol,
        // A paragraph's line with text ends in a new paragraph; elsewhere Enter breaks the line.
        insert = at === 'paragraph' && document.lineText(document.lineAt(start)).trim() ? eol + eol : eol;

    return document.replace(start, end, insert, { selection: { start: start + insert.length }, source: 'markdown-enter' });
}


// Runs a source-aware command at every range and commits the edits as one history entry.
const markdownCommand = (document: EditorDocument, command: Command, kind?: KindAt) => {
    let ranges = document.selections;

    if (ranges.length === 1) {
        return run(document, command, kind);
    }

    let carets: { from: number; selection: Selection }[] = [],
        edits: Edit[] = [];

    for (let i = 0, n = ranges.length; i < n; i++) {
        let batches: readonly (readonly Edit[])[] = [],
            local = new EditorDocument(document.value);

        local.select(ranges[i]);

        let stop = local.subscribe((_, change) => {
                if (change.editBatches) {
                    batches = change.editBatches;
                }
            }),
            accepted = run(local, command, kind);

        stop();

        if (!accepted && command !== 'backspace') {
            return false;
        }

        let batch = batches.flat();

        for (let j = 0, m = batch.length; j < m; j++) {
            edits.push(batch[j]);
        }

        carets.push({ from: batch[0]?.from ?? ranges[i].start, selection: local.selection });
    }

    if (!edits.length) {
        return false;
    }

    let selections = carets.map(({ from, selection }) => {
        let shift = 0;

        for (let i = 0, n = edits.length; i < n; i++) {
            if (edits[i].to <= from && edits[i].from < from) {
                shift += edits[i].insert.length - (edits[i].to - edits[i].from);
            }
        }

        return { ...selection, end: selection.end + shift, start: selection.start + shift };
    });

    return document.transact(edits, { selections, source: `markdown-${command}` }).changed;
};


export { markdownCommand };
export type { Command, KindAt };
