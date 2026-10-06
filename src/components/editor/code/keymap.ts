import { insertText, reindent, selectLine, toggleComment, transpose } from './commands';
import { pairAround, pairAt } from './folding';
import { commentSyntax, type Language, type SyntaxCache } from './syntax';
import type { EditorDocument, Selection } from './document';
import type { Controller, Options } from './view';


type Command =
    | 'addCursorAbove'
    | 'addCursorBelow'
    | 'autocomplete'
    | 'blankLine'
    | 'blockComment'
    | 'copyLineDown'
    | 'copyLineUp'
    | 'deleteCharacterBackward'
    | 'deleteCharacterForward'
    | 'deleteLine'
    | 'deleteLineEnd'
    | 'deleteWordBackward'
    | 'deleteWordForward'
    | 'find'
    | 'findNext'
    | 'findPrevious'
    | 'fold'
    | 'foldAll'
    | 'goToLine'
    | 'indent'
    | 'jumpToBracket'
    | 'lineEnd'
    | 'lineStart'
    | 'moveDown'
    | 'moveLeft'
    | 'moveLineDown'
    | 'moveLineUp'
    | 'moveRight'
    | 'moveUp'
    | 'nextOccurrence'
    | 'outdent'
    | 'pageDown'
    | 'pageUp'
    | 'redo'
    | 'redoSelection'
    | 'reindent'
    | 'replace'
    | 'save'
    | 'selectAll'
    | 'selectAllOccurrences'
    | 'selectLine'
    | 'selectPair'
    | 'splitLine'
    | 'toggleComment'
    | 'toggleTabCapture'
    | 'transpose'
    | 'undo'
    | 'undoSelection'
    | 'unfold'
    | 'unfoldAll'
    | 'wordLeft'
    | 'wordRight';

// What the actions reach in the editor.
type Host = {
    cache: () => SyntaxCache;
    // Reads the native selection back into the document.
    capture: VoidFunction;
    controller: Controller;
    // Deletes a character or word at every caret; next to a fold placeholder it unfolds instead.
    deleteVisible: (backwards: boolean, word: boolean) => boolean;
    document: EditorDocument;
    // Applies a document edit like any command: revealed, recorded and synced.
    edit: (run: () => boolean) => boolean;
    language: () => Language;
    move: (key: string, extend: boolean, word?: boolean, add?: boolean) => void;
    options: () => Options;
    select: (selection: Partial<Selection>) => void;
};

// 'Mod' is ⌘ on Apple platforms and Ctrl elsewhere; 'Ctrl' is the literal Control key, which only Apple keyboards
// tell apart. Modifiers are written in this order: Mod, Ctrl, Alt, Shift.
type Binding = [keys: string, command: Command, apple?: boolean];


const ACTIONS: Record<Command, (host: Host, e: KeyboardEvent) => void> = {
    addCursorAbove: (host) => host.move('ArrowUp', false, false, true),
    addCursorBelow: (host) => host.move('ArrowDown', false, false, true),
    autocomplete: (host) => host.options().onAutocomplete?.(host.controller, true),
    blankLine: (host) => host.controller.lineCommand('blank'),
    blockComment: (host) => host.edit(() => {
        let block = host.options().blockComment ?? commentSyntax(host.language()).block ?? ['/*', '*/'];

        return toggleComment(host.document, false, block);
    }),
    copyLineDown: (host) => host.controller.lineCommand('copyDown'),
    copyLineUp: (host) => host.controller.lineCommand('copyUp'),
    deleteCharacterBackward: (host) => host.edit(() => host.deleteVisible(true, false)),
    deleteCharacterForward: (host) => host.edit(() => host.deleteVisible(false, false)),
    deleteLine: (host) => host.controller.lineCommand('delete'),
    deleteLineEnd: ({ document, edit }) => edit(() => {
        document.selectMany(document.selections.map((range) => ({ end: document.lineEnd(document.lineAt(range.end)), start: range.end })));

        return insertText(document, '', 'deleteLineEnd');
    }),
    deleteWordBackward: (host) => host.edit(() => host.deleteVisible(true, true)),
    deleteWordForward: (host) => host.edit(() => host.deleteVisible(false, true)),
    find: (host) => host.controller.openFind(),
    findNext: (host) => host.controller.findNext(),
    findPrevious: (host) => host.controller.findPrevious(),
    fold: (host) => host.controller.fold(),
    foldAll: (host) => host.controller.foldAll(),
    goToLine: (host) => host.controller.openGoToLine(),
    indent: (host) => host.controller.indent(),
    jumpToBracket: ({ cache, document, select }) => {
        let caret = document.selection.end,
            pair = pairAt(cache(), caret);

        if (pair) {
            select({ start: caret <= pair.from + 1 ? pair.to + 1 : pair.from });
        }
    },
    lineEnd: (host, e) => host.move('End', e.shiftKey),
    lineStart: (host, e) => host.move('Home', e.shiftKey),
    moveDown: (host, e) => host.move('ArrowDown', e.shiftKey),
    moveLeft: (host, e) => host.move('ArrowLeft', e.shiftKey),
    moveLineDown: (host) => host.controller.lineCommand('moveDown'),
    moveLineUp: (host) => host.controller.lineCommand('moveUp'),
    moveRight: (host, e) => host.move('ArrowRight', e.shiftKey),
    moveUp: (host, e) => host.move('ArrowUp', e.shiftKey),
    nextOccurrence: (host) => host.controller.addNextOccurrence(),
    outdent: (host) => host.controller.outdent(),
    pageDown: (host, e) => host.move('PageDown', e.shiftKey),
    pageUp: (host, e) => host.move('PageUp', e.shiftKey),
    redo: (host) => host.controller.redo(),
    redoSelection: (host) => host.controller.redoSelection(),
    reindent: (host) => host.edit(() => reindent(host.document, host.language(), host.options().indent)),
    replace: (host) => host.controller.openFind(true),
    save: (host) => host.controller.save(),
    selectAll: (host) => host.select({ end: host.document.value.length, start: 0 }),
    selectAllOccurrences: (host) => host.controller.addNextOccurrence(true),
    selectLine: (host) => {
        host.capture();
        selectLine(host.document);
        host.select(host.document.selection);
    },
    selectPair: ({ cache, document, select }) => {
        let range = document.selection,
            pair = pairAround(cache(), range.start, range.end);

        if (pair) {
            select({ end: pair.to + 1, start: pair.from });
        }
    },
    splitLine: ({ document, edit }) => edit(() => {
        let ranges = document.selections,
            changed = insertText(document, document.eol, 'splitLine');

        document.selectMany(ranges);

        return changed;
    }),
    toggleComment: (host) => host.controller.toggleComment(),
    toggleTabCapture: (host) => {
        let options = host.options();

        options.captureTab = options.captureTab === false;
    },
    transpose: (host) => host.edit(() => transpose(host.document)),
    undo: (host) => host.controller.undo(),
    undoSelection: (host) => host.controller.undoSelection(),
    unfold: (host) => host.controller.unfold(),
    unfoldAll: (host) => host.controller.unfoldAll(),
    wordLeft: (host, e) => host.move('ArrowLeft', e.shiftKey, true),
    wordRight: (host, e) => host.move('ArrowRight', e.shiftKey, true)
};

const BINDINGS: Binding[] = [
    ['Alt+ArrowDown', 'moveLineDown'],
    ['Alt+ArrowLeft', 'wordLeft'],
    ['Alt+ArrowRight', 'wordRight'],
    ['Alt+ArrowUp', 'moveLineUp'],
    ['Alt+Shift+a', 'blockComment'],
    ['Alt+Shift+ArrowDown', 'copyLineDown'],
    ['Alt+Shift+ArrowUp', 'copyLineUp'],
    ['Alt+`', 'autocomplete', true],
    ['Alt+i', 'autocomplete', true],
    ['Alt+l', 'selectLine'],
    ['Alt+u', 'redoSelection'],
    ['Alt+v', 'pageUp', true],
    ['Ctrl+a', 'lineStart', true],
    ['Ctrl+Alt+[', 'foldAll'],
    ['Ctrl+Alt+]', 'unfoldAll'],
    ['Ctrl+Alt+d', 'deleteWordForward', true],
    ['Ctrl+Alt+h', 'deleteWordBackward', true],
    ['Ctrl+b', 'moveLeft', true],
    ['Ctrl+d', 'deleteCharacterForward', true],
    ['Ctrl+e', 'lineEnd', true],
    ['Ctrl+f', 'moveRight', true],
    ['Ctrl+h', 'deleteCharacterBackward', true],
    ['Ctrl+k', 'deleteLineEnd', true],
    ['Ctrl+l', 'selectLine', true],
    ['Ctrl+m', 'toggleTabCapture'],
    ['Ctrl+n', 'moveDown', true],
    ['Ctrl+o', 'splitLine', true],
    ['Ctrl+p', 'moveUp', true],
    ['Ctrl+Shift+a', 'blockComment', true],
    ['Ctrl+t', 'transpose', true],
    ['Ctrl+v', 'pageDown', true],
    ['F3', 'findNext'],
    ['Mod+/', 'toggleComment'],
    ['Mod+Alt+ArrowDown', 'addCursorBelow'],
    ['Mod+Alt+ArrowUp', 'addCursorAbove'],
    ['Mod+Alt+[', 'fold', true],
    ['Mod+Alt+\\', 'reindent'],
    ['Mod+Alt+]', 'unfold', true],
    ['Mod+Alt+g', 'goToLine'],
    ['Mod+Enter', 'blankLine'],
    ['Mod+Shift+[', 'fold'],
    ['Mod+Shift+\\', 'jumpToBracket'],
    ['Mod+Shift+]', 'unfold'],
    ['Mod+Shift+a', 'selectAllOccurrences'],
    ['Mod+Shift+g', 'findPrevious'],
    ['Mod+Shift+k', 'deleteLine'],
    ['Mod+Shift+l', 'selectAllOccurrences'],
    ['Mod+Shift+u', 'redoSelection'],
    ['Mod+Shift+z', 'redo'],
    ['Mod+[', 'outdent'],
    ['Mod+]', 'indent'],
    ['Mod+a', 'selectAll'],
    ['Mod+d', 'nextOccurrence'],
    ['Mod+f', 'find'],
    ['Mod+g', 'findNext'],
    ['Mod+h', 'replace'],
    ['Mod+i', 'selectPair'],
    ['Mod+s', 'save'],
    ['Mod+u', 'undoSelection'],
    ['Mod+y', 'redo'],
    ['Mod+z', 'undo'],
    ['Shift+F3', 'findPrevious']
];

// Shift changes the character a punctuation key types ('[' becomes '{'), so these name the key itself.
const CODES: Record<string, string> = {
    Backquote: '`',
    Backslash: '\\',
    BracketLeft: '[',
    BracketRight: ']',
    Slash: '/'
};

// Commands that extend the selection when Shift is added to their keys.
const EXTENDING = new Set<Command>([
    'lineEnd',
    'lineStart',
    'moveDown',
    'moveLeft',
    'moveRight',
    'moveUp',
    'pageDown',
    'pageUp',
    'wordLeft',
    'wordRight'
]);


// A keydown as a binding's keys.
function combo(e: KeyboardEvent, apple: boolean) {
    let key = CODES[e.code] ?? (e.key.length === 1 ? e.key.toLowerCase() : e.key),
        out = '';

    if (apple ? e.metaKey : e.ctrlKey) {
        out += 'Mod+';
    }

    if (apple && e.ctrlKey) {
        out += 'Ctrl+';
    }
    else if (!apple && e.metaKey) {
        out += 'Meta+';
    }

    if (e.altKey) {
        out += 'Alt+';
    }

    if (e.shiftKey) {
        out += 'Shift+';
    }

    return out + key;
}


// The command table for one platform: bindings marked for the other are left out, and elsewhere 'Ctrl' is 'Mod'.
const keymap = (apple: boolean) => {
    let map = new Map<string, Command>();

    for (let i = 0, n = BINDINGS.length; i < n; i++) {
        let [keys, command, platform] = BINDINGS[i];

        if (platform !== undefined && platform !== apple) {
            continue;
        }

        map.set(apple ? keys : keys.replace('Ctrl+', 'Mod+'), command);
    }

    return (e: KeyboardEvent) => {
        let keys = combo(e, apple),
            command = map.get(keys);

        if (command === undefined && e.shiftKey) {
            command = map.get(keys.replace('Shift+', ''));

            if (command !== undefined && !EXTENDING.has(command)) {
                command = undefined;
            }
        }

        return command ?? null;
    };
};


// Runs a command against the editor.
const commands = (host: Host) => (command: Command, e: KeyboardEvent) => {
    ACTIONS[command](host, e);
};


export { combo, commands, keymap };
export type { Command, Host };
