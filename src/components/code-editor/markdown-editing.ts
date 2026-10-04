import { EditorDocument, type Edit, type Selection } from './document';
import { markdownEnter, markdownBackspace, toggleMarkdown } from './markdown-model';
import { deleteCharacter } from './commands';

/** Run source-aware Markdown commands at each range, then commit one history entry. */
export function markdownCommand(doc: EditorDocument, command: 'enter' | 'backspace' | 'bold' | 'italic') {
    if (doc.selections.length === 1) return run(doc, command);
    let edits: Edit[] = [], destinations: { selection: Selection; from: number }[] = [];
    for (let range of doc.selections) {
        let local = new EditorDocument(doc.value); local.select(range);
        let batches: readonly (readonly Edit[])[] = [];
        let stop = local.subscribe((_state, change) => { if (change.editBatches) batches = change.editBatches; });
        let accepted = run(local, command); stop();
        if (!accepted && command !== 'backspace') return false;
        let batch = batches.flat(); edits.push(...batch); destinations.push({ selection: local.selection, from: batch[0]?.from ?? range.start });
    }
    if (!edits.length) return false;
    let selections = destinations.map(item => {
        let shift = edits.filter(edit => edit.to <= item.from && edit.from < item.from).reduce((sum, edit) => sum + edit.insert.length - (edit.to - edit.from), 0);
        return { ...item.selection, start: item.selection.start + shift, end: item.selection.end + shift };
    });
    return doc.transact(edits, { source: `markdown-${command}`, selections });
}
function run(doc: EditorDocument, command: 'enter' | 'backspace' | 'bold' | 'italic') {
    if (command === 'bold' || command === 'italic') return toggleMarkdown(doc, command === 'bold' ? '**' : '*');
    if (command === 'backspace') return markdownBackspace(doc) || deleteCharacter(doc, true);
    if (markdownEnter(doc)) return true;
    let { start, end } = doc.selection, eol = /\r\n|\r|\n/.exec(doc.value)?.[0] ?? '\n';
    return doc.replace(start, end, eol, { source: 'markdown-enter', selection: { start: start + eol.length } });
}
