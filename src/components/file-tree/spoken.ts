import type { Decoration, Tone } from './decorations';


type Subject = {
    name: string;
    readonly?: boolean;
    root?: boolean;
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


// What the row is: "src, root folder, read-only".
function identity(subject: Subject) {
    return [
        subject.name,
        subject.root ? 'root folder' : '',
        subject.symlink ? 'symbolic link' : '',
        subject.readonly ? 'read-only' : ''
    ];
}

// What the name's color, the dot and the badges show, plus the problem counts the badge leaves out:
// "modified, 2 errors, unsaved".
function status(decoration: Decoration | undefined, lines: number[], inside: Tone | undefined) {
    let editor = decoration?.editor,
        words = [
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

    return words;
}


// The row's accessible name, which the tree announces through its active descendant: what it is, then its status,
// in the one name, so neither is said twice nor left to a description a reader may skip.
// "index.ts, modified, 2 errors, unsaved".
export default (subject: Subject, decoration?: Decoration, lines: number[] = [0, 0], inside?: Tone) => {
    return [...identity(subject), ...status(decoration, lines, inside)].filter(Boolean).join(', ');
};
