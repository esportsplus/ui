import type { Decoration, Tone } from './decorations';


type Subject = {
    name: string;
    readonly?: boolean;
    symlink?: boolean;
};


// A folder's dot, put into words. Deleted files reach their folders as changes, and ignored ones not at all.
const INSIDE: Partial<Record<Tone, string>> = {
    added: 'contains added files',
    conflict: 'contains conflicts',
    error: 'contains errors',
    modified: 'contains changes',
    warning: 'contains warnings'
};


function count(n: number | undefined, word: string) {
    return n ? `${n} ${word}${n === 1 ? '' : 's'}` : '';
}


// The row's accessible name, which the tree announces through its active descendant: what the name's color and the
// badge show, plus the problem counts the badge leaves out. "index.ts, modified, 2 errors, unsaved".
export default (subject: Subject, decoration?: Decoration, lines: number[] = [0, 0], inside?: Tone) => {
    let editor = decoration?.editor,
        words = [
            subject.name,
            subject.symlink ? 'symbolic link' : '',
            subject.readonly ? 'read-only' : '',
            decoration?.staged ? `staged ${decoration.staged}` : '',
            decoration?.status ?? '',
            decoration?.submodule ? 'submodule' : '',
            inside ? INSIDE[inside] ?? '' : '',
            count(decoration?.errors, 'error'),
            count(decoration?.warnings, 'warning'),
            count(lines[0], 'addition'),
            count(lines[1], 'deletion')
        ];

    for (let badge of decoration?.badges ?? []) {
        words.push(badge.tooltip ?? badge.text);
    }

    words.push(editor?.unsaved ? 'unsaved' : editor?.open ? 'open in editor' : '');

    return words.filter(Boolean).join(', ');
};
