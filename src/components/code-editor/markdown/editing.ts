import { deleteCharacter } from '../commands';
import { EditorDocument, type Edit, type Selection } from '../document';
import { markdownBackspace, markdownEnter, toggleMarkdown, type Kind } from './model';


type Command = 'backspace' | 'bold' | 'enter' | 'italic';

// The kind of block at a source offset, from the caller's parse; without one the command parses for itself.
type KindAt = (offset: number) => Kind | undefined;


function run(document: EditorDocument, command: Command, kind?: KindAt) {
    if (command === 'bold' || command === 'italic') {
        return toggleMarkdown(document, command === 'bold' ? '**' : '*');
    }

    if (command === 'backspace') {
        return markdownBackspace(document) || deleteCharacter(document, true);
    }

    if (markdownEnter(document, kind?.(document.selection.start))) {
        return true;
    }

    let { end, start } = document.selection,
        eol = document.eol;

    return document.replace(start, end, eol, { selection: { start: start + eol.length }, source: 'markdown-enter' });
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
