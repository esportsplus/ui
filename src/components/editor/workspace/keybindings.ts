import { chord, combo, COMMANDS, type Command } from '../code/keymap';


type Builtin = [keys: string, command: Command, apple?: boolean];

type KeybindingRow = {
    // Keys the editor answers without its keymap, shown read-only; a chord another command takes is left out.
    builtin: string[];
    // The chords that run the command now, as 'chord' writes them; defaults first.
    chords: string[];
    id: Command;
    label: string;
    // Whether the user's keybindings change this command's keys.
    user: boolean;
};

// Chords over the default keys, as the code editor's 'keybindings' option takes them.
type Keybindings = Readonly<Record<string, Command | null>>;

type SequenceKey = Pick<KeyboardEvent, 'altKey' | 'code' | 'ctrlKey' | 'isComposing' | 'key' | 'metaKey' | 'preventDefault' | 'shiftKey' | 'stopPropagation' | 'target'>;

type SequenceOptions = {
    // Whether a first chord belongs to this sequence's owner, such as a keydown inside the workspace.
    accept: (e: SequenceKey) => boolean;
    // Second chords, as 'combo' writes them, to what they run.
    actions: Readonly<Record<string, VoidFunction>>;
    apple: boolean;
    onpending?: (pending: boolean) => void;
    prefix: string;
    timeout?: number;
};


const APPLE_ORDER = ['Ctrl', 'Alt', 'Shift', 'Mod'];

const ARROWS: Record<string, string> = {
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    ArrowUp: '↑'
};

// Keys the editor handles natively (the textarea, cursor movement, completion) or binds on one platform only, so
// they aren't among the keymap's shared defaults.
const BUILTIN: Builtin[] = [
    ['Alt+Backspace', 'deleteWordBackward', true],
    ['Alt+Delete', 'deleteWordForward', true],
    ['Alt+`', 'autocomplete', true],
    ['Alt+i', 'autocomplete', true],
    ['Alt+v', 'pageUp', true],
    ['ArrowDown', 'moveDown'],
    ['ArrowLeft', 'moveLeft'],
    ['ArrowRight', 'moveRight'],
    ['ArrowUp', 'moveUp'],
    ['Backspace', 'deleteCharacterBackward'],
    ['Ctrl+a', 'lineStart', true],
    ['Ctrl+Alt+d', 'deleteWordForward', true],
    ['Ctrl+Alt+h', 'deleteWordBackward', true],
    ['Ctrl+b', 'moveLeft', true],
    ['Ctrl+d', 'deleteCharacterForward', true],
    ['Ctrl+e', 'lineEnd', true],
    ['Ctrl+f', 'moveRight', true],
    ['Ctrl+h', 'deleteCharacterBackward', true],
    ['Ctrl+k', 'deleteLineEnd', true],
    ['Ctrl+n', 'moveDown', true],
    ['Ctrl+o', 'splitLine', true],
    ['Ctrl+p', 'moveUp', true],
    ['Ctrl+t', 'transpose', true],
    ['Ctrl+v', 'pageDown', true],
    ['Delete', 'deleteCharacterForward'],
    ['End', 'lineEnd'],
    ['Home', 'lineStart'],
    ['Mod+ArrowLeft', 'lineStart', true],
    ['Mod+ArrowRight', 'lineEnd', true],
    ['Mod+Backspace', 'deleteWordBackward', false],
    ['Mod+Delete', 'deleteWordForward', false],
    ['Mod+Space', 'autocomplete'],
    ['PageDown', 'pageDown'],
    ['PageUp', 'pageUp']
];

const GLYPHS: Record<string, string> = {
    Alt: '⌥',
    Ctrl: '⌃',
    Mod: '⌘',
    Shift: '⇧'
};

const IDS = new Set<string>(COMMANDS.map((command) => command.id));

const MODIFIER_KEYS = new Set(['Alt', 'AltGraph', 'Control', 'Meta', 'OS', 'Shift']);

const ORDER = ['Mod', 'Ctrl', 'Meta', 'Alt', 'Shift'];

const SEQUENCE_TIMEOUT = 1500;

// The shortcut recorder reads punctuation from 'key', which Shift changes; the keymap names these keys unshifted.
const SHIFTED: Record<string, string> = {
    '?': '/',
    '{': '[',
    '|': '\\',
    '}': ']',
    '~': '`'
};

// Tokens are joined with '+' and the Plus key is itself '+', so tokens sit at every other match.
const TOKEN = /[^+]+|\+/g;


function builtins(apple: boolean) {
    let map = new Map<string, Command>();

    for (let i = 0, n = BUILTIN.length; i < n; i++) {
        let [keys, command, platform] = BUILTIN[i],
            normalized = chord(keys, apple);

        if (normalized && (platform === undefined || platform === apple)) {
            map.set(normalized, command);
        }
    }

    return map;
}

function defaults(apple: boolean) {
    let map = new Map<string, Command>();

    for (let i = 0, n = COMMANDS.length; i < n; i++) {
        let { id, keys } = COMMANDS[i];

        for (let j = 0, m = keys.length; j < m; j++) {
            let normalized = chord(keys[j], apple);

            if (normalized) {
                map.set(normalized, id);
            }
        }
    }

    return map;
}

// The user's keybindings with every chord as 'chord' writes it; later spellings of one chord win, as in the keymap.
function normalize(keybindings: Keybindings, apple: boolean) {
    let out: Record<string, Command | null> = {};

    for (let keys in keybindings) {
        let command = keybindings[keys],
            normalized = chord(keys, apple);

        if (normalized && (command === null || IDS.has(command))) {
            out[normalized] = command;
        }
    }

    return out;
}

// Drops overrides that say what the defaults already do.
function simplify(keybindings: Record<string, Command | null>, base: Map<string, Command>) {
    for (let keys in keybindings) {
        if (keybindings[keys] === (base.get(keys) ?? null)) {
            delete keybindings[keys];
        }
    }

    return keybindings;
}

function split(keys: string) {
    return (keys.match(TOKEN) ?? []).filter((_, i) => i % 2 === 0);
}

function table(keybindings: Keybindings, apple: boolean) {
    let map = new Map<string, Command | null>(defaults(apple)),
        user = normalize(keybindings, apple);

    for (let keys in user) {
        map.set(keys, user[keys]);
    }

    return map;
}

function unbind(keybindings: Record<string, Command | null>, base: Map<string, Command>, current: Map<string, Command | null>, command: Command) {
    for (let [keys, owner] of current) {
        if (owner !== command) {
            continue;
        }

        if (base.has(keys)) {
            keybindings[keys] = null;
        }
        else {
            delete keybindings[keys];
        }
    }
}


// Gives 'command' the one chord 'keys' in place of the ones it has; a command that held 'keys' loses it. A chord
// that doesn't parse changes nothing.
const bind = (keybindings: Keybindings, apple: boolean, command: Command, keys: string): Keybindings => {
    let base = defaults(apple),
        normalized = chord(keys, apple),
        next = normalize(keybindings, apple);

    if (!normalized) {
        return keybindings;
    }

    unbind(next, base, table(keybindings, apple), command);
    next[normalized] = command;

    return simplify(next, base);
};

// The other command 'keys' runs now, by the keymap or built in, or null when it runs none or 'command' itself.
const conflict = (keybindings: Keybindings, apple: boolean, command: Command, keys: string) => {
    let normalized = chord(keys, apple);

    if (!normalized) {
        return null;
    }

    let current = table(keybindings, apple),
        owner = current.has(normalized) ? current.get(normalized) : builtins(apple).get(normalized);

    return owner && owner !== command ? owner : null;
};

// An 'aria-keyshortcuts' value with 'keys' added in both its Control and Meta forms, so a page-wide hotkey on the
// same chord leaves it to the element that declares it; the tokens already there stay.
const declare = (existing: string | null | undefined, keys: string) => {
    let tokens = (existing ?? '').split(/\s+/).filter(Boolean),
        names = split(fromChord(keys, false));

    for (let mod of ['Control', 'Meta']) {
        let token = names.map((name) => (name === 'Mod' ? mod : name)).join('+');

        if (!tokens.some((other) => other.toLowerCase() === token.toLowerCase())) {
            tokens.push(token);
        }
    }

    return tokens.join(' ');
};

// A chord as the shortcut recorder writes one: 'Mod+Shift+K', with its glyphs for arrows and Enter.
const fromChord = (keys: string, apple: boolean) => {
    let tokens = split(keys),
        key = tokens.pop() ?? '',
        order = apple ? APPLE_ORDER : ORDER;

    if (key === ' ') {
        key = 'Space';
    }
    else if (key === 'Enter') {
        key = '↵';
    }
    else {
        key = ARROWS[key] ?? (key.length === 1 ? key.toUpperCase() : key);
    }

    return [...order.filter((name) => tokens.includes(name)), key].join('+');
};

// What the shortcut recorder wrote, as 'chord' writes it; null for nothing recorded or a chord that doesn't parse.
const fromRecorder = (value: string, apple: boolean) => {
    let tokens = split(value),
        key = tokens.pop();

    if (!key) {
        return null;
    }

    for (let name in ARROWS) {
        if (ARROWS[name] === key) {
            key = name;
        }
    }

    if (key === '↵') {
        key = 'Enter';
    }

    return chord([...tokens, SHIFTED[key] ?? key].join('+'), apple);
};

// A chord as people read it: '⌘⇧K' on Apple platforms, 'Ctrl+Shift+K' elsewhere.
const label = (keys: string, apple: boolean) => {
    let tokens = fromChord(keys, apple).split(/\+(?!$)/);

    if (!apple) {
        return tokens.map((token) => (token === 'Mod' ? 'Ctrl' : token)).join('+');
    }

    return tokens.map((token) => GLYPHS[token] ?? token).join('');
};

// Whether a row matches a search by its label, command id or any of its chords, however they're spelled.
const matches = (row: KeybindingRow, query: string, apple: boolean) => {
    let needle = query.trim().toLowerCase();

    if (!needle) {
        return true;
    }

    if (row.label.toLowerCase().includes(needle) || row.id.toLowerCase().includes(needle)) {
        return true;
    }

    for (let keys of [...row.chords, ...row.builtin]) {
        for (let text of [keys, fromChord(keys, apple), label(keys, apple)]) {
            if (text.toLowerCase().includes(needle)) {
                return true;
            }
        }
    }

    return false;
};

// The editor's own keybindings under the user's, which win on any chord both set.
const merge = (base: Keybindings | undefined, user: Keybindings) => {
    if (!base) {
        return user;
    }

    return { ...base, ...user };
};

// Takes 'command' back to its default chords; chords another command took from it stay with that command.
const reset = (keybindings: Keybindings, apple: boolean, command: Command): Keybindings => {
    let base = defaults(apple),
        next = normalize(keybindings, apple);

    for (let keys in next) {
        if (next[keys] === command || (next[keys] === null && base.get(keys) === command)) {
            delete next[keys];
        }
    }

    return next;
};

// Every command with the chords it has once 'keybindings' go over the defaults.
const rows = (keybindings: Keybindings, apple: boolean): KeybindingRow[] => {
    let base = defaults(apple),
        current = table(keybindings, apple),
        native = [...builtins(apple)],
        user = normalize(keybindings, apple),
        changed = new Set<Command>();

    for (let keys in user) {
        let before = base.get(keys),
            after = user[keys];

        if (before && before !== after) {
            changed.add(before);
        }

        if (after && after !== before) {
            changed.add(after);
        }
    }

    return COMMANDS.map(({ id, label }) => ({
        builtin: native.filter(([keys, command]) => command === id && !current.get(keys)).map(([keys]) => keys),
        chords: [...current].filter(([, command]) => command === id).map(([keys]) => keys),
        id,
        label,
        user: changed.has(id)
    }));
};

// Keybindings as stored, keeping only entries whose chord parses and whose command exists or is null.
const sanitize = (value: unknown): Keybindings => {
    let out: Record<string, Command | null> = {};

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return out;
    }

    for (let [keys, command] of Object.entries(value)) {
        if (chord(keys, false) && (command === null || (typeof command === 'string' && IDS.has(command)))) {
            out[keys] = command as Command | null;
        }
    }

    return out;
};

// A two-chord shortcut, like Mod+K Mod+S: the first chord waits a moment for the second, which is taken whatever it
// is. Both are kept from the editor beneath, so listen in the capture phase.
const sequence = ({ accept, actions, apple, onpending, prefix, timeout = SEQUENCE_TIMEOUT }: SequenceOptions) => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    function cancel() {
        if (timer === undefined) {
            return;
        }

        clearTimeout(timer);
        timer = undefined;
        onpending?.(false);
    }

    function keydown(e: SequenceKey) {
        if (e.isComposing || MODIFIER_KEYS.has(e.key)) {
            return;
        }

        let keys = combo(e as KeyboardEvent, apple);

        if (timer !== undefined) {
            e.preventDefault();
            e.stopPropagation();
            cancel();
            actions[keys]?.();
            return;
        }

        if (keys === prefix && accept(e)) {
            e.preventDefault();
            e.stopPropagation();
            timer = setTimeout(cancel, timeout);
            onpending?.(true);
        }
    }

    return { cancel, keydown, pending: () => timer !== undefined };
};

// Removes every chord 'command' has, defaults included.
const unassign = (keybindings: Keybindings, apple: boolean, command: Command): Keybindings => {
    let base = defaults(apple),
        next = normalize(keybindings, apple);

    unbind(next, base, table(keybindings, apple), command);

    return simplify(next, base);
};


export { bind, conflict, declare, fromChord, fromRecorder, label, matches, merge, reset, rows, sanitize, sequence, unassign };
export type { KeybindingRow, Keybindings, SequenceKey, SequenceOptions };
