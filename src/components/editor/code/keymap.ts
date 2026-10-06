import { insertText, reindent, selectLine, toggleComment, transpose } from './commands';
import { pairAround, pairAt } from './folding';
import { commentSyntax, type Language, type SyntaxCache } from './syntax';
import type { EditorDocument, Selection } from './document';
import type { CodeController, Controller, Options } from './view';


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
    | 'nextChange'
    | 'nextConflict'
    | 'nextOccurrence'
    | 'nextProblem'
    | 'outdent'
    | 'pageDown'
    | 'pageUp'
    | 'previousChange'
    | 'previousConflict'
    | 'previousProblem'
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

// A command's entry for keybinding editors: its default keys, written as in 'Binding'.
type CommandInfo = { id: Command; keys: readonly string[]; label: string };

// What the actions reach in the editor.
type Host = {
    cache: () => SyntaxCache;
    // Reads the native selection back into the document.
    capture: VoidFunction;
    controller: CodeController | Controller;
    // Deletes a character or word at every caret; next to a fold placeholder it unfolds instead.
    deleteVisible: (backwards: boolean, word: boolean) => boolean;
    document: EditorDocument;
    // Applies a document edit like any command: revealed, recorded and synced.
    edit: (run: () => boolean) => boolean;
    language: () => Language;
    move: (key: string, extend: boolean, word?: boolean, add?: boolean) => void;
    // Moves to the next or previous change, conflict or problem; editors without them leave it out.
    navigate?: (kind: Navigation, backward: boolean) => void;
    options: () => Options;
    select: (selection: Partial<Selection>) => void;
};

type Navigation = 'change' | 'conflict' | 'problem';

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
    nextChange: (host) => host.navigate?.('change', false),
    nextConflict: (host) => host.navigate?.('conflict', false),
    nextOccurrence: (host) => host.controller.addNextOccurrence(),
    nextProblem: (host) => host.navigate?.('problem', false),
    outdent: (host) => host.controller.outdent(),
    pageDown: (host, e) => host.move('PageDown', e.shiftKey),
    pageUp: (host, e) => host.move('PageUp', e.shiftKey),
    previousChange: (host) => host.navigate?.('change', true),
    previousConflict: (host) => host.navigate?.('conflict', true),
    previousProblem: (host) => host.navigate?.('problem', true),
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
    ['Alt+F5', 'nextChange'],
    ['Alt+F8', 'nextConflict'],
    ['Alt+Shift+a', 'blockComment'],
    ['Alt+Shift+ArrowDown', 'copyLineDown'],
    ['Alt+Shift+ArrowUp', 'copyLineUp'],
    ['Alt+Shift+F5', 'previousChange'],
    ['Alt+Shift+F8', 'previousConflict'],
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
    ['F8', 'nextProblem'],
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
    ['Shift+F3', 'findPrevious'],
    ['Shift+F8', 'previousProblem']
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

// Key names a chord may spell another way, lowercased.
const KEYS: Record<string, string> = {
    arrowdown: 'ArrowDown',
    arrowleft: 'ArrowLeft',
    arrowright: 'ArrowRight',
    arrowup: 'ArrowUp',
    backspace: 'Backspace',
    del: 'Delete',
    delete: 'Delete',
    down: 'ArrowDown',
    end: 'End',
    enter: 'Enter',
    esc: 'Escape',
    escape: 'Escape',
    home: 'Home',
    insert: 'Insert',
    left: 'ArrowLeft',
    pagedown: 'PageDown',
    pageup: 'PageUp',
    return: 'Enter',
    right: 'ArrowRight',
    space: ' ',
    tab: 'Tab',
    up: 'ArrowUp'
};

const LABELS: Record<Command, string> = {
    addCursorAbove: 'Add cursor above',
    addCursorBelow: 'Add cursor below',
    autocomplete: 'Trigger completion',
    blankLine: 'Insert line below',
    blockComment: 'Toggle block comment',
    copyLineDown: 'Copy line down',
    copyLineUp: 'Copy line up',
    deleteCharacterBackward: 'Delete character before',
    deleteCharacterForward: 'Delete character after',
    deleteLine: 'Delete line',
    deleteLineEnd: 'Delete to line end',
    deleteWordBackward: 'Delete word before',
    deleteWordForward: 'Delete word after',
    find: 'Find',
    findNext: 'Find next',
    findPrevious: 'Find previous',
    fold: 'Fold',
    foldAll: 'Fold all',
    goToLine: 'Go to line',
    indent: 'Indent line',
    jumpToBracket: 'Go to bracket',
    lineEnd: 'Go to line end',
    lineStart: 'Go to line start',
    moveDown: 'Cursor down',
    moveLeft: 'Cursor left',
    moveLineDown: 'Move line down',
    moveLineUp: 'Move line up',
    moveRight: 'Cursor right',
    moveUp: 'Cursor up',
    nextChange: 'Go to next change',
    nextConflict: 'Go to next conflict',
    nextOccurrence: 'Add next occurrence',
    nextProblem: 'Go to next problem',
    outdent: 'Outdent line',
    pageDown: 'Page down',
    pageUp: 'Page up',
    previousChange: 'Go to previous change',
    previousConflict: 'Go to previous conflict',
    previousProblem: 'Go to previous problem',
    redo: 'Redo',
    redoSelection: 'Redo cursor',
    reindent: 'Reindent lines',
    replace: 'Replace',
    save: 'Save',
    selectAll: 'Select all',
    selectAllOccurrences: 'Select all occurrences',
    selectLine: 'Select line',
    selectPair: 'Select to bracket',
    splitLine: 'Split line',
    toggleComment: 'Toggle line comment',
    toggleTabCapture: 'Toggle Tab moving focus',
    transpose: 'Transpose characters',
    undo: 'Undo',
    undoSelection: 'Undo cursor',
    unfold: 'Unfold',
    unfoldAll: 'Unfold all',
    wordLeft: 'Cursor word left',
    wordRight: 'Cursor word right'
};

// Modifier names a chord may use, lowercased; 'cmd' is the Apple key, which is 'Meta' elsewhere.
const MODIFIERS: Record<string, string> = {
    alt: 'Alt',
    cmd: 'Cmd',
    command: 'Cmd',
    control: 'Ctrl',
    ctrl: 'Ctrl',
    meta: 'Meta',
    mod: 'Mod',
    opt: 'Alt',
    option: 'Alt',
    shift: 'Shift'
};

// Modifiers in the order 'combo' writes them.
const ORDER = ['Mod', 'Ctrl', 'Meta', 'Alt', 'Shift'];


// A chord as 'combo' writes one for this platform: modifiers spelled and ordered its way and a character key
// lowercased; on Apple platforms ⌘ is 'Mod', elsewhere Ctrl is. Null for a chord that doesn't parse.
function chord(keys: string, apple: boolean) {
    let parts = keys.split('+'),
        key = parts.pop() ?? '',
        found = new Set<string>();

    // A chord on the plus key itself ends in an empty part.
    if (!key && parts.length && parts[parts.length - 1] === '') {
        parts.pop();
        key = '+';
    }

    for (let i = 0, n = parts.length; i < n; i++) {
        let name = MODIFIERS[parts[i].trim().toLowerCase()];

        if (!name) {
            return null;
        }

        if (name === 'Cmd' || name === 'Meta') {
            name = apple ? 'Mod' : 'Meta';
        }
        else if (name === 'Ctrl' && !apple) {
            name = 'Mod';
        }

        found.add(name);
    }

    key = key.trim() || key;
    key = key.length === 1 ? key.toLowerCase() : KEYS[key.toLowerCase()] ?? (/^f\d{1,2}$/i.test(key) ? key.toUpperCase() : key);

    if (!key) {
        return null;
    }

    return ORDER.filter((name) => found.has(name)).map((name) => name + '+').join('') + key;
}

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
// 'overrides' go over the defaults: a chord runs its command, or with null nothing at all; chords that don't parse
// and unknown commands are ignored.
const keymap = (apple: boolean, overrides?: Readonly<Record<string, Command | null>>) => {
    let map = new Map<string, Command | null>();

    for (let i = 0, n = BINDINGS.length; i < n; i++) {
        let [keys, command, platform] = BINDINGS[i];

        if (platform !== undefined && platform !== apple) {
            continue;
        }

        map.set(apple ? keys : keys.replace('Ctrl+', 'Mod+'), command);
    }

    for (let keys in overrides) {
        let command = overrides[keys],
            normalized = chord(keys, apple);

        if (normalized && (command === null || Object.hasOwn(ACTIONS, command))) {
            map.set(normalized, command);
        }
    }

    return (e: KeyboardEvent) => {
        let keys = combo(e, apple),
            command = map.get(keys);

        if (command === undefined && e.shiftKey) {
            command = map.get(keys.replace('Shift+', ''));

            if (command && !EXTENDING.has(command)) {
                command = undefined;
            }
        }

        return command ?? null;
    };
};


// Every command with its label and the keys it has on every platform, for keybinding editors.
const COMMANDS: readonly CommandInfo[] = (Object.keys(LABELS) as Command[]).map((id) => ({
    id,
    keys: BINDINGS.filter((binding) => binding[1] === id && binding[2] === undefined).map((binding) => binding[0]),
    label: LABELS[id]
}));

// Runs a command against the editor.
const commands = (host: Host) => (command: Command, e: KeyboardEvent) => {
    ACTIONS[command](host, e);
};


export { chord, combo, COMMANDS, commands, keymap };
export type { Command, CommandInfo, Host, Navigation };
