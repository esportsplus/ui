import { effect, peek, reactive, read, signal, untrack, write, type Signal } from '@esportsplus/reactivity';
import { html, type Attributes, type Renderable } from '@esportsplus/template';
import { write as writeText } from '~/components/clipboard';
import highlight from '~/components/highlight';
import icon from '~/components/icon';
import tooltip from '~/components/tooltip';
import chevron from '@esportsplus/ui/svg/chevron-right.svg';
import symlink from '@esportsplus/ui/svg/corner-down-right.svg';
import file from '@esportsplus/ui/svg/file.svg';
import folderOpen from '@esportsplus/ui/svg/folder-open.svg';
import folderClosed from '@esportsplus/ui/svg/folder.svg';
import lock from '@esportsplus/ui/svg/lock.svg';
import Clipboard from './clipboard';
import segments, { ancestors, caption, holds, lineage, same, sole } from './compact';
import Decorations, { merge, type Badge, type Decoration, type Status, type Tone } from './decorations';
import draggable, { type Drag, type Drop } from './drag';
import Editor, { field, resolve, type Draft, type Kind, type Result } from './edit';
import filter from './filter';
import Finder, { type Mode } from './find';
import fuzzy from './fuzzy';
import glob from './glob';
import History, { type Entry as HistoryEntry, type Operation, type Options as HistoryOptions, type Place, type Step } from './history';
import FOLDERS from './icons';
import Loader, { placeholder, type Load, type Notice } from './lazy';
import Elements, { type Change, type Entry } from './model';
import Selection from './selection';
import command, { extending, type Command } from './shortcuts';
import comparator, { type Case, type Options, type Order, type Sort } from './sort';
import spoken from './spoken';
import stick from './sticky';
import '~/components/button/scss/index.scss';
import './scss/index.scss';


type A = Attributes & {
    // A chain of folders each holding only one folder shows as one row, 'src/main/java', as VS Code's compact
    // folders do; on unless false.
    compact?: boolean;
    // Called once with the tree's commands, for toolbars and shortcuts outside it.
    controller?: (controller: Controller) => void;
    // A name typed into a new item's input. 'a/b.ts' arrives as ['a', 'b.ts'], the folders to create and then the
    // item, under the deepest folder along the path that already exists.
    create?: (parent: Element | null, parts: string[], kind: Kind) => Result;
    // One store per provider, merged by id.
    decorations?: Decorations | Decorations[];
    display?: Display;
    // Rows dragged onto a folder, or onto a file for its folder; the tree reports the drop and moves nothing itself.
    drag?: Drag<Element>;
    editor?: Editor;
    // A store to change the tree live through; a plain array is fixed.
    elements: Element[] | Elements;
    // Shown in place of the rows when there are none, like a message with a button to open a folder.
    empty?: () => Renderable<unknown>;
    // Globs never shown, like VS Code's 'files.exclude': '**/node_modules', 'dist/**', '**/*.{log,tmp}'.
    exclude?: string[];
    // Whether a click on a folder's name opens it, or only a double click does; its chevron always opens on one.
    expand?: 'click' | 'dblclick';
    // Folder ids open on mount; the selected item's folders open as well, unless 'reveal' is off.
    expanded?: string[];
    // Ctrl/Cmd+Alt+F opens a find bar over the tree, in this mode until toggled: 'highlight' marks the matches among
    // every row, 'filter' leaves only them and the folders above them, opened while it lasts.
    find?: Mode | 'off';
    // A fuzzy query whose matched characters are marked in each name, like quick open's; a getter keeps them in step.
    highlight?: string | (() => string);
    // Ctrl/Cmd+Z undoes its last entry and Ctrl/Cmd+Shift+Z or Ctrl+Y redoes one; whatever an undo or redo brings
    // back, moves or renames, however it was started, is selected and revealed.
    history?: History;
    icon?: (element: Element, open: boolean) => Renderable<unknown>;
    // Draws a guide line down each open folder.
    indicator?: Indicator;
    label?: string;
    // Fetches the children of a folder given without any, the first time it opens.
    load?: Load;
    // Right-click, Shift+F10 or the menu key: the caller shows its own menu at 'position'. No elements means the
    // tree's background; 'root' that it opened on a root's header, for commands like removing it from the workspace.
    menu?: (elements: Element[], position: { x: number; y: number }, root: boolean) => void;
    // A file was clicked or entered: the viewer should show it.
    open?: (element: Element, open: Open) => void;
    operations?: Operations;
    // What Shift+Alt+C copies, and Ctrl+Shift+Alt+C as 'relative'; the id by default.
    path?: (element: Element, relative: boolean) => string;
    // Moving the cursor onto a file opens it as a preview once the cursor rests, like JetBrains' autoscroll to source.
    preview?: boolean;
    // F2 renames the focused item.
    rename?: (element: Element, name: string) => Result;
    // Selection written from outside: 'on' opens the folders down to it and scrolls to it, 'select' opens them
    // without scrolling, 'off' only moves the highlight.
    reveal?: 'off' | 'on' | 'select';
    // The top-level folders are roots, as in a VS Code multi-root workspace: each heads its own tree, in the order
    // given, open unless a snapshot says otherwise. Patterns match paths within each root. The tree never renames,
    // moves or deletes a root; adding and removing them is the store's.
    roots?: boolean;
    // Tints rows by the first scope matching them, or else by their folder's.
    scopes?: Scope[];
    select?: (element: Element) => void;
    selected?: string;
    // Alt+N starts a new file and Alt+Shift+N a new folder.
    shortcuts?: boolean;
    // Seeds the open folders and scroll position on mount, in place of 'expanded', and receives every change, so it
    // can be stored and handed back later.
    snapshot?: Snapshot;
    sort?: Sort;
    state?: State;
    // Pins the folders the top rows sit in as the list scrolls, this many deep at most; 'true' is five.
    sticky?: boolean | number;
    // Adds a corner button that opens every folder, or closes them all when any are open.
    toggle?: boolean;
    // Hovering a row shows its full path, with its size and modified date when given.
    tooltip?: boolean;
    // What typing a letter in the tree does: jump to the next name starting with what's typed, or open the find bar
    // with it, as VS Code's 'workbench.list.typeNavigationMode' chooses.
    typing?: 'find' | 'typeahead';
    // Runs once a typed name passes the built-in checks; a message returned blocks the commit and shows under the input.
    validate?: (name: string, parent: Element | null, element: Element | null) => string | void;
};

type Align = 'center' | 'end' | 'start';

type Controller = {
    // Open the find bar, with 'query' in place of what it last held when given.
    find: (query?: string) => void;
    // Move the cursor to the next or previous file git reports changed, wrapping round, and return it; null when
    // nothing has changed.
    next: () => Element | null;
    previous: () => Element | null;
};

type Display = {
    // Files git reports deleted are gone from disk, so they're hidden unless asked for, then shown struck through.
    deleted?: boolean;
    // Names starting with a dot; shown unless false.
    dotfiles?: boolean;
    // Files git ignores, dimmed; hidden when false, and shown again as soon as git stops ignoring them.
    ignored?: boolean;
    // Lines added and removed, from each decoration's 'additions' and 'deletions', ahead of the status letter; a
    // folder shows the totals of what's inside it.
    stats?: boolean;
};

type Element = {
    children?: Element[];
    id: string;
    // Read by the 'modified' sort order and the path tooltip.
    modified?: Date | number;
    name: string;
    readonly?: boolean;
    // Shown but inert, like a locked file.
    selectable?: boolean;
    // In bytes.
    size?: number;
    symlink?: boolean;
    type?: 'file' | 'folder';
};

// Where guides show: always, only while the pointer is over the tree, or never.
type Indicator = 'always' | 'hover' | 'never';

type Layout = Pick<Row, 'depth' | 'element' | 'gaps' | 'parent' | 'position' | 'scope' | 'segments' | 'size'>;

type Mark = {
    // What the row shows and says, flattened, so a refresh writes only when it changed.
    key: string;
    label: string;
    parts: Part[];
    tone: Tone | '';
};

type Motion = {
    element: HTMLElement;
    frame: number;
    ghosts: HTMLElement;
};

// How a file asked to be opened; the viewer decides what that means for its tabs.
type Open = {
    // A single click or a resting cursor previews, replacing the last preview; a double or middle click or Enter pins.
    mode: 'pinned' | 'preview';
    // Alt+click or Ctrl+Enter: beside the current file rather than in its place.
    side: boolean;
};

// Reported with the elements they act on; the tree itself never touches a file.
type Operations = {
    // Asked before a delete; false cancels it.
    confirm?: (elements: Element[], permanent: boolean) => boolean | Promise<boolean>;
    copy?: (elements: Element[]) => void;
    cut?: (elements: Element[]) => void;
    // Delete is meant for the trash, Shift+Delete for good.
    delete?: (elements: Element[], permanent: boolean) => void;
    duplicate?: (elements: Element[]) => void;
    // Into the focused folder, or the focused file's folder; null is the top level. Cut items stay dimmed until the
    // returned promise settles.
    paste?: (elements: Element[], target: Element | null, cut: boolean) => void | Promise<void>;
};

// Each part of the badge is colored on its own, so a modified file's diff stats read green and red beside its yellow M.
type Part = {
    color?: string;
    staged?: boolean;
    text: string;
    title?: string;
    tone?: Tone | 'additions' | 'deletions' | 'open' | 'submodule' | 'unsaved';
};

type Row = {
    // Built the first time the folder opens, so a closed folder costs nothing however large.
    children: Row[] | null;
    depth: number;
    element: Element;
    // How many of the row's siblings are hidden, shared by them all; 'position' and 'size' count them in.
    gaps: Signal<number>;
    // Set on a folder folded into a compact row: the row, which is its last folder's. A folded folder is laid out
    // like that row, in its place, and reads as open.
    host?: Row;
    id: string;
    key: number;
    locked: boolean;
    // Set on the row standing in for a lazy folder's children while they load, or after they failed to.
    notice?: Notice;
    open: Signal<boolean> | null;
    parent: Row | null;
    position: number;
    // The tint color, taken from the row's folder when no scope matches the row itself.
    scope: string;
    // Set on a compact row: the folders folded into it, outermost first. 'parent' and 'depth' are the row's on
    // screen, so it sits where the first of them would.
    segments?: Row[];
    size: number;
};

type Scope = {
    color: string;
    // A pattern is tested against the element's path from the tree's root, like 'src/components/index.ts', or from
    // its own root under 'roots'.
    match: RegExp | ((element: Element) => boolean);
};

type Snapshot = {
    expanded?: string[];
    // The viewport's scrollTop, in pixels.
    scroll?: number;
};

type State = {
    // The primary selection: the anchor, and the row the highlight rests on.
    selected: string;
    // Every selected id, primary included; replaced as a whole on each change.
    selection?: ReadonlySet<string>;
};


const BYTES = ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte'];

// Engines cap how many arguments a spread may pass, so very large folders are inserted in slices.
const CHUNK = 8192;

const LETTERS: Record<Status, string> = {
    added: 'A',
    conflict: '!',
    deleted: 'D',
    ignored: '',
    modified: 'M',
    renamed: 'R',
    untracked: 'U'
};

const PREVIEW: Open = { mode: 'preview', side: false };

// Precedence, lowest first: a row shows the highest of its own tone and, for a folder, those of its contents.
// Ignored stays with the row; a folder of ignored files isn't itself ignored.
const RANK: Tone[] = ['ignored', 'added', 'modified', 'warning', 'deleted', 'conflict', 'error'];

// Long enough that holding an arrow key down opens only the file it stops on.
const REST = 200;

const TONES: Record<Status, Tone> = {
    added: 'added',
    conflict: 'conflict',
    deleted: 'deleted',
    ignored: 'ignored',
    modified: 'modified',
    renamed: 'added',
    untracked: 'added'
};

// Open delay for the path tooltip, so it stays out of the way of a pointer passing over the tree.
const TOOLTIP = 600;

// Long enough to type "pa" at a normal pace, short enough that a fresh letter a moment later starts a new search.
const TYPEAHEAD = 500;

const dates = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });


let uid = 0;


// Problems show in the row's tone alone; the badge carries, in order, the diff stats, the consumer's badges, the
// git letters (index then working tree, or a folder's dot for what's inside it) and the editor marker. 'rollup' is
// null for a file.
function badge(decoration: Decoration | undefined, lines: number[], rollup: Tone | '' | null) {
    let editor = decoration?.editor,
        parts: Part[] = [],
        staged = decoration?.staged,
        status = decoration?.status;

    if (lines[0]) {
        parts.push({ text: `+${lines[0]}`, tone: 'additions' });
    }

    if (lines[1]) {
        parts.push({ text: `−${lines[1]}`, tone: 'deletions' });
    }

    for (let custom of decoration?.badges ?? []) {
        parts.push({ color: custom.color, text: custom.text, title: custom.tooltip });
    }

    if (rollup === null && staged && LETTERS[staged]) {
        parts.push({ staged: true, text: LETTERS[staged], title: 'Staged', tone: TONES[staged] });
    }

    if (rollup === null && status && LETTERS[status]) {
        parts.push({ text: LETTERS[status], tone: TONES[status] });
    }

    if (decoration?.submodule) {
        parts.push({ text: 'S', tone: 'submodule' });
    }

    if (rollup) {
        parts.push({ text: '●', tone: rollup });
    }

    if (editor?.unsaved || editor?.open) {
        parts.push({ text: editor.unsaved ? '●' : '○', tone: editor.unsaved ? 'unsaved' : 'open' });
    }

    return parts;
}

// Steps of 1024, as VS Code reports sizes.
function bytes(value: number) {
    let unit = 0;

    while (value >= 1024 && unit < BYTES.length - 1) {
        value /= 1024;
        unit++;
    }

    // Short bytes read '12 byte', so whole bytes are spelled out.
    return new Intl.NumberFormat(undefined, {
        maximumFractionDigits: 1,
        style: 'unit',
        unit: BYTES[unit],
        unitDisplay: unit ? 'short' : 'long'
    }).format(value);
}

function chip(part: Part) {
    return html`
        <span
            ${{ 'data-staged': part.staged && 'true', 'data-tone': part.tone, style: part.color && `color: ${part.color}` }}
            ${part.title ? { title: part.title } : undefined}
        >
            ${part.text}
        </span>
    `;
}

// The name with the characters 'query' matches marked, a run of them to a mark; the bare name when there are none.
function emphasis(name: string, query: string) {
    let match = query ? fuzzy(query, name) : null;

    if (!match) {
        return name;
    }

    let at = 0,
        indices = match.indices,
        out: Renderable<unknown>[] = [];

    for (let i = 0, n = indices.length; i < n;) {
        let end = indices[i] + 1,
            start = indices[i];

        while (++i < n && indices[i] === end) {
            end++;
        }

        if (start > at) {
            out.push(name.slice(at, start));
        }

        out.push(html`<mark class='file-tree-match'>${name.slice(start, end)}</mark>`);
        at = end;
    }

    if (at < name.length) {
        out.push(name.slice(at));
    }

    return out;
}

function folder(element: Element) {
    return element.type ? element.type === 'folder' : Array.isArray(element.children);
}

function glyph(element: Element, open: boolean) {
    let svg = file;

    if (folder(element)) {
        let named = FOLDERS.get(element.name.toLowerCase());

        svg = named ? named[open ? 1 : 0] : (open ? folderOpen : folderClosed);
    }

    return icon({ 'aria-hidden': 'true', class: 'file-tree-icon' }, svg);
}

// Shadows repeating a row's parent guide under each further ancestor, read by the row's '::before'.
function guides(depth: number) {
    let out: string[] = [];

    for (let i = 1; i < depth; i++) {
        out.push(`calc(var(--indent) * ${-i} * var(--guide-direction)) 0`);
    }

    return out.join(', ') || 'none';
}

// The rank a row lends its folders: a deleted file is a change inside them, not a loss of them.
function lift(rank: number) {
    return rank === RANK.indexOf('deleted') ? RANK.indexOf('modified') : rank;
}

// A middle click pins a file rather than starting the browser's autoscroll.
function middle(event: MouseEvent) {
    if (event.button === 1) {
        event.preventDefault();
    }
}

// Tree order, compared folder by folder from the top, so a folder comes before everything in it.
function order(a: Row, b: Row) {
    let x = place(a),
        y = place(b);

    for (let i = 0, n = Math.min(x.length, y.length); i < n; i++) {
        if (x[i] !== y[i]) {
            return x[i] - y[i];
        }
    }

    return x.length - y.length;
}

function path(row: Row) {
    return [...ancestors(row), row].map((node) => node.element.name).join('/');
}

// The folder whose segment of a compact row was pressed, or the row's own.
function pick(row: Row, event: MouseEvent) {
    let id = (event.target as HTMLElement).closest<HTMLElement>('[data-segment]')?.dataset.segment;

    return row.segments?.find((node) => node.id === id) ?? row;
}

function place(row: Row) {
    let out: number[] = [];

    for (let node: Row | null = row; node; node = node.parent) {
        out.unshift(node.position);
    }

    return out;
}

function rank(decoration: Decoration | undefined) {
    if (!decoration) {
        return -1;
    }

    if (decoration.errors) {
        return RANK.indexOf('error');
    }

    // The working tree says what's on disk now; the index speaks only when the working tree is clean.
    let value = decoration.status ?? decoration.staged,
        status = value ? RANK.indexOf(TONES[value]) : -1;

    return decoration.warnings ? Math.max(status, RANK.indexOf('warning')) : status;
}

// The row a reader still sees once the folders above 'row' close: its outermost closed ancestor, or itself.
function shown(row: Row) {
    let target = row;

    for (let node = row.parent; node; node = node.parent) {
        if (!peek(node.open!)) {
            target = node;
        }
    }

    return target;
}

// The folders to open so 'id' is on screen: its ancestors, and itself when it's a folder a click could open.
function trail(index: Map<string, Entry>, id: string) {
    let entry = index.get(id),
        out: string[] = [];

    if (!entry) {
        return out;
    }

    if (folder(entry.element) && entry.element.selectable !== false) {
        out.push(id);
    }

    for (let parent = entry.parent; parent !== null; parent = index.get(parent)!.parent) {
        out.push(parent);
    }

    return out;
}

function twistie(event: MouseEvent) {
    return (event.target as HTMLElement).closest('.file-tree-twistie') !== null;
}


export default ({
    compact = true,
    controller,
    create,
    decorations: providers,
    display = {},
    drag,
    editor,
    elements,
    empty,
    exclude = [],
    expand: unfold = 'click',
    expanded = [],
    find = 'highlight',
    highlight: phrase = '',
    history,
    icon: render = glyph,
    indicator = 'always',
    label = 'Files',
    load,
    menu,
    open: view,
    operations,
    path: address = (element) => element.id,
    preview,
    rename,
    reveal: autoreveal = 'on',
    roots = false,
    scopes = [],
    select,
    selected,
    shortcuts,
    snapshot,
    sort = 'folders',
    state = reactive({ selected: selected ?? '', selection: new Set<string>() }),
    sticky = true,
    toggle,
    tooltip: hint = true,
    typing = 'typeahead',
    validate,
    ...attributes
}: A) => {
    let built = new Map<string, Row>(),
        // Whatever the tree reads while it's built is read untracked: built inside a caller's computation, it would
        // otherwise rebuild the tree on every selection or display change.
        chosen = untrack(() => state.selected),
        clipboard = new Clipboard<Element>(),
        compare = comparator(sort, folder),
        // Descendant tones per folder, one count per rank, so a change walks its ancestors instead of the tree.
        counts = new Map<string, number[]>(),
        decorations = providers && merge([providers].flat()),
        // Lines added and removed per shown row; 'totals' sums them per folder, kept like 'counts'.
        diffs = new Map<string, number[]>(),
        // The open name input, if any; a new item's row lives only in 'rows', never among its folder's children.
        draft = signal<Draft<Row> | null>(null),
        excluded = glob(exclude),
        model = elements instanceof Elements ? elements : new Elements(elements),
        filtered = untrack(() => filter(model.elements, display.dotfiles !== false, excluded, roots)),
        hidden = untrack(() => new Set([...filtered, ...(decorations?.keys() ?? [])].filter(gone))),
        id = `file-tree-${++uid}`,
        index = model.index,
        initial = new Set([
            ...(snapshot?.expanded ?? expanded),
            ...(roots && !snapshot?.expanded ? model.elements.map((element) => element.id) : []),
            ...(autoreveal === 'off' ? [] : trail(index, chosen))
        ]),
        key = 0,
        // The primary selection last acted on, so one written while disconnected is revealed on connect.
        known = chosen,
        loader = load ? new Loader(load, loaded) : null,
        marks = new Map<string, Signal<Mark>>(),
        // The row under each empty root saying so, by root id; kept so the list finds the same row every time.
        notes = new Map<string, Row>(),
        opened = 0,
        own = new Map<string, number>(),
        // What 'highlight' asks the names to mark; a getter given for it writes this while connected.
        given = signal(typeof phrase === 'function' ? untrack(phrase) : phrase),
        // The search the rows show, empty while the find bar is closed.
        query = signal(''),
        // The list's rows on screen; the rest are virtualized away.
        rendered = new Map<Row, HTMLElement>(),
        // The rows a folder is opening onto, by place within it; emptied when the motion settles, so rows scrolled
        // back into view later arrive as they are.
        revealing = new Map<Row, number>(),
        search = find === 'off' ? null : new Finder(find, query, {
            compare,
            // A compact row's selected segment is where the cursor is.
            cursor: () => cursor && segment(cursor).id,
            elements: model.elements,
            folder,
            go: (id) => reveal(id, true),
            gone,
            lazy: !!load,
            leave: () => viewport?.focus({ preventScroll: true }),
            shows: (id) => {
                let row = built.get(id);

                return !!row && !hidden.has(id) && shown(row) === row;
            },
            sift
        }),
        // The store's version this tree last caught up with.
        seen = model.version,
        // The display flags last applied, so flags changed while disconnected are applied on connect.
        settings = untrack(modes),
        // A folder kept out of its compact row while a name input is open in it or on it.
        split: string | null = null,
        top = build(model.elements, 0, null),
        totals = new Map<string, number[]>(),
        // The folders filtering has reached, and whether it opened them, so ending it closes those alone.
        unfolded = new Map<string, boolean>(),
        // Filled before the slot exists: rows inserted at the top of a live slot read as arriving above the reader.
        rows = reactive(visible(top)),
        cursor: Row | null = rows.find((row) => holds(row, (id) => id === chosen)) ?? rows[0] ?? null,
        dragging = drag && draggable<Row>(drag, {
            // Pressing a selected row drags the whole selection, as in VS Code; any other row goes alone. Roots stay, and
            // a folder selected along with one folded above it in a compact row travels inside it.
            grab: (row) => (selection.has(row.id) ? [...selection.ids].map((id) => built.get(id)) : [row])
                .filter((row): row is Row => row !== undefined && !header(row) && !ancestors(row).some((node) => selection.has(node.id) && !header(node))),
            host: (row) => row.host ?? row,
            last: (row) => {
                let inner = row.open && peek(row.open) ? visible(branch(row)) : [];

                return inner[inner.length - 1] ?? row;
            },
            open: (row) => fold(row, true),
            top: !roots,
            viewport: () => viewport
        }),
        // An id the tree itself just made primary: the reveal an outside write gets would pull focus onto it.
        quiet: string | null = null,
        // One tooltip for the whole tree, gliding from row to row; rows come and go as they scroll, so it's bound to
        // the viewport rather than to each row.
        tip =tooltip.shared({ delay: { open: TOOLTIP }, direction: 'e' }),
        typed = '',
        typedAt = 0,
        ui = reactive({ any: opened > 0, focused: cursor?.key ?? 0 }),
        selection = new Selection((ids) => {
            state.selection = ids;
        }),
        slot = html.virtual(rows, (row) => {
            if (row.notice) {
                return placeholder(row.notice, {
                    ...(revealing.has(row) ? { 'data-reveal': 'true' } : undefined),
                    'aria-level': String(row.depth + 1),
                    class: () => ui.focused === row.key && '--focused',
                    'data-id': row.id,
                    id: `${id}-${row.key}`,
                    onclick: () => {
                        focus(row);
                        retry(row);
                    },
                    style: `--depth: ${row.depth}; --guides: ${guides(row.depth)}; --reveal-index: ${revealing.get(row) ?? 0};`
                }, dragging?.row(row) ?? {}, onscreen(row));
            }

            let mark = decorations ? track(row.id) : null,
                open = row.open;

            return html`
                <div
                    aria-level='${row.depth + 1}'
                    class='file-tree-row ${row.locked ? '--disabled' : ''} ${header(row) ? '--root' : ''} ${() => active(row) && '--active'} ${() => holds(row, (id) => clipboard.marked.read(id)) && '--cut'} ${() => holds(row, (id) => selection.read(id)) && !active(row) && '--selected'}'
                    data-id='${row.id}'
                    id='${id}-${row.key}'
                    role='treeitem'
                    style='--depth: ${row.depth}; --guides: ${guides(row.depth)}; --reveal-index: ${revealing.get(row) ?? 0};'
                    ${row.locked ? { 'aria-disabled': 'true' } : undefined}
                    ${revealing.has(row) ? { 'data-reveal': 'true' } : undefined}
                    ${open ? { 'aria-expanded': () => read(open) ? 'true' : 'false' } : undefined}
                    ${mark ? { 'data-tone': () => read(mark).tone || false } : undefined}
                    ${search ? { 'data-match': () => matched(row) } : undefined}
                    ${row.scope ? { 'data-scope': 'true', style: `--scope: ${row.scope}` } : undefined}
                    ${dragging?.row(row)}
                    ${onscreen(row)}
                    ${{
                        'aria-label': mark ? () => read(mark).label : spoken({ ...row.element, name: caption(row), root: header(row) }),
                        'aria-posinset': () => position(row),
                        'aria-selected': () => holds(row, (id) => selection.read(id)) ? 'true' : 'false',
                        'aria-setsize': () => row.size - read(row.gaps),
                        class: () => ui.focused === row.key && '--focused',
                        onauxclick: (event: MouseEvent) => press(row, event),
                        onclick: (event: MouseEvent) => press(row, event),
                        ondblclick: (event: MouseEvent) => press(row, event)
                    }}
                >
                    ${contents(row, mark, false)}
                </div>
            `;
        }),
        // Copies of the pinned folders' rows; the tree's own stay in the list beneath, the highlight with them. The
        // highlight draws under the stack, so a copy shows its own hover and selection.
        pins = stick(rows, sticky, (row) => {
            let mark = decorations ? track(row.id) : null;

            return html`
                <div
                    aria-expanded='true'
                    class='file-tree-row ${row.locked ? '--disabled' : ''} ${header(row) ? '--root' : ''} ${() => active(row) && '--selected'}'
                    style='--depth: ${row.depth}; --guides: ${guides(row.depth)};'
                    ${mark ? { 'data-tone': () => read(mark).tone || false } : undefined}
                    ${{
                        class: () => ui.focused === row.key && '--focused',
                        onclick: () => unpin(row)
                    }}
                >
                    ${contents(row, mark, true)}
                </div>
            `;
        }, height),
        anchor: Row | null = null,
        detach: VoidFunction | undefined,
        // Made on connect rather than while building, where they would belong to whatever computation built the
        // tree and rerun it; disposed on disconnect.
        effects: VoidFunction[] = [],
        forget: VoidFunction | undefined,
        motion: Motion | null = null,
        release: VoidFunction | undefined,
        root: HTMLElement | undefined,
        timer: ReturnType<typeof setTimeout> | undefined,
        unsubscribe: VoidFunction | undefined,
        unwatch: VoidFunction | undefined,
        viewport: HTMLElement | undefined;

    selection.replace([...(untrack(() => state.selection) ?? []), ...(chosen ? [chosen] : [])]);
    persist();

    // The tooltip's content: the full path, which also shows a name cut short in its row, then size and date.
    function about(row: Row) {
        let element = row.element,
            meta: string[] = [];

        if (element.size !== undefined) {
            meta.push(bytes(element.size));
        }

        if (element.modified !== undefined) {
            meta.push(dates.format(element.modified));
        }

        let full = path(row);

        return () => html`
            <span class='file-tree-tooltip-path'>${full.slice(0, full.length - element.name.length)}<strong>${element.name}</strong></span>
            ${meta.length ? html`<span class='file-tree-tooltip-meta'>${meta.join(' · ')}</span>` : ''}
        `;
    }

    controller?.({
        find: (text) => search?.open(text),
        next: () => jump(1),
        previous: () => jump(-1)
    });

    // A folder given 'toggle' false is only selected. 'subject' is what's selected: in a compact row, the folder of
    // the segment pressed, which opening and closing the row leaves be.
    function activate(row: Row, open: Open, toggle = true, subject = segment(row)) {
        if (row.notice) {
            retry(row);
            return;
        }

        if (row.locked) {
            return;
        }

        clearTimeout(timer);
        anchor = row;
        selection.replace([subject.id]);
        state.selected = subject.id;
        select?.(subject.element);

        if (!row.open) {
            view?.(row.element, open);
        }
        else if (toggle) {
            fold(row, !peek(row.open));
        }
    }

    // Selected itself, or through one of the folders folded into it.
    function active(row: Row) {
        return holds(row, (id) => id === state.selected);
    }

    // Opens every folder a click could open, or closes them all; within 'scope' and its folders alone when given.
    function all(value: boolean, scope?: Row) {
        let at = scope ? rows.indexOf(scope) : -1;

        if (scope && (!scope.open || scope.locked || at === -1)) {
            return;
        }

        settle();

        let count = scope ? (peek(scope.open!) ? visible(branch(scope)).length : 0) : rows.length,
            stack = scope ? [scope] : [...top];

        while (stack.length) {
            let row = stack.pop()!;

            if (!row.open) {
                continue;
            }

            // Locked folders stay shut, matching how a click on them does nothing. An empty root opens onto its note.
            let open = value && !row.locked && (header(row) || !!row.element.children?.length);

            if (peek(row.open) !== open) {
                write(row.open, open);
                opened += open ? 1 : -1;
            }

            if (!open && loader?.forget(row.id)) {
                row.children = null;
            }

            // Closing never builds a folder that was never opened.
            let children = open ? branch(row) : (row.children ?? []);

            for (let i = 0, n = children.length; i < n; i++) {
                stack.push(children[i]);
            }
        }

        // Replaced in place by one splice; clearing first would make everything after read as inserted above the reader.
        let next = scope ? (peek(scope.open!) ? visible(branch(scope)) : []) : visible(top);

        rows.splice(at + 1, count, ...next.slice(0, CHUNK));
        insert(at + 1 + CHUNK, next.slice(CHUNK));
        prune();
        ui.any = opened > 0;

        if (cursor) {
            focus(shown(cursor));
        }

        persist();
    }

    // Opens a name input on the target, undefined meaning the focused row: to rename it, or for a new item inside it
    // when it's a folder and beside it otherwise; null puts a new item at the top level.
    function begin(action: Kind | 'rename', target?: string | null) {
        close(false);

        if (target) {
            reveal(target, true);
        }

        let row = target === null ? null : target === undefined ? cursor && segment(cursor) : built.get(target);

        if (row === undefined) {
            return;
        }

        // A folder in the middle of a compact row leaves it for the edit, so the input and a new item's row sit
        // under a row of its own; renaming a compact row's last folder edits its last segment in place.
        if (row?.host) {
            row = separate(row);
        }

        if (action === 'rename') {
            if (!rename || !row || row.locked || header(row)) {
                return;
            }

            write(draft, {
                busy: signal(false),
                element: row.element,
                from: row,
                kind: folder(row.element) ? 'folder' : 'file',
                message: signal(''),
                parent: row.parent,
                range: null,
                row,
                value: row.element.name
            });
            move(rows.indexOf(row), 'end');
            return;
        }

        if (!create) {
            return;
        }

        // A file, or a folder a click can't open, takes the new item beside it. Roots hold the top level, so one
        // asked for there lands in the first.
        let parent = row?.open && !row.locked ? row : (row?.parent ?? (roots ? top[0] ?? null : null)),
            stub: Row = {
                children: null,
                depth: parent ? parent.depth + 1 : 0,
                element: { id: `${id}-draft`, name: '', type: action },
                gaps: signal(0),
                id: `${id}-draft`,
                key: ++key,
                locked: false,
                open: action === 'folder' ? signal(false) : null,
                parent,
                position: 1,
                scope: parent?.scope ?? '',
                size: (parent ? branch(parent) : top).length + 1
            };

        if (roots && !parent) {
            return;
        }

        write(draft, {
            busy: signal(false),
            element: null,
            from: cursor,
            kind: action,
            message: signal(''),
            parent,
            range: null,
            row: stub,
            value: ''
        });

        // Opening the folder lists the stub along with its rows.
        if (parent && !peek(parent.open!)) {
            expand(parent, true);
        }
        else {
            rows.splice(parent ? rows.indexOf(parent) + 1 : 0, 0, stub);
        }

        move(rows.indexOf(stub), 'end');
    }

    // The note under an open root holding nothing; made again when the root's row is.
    function blank(root: Row) {
        let row = notes.get(root.id);

        if (!row || row.parent !== root) {
            notes.set(root.id, row = notice(root, { type: 'empty' }));
        }

        return row;
    }

    // A folder given without children, when there's a loader, has a notice for them until they arrive.
    function branch(row: Row) {
        return row.children ??= loader && !row.element.children
            ? [notice(row, loader.request(row.element))]
            : build(row.element.children ?? [], row.depth + 1, row);
    }

    function build(elements: Element[], depth: number, parent: Row | null) {
        let arranged = compare && !(roots && !parent) ? [...elements].sort(compare) : elements,
            gaps = group(arranged, parent),
            n = arranged.length,
            out: Row[] = new Array(n),
            // Paths run from within each root under 'roots', as exclude patterns match; a root has none of its own.
            prefix = scopes.length && parent ? `${path(parent)}/` : '',
            unseen = 0;

        if (roots) {
            prefix = prefix.slice(prefix.indexOf('/') + 1);
        }

        for (let i = 0; i < n; i++) {
            let element = arranged[i],
                full = roots && !parent ? '' : prefix + element.name,
                merged = false,
                segments: Row[] = [],
                tint = scopes.length ? scope(element, full, parent?.scope ?? '') : '';

            if (hidden.has(element.id)) {
                unseen++;
            }

            // A folder holding just one folder shares its row with it, and so on down the chain; the row is the last
            // folder's, in the first one's place.
            for (let next = joined(element); next; next = joined(element)) {
                let previous = built.get(element.id);

                merged ||= !!previous?.open && !previous.host && peek(previous.open);
                segments.push(lay({ depth, element, gaps, parent, position: i + 1, scope: tint, segments: undefined, size: n }, true));
                element = next;
                full = `${full}/${element.name}`;
                tint = scopes.length ? scope(element, full, tint) : '';
            }

            let fresh = !built.has(element.id),
                row = out[i] = lay({
                    depth,
                    element,
                    gaps,
                    parent,
                    position: i + 1,
                    scope: tint,
                    segments: segments.length ? segments : undefined,
                    size: n
                }, false);

            for (let j = 0, m = segments.length; j < m; j++) {
                segments[j].host = row;
            }

            // An open folder whose children just arrived as one folder, as a lazy folder's can, would otherwise close
            // under the reader as it merges into that folder's row.
            if (merged && fresh && !peek(row.open!)) {
                write(row.open!, true);
                opened++;
            }
        }

        write(gaps, unseen);

        return out;
    }

    // A row a rebuild found again. Showing the same element at the same depth, in the same group and tint, with the
    // same folders folded into it, it's kept and its rendered DOM with it, its place updated through the group's
    // count. Otherwise it's copied under a new key to render afresh, keeping its open state, and its folder rebuilds
    // at the new depth when next shown.
    function carry(row: Row, layout: Layout) {
        let element = layout.element;

        if (row.element === element && row.depth === layout.depth && row.gaps === layout.gaps && row.scope === layout.scope && same(row.segments, layout.segments)) {
            row.parent = layout.parent;
            row.position = layout.position;
            row.segments = layout.segments;
            row.size = layout.size;

            return row;
        }

        let next: Row = {
            ...row,
            ...layout,
            children: null,
            key: ++key,
            locked: element.selectable === false
        };

        built.set(row.id, next);
        retarget(row, next);

        return next;
    }

    function change(value: string) {
        let edit = peek(draft)!;

        edit.value = value;
        write(edit.message, inspect(edit).message);
    }

    // Leaves the name input without committing; 'refocus' hands focus back to the tree, as when a key closed it.
    function close(refocus: boolean) {
        let edit = peek(draft);

        if (!edit) {
            return;
        }

        write(draft, null);

        if (!edit.element) {
            let at = rows.indexOf(edit.row);

            if (at !== -1) {
                rows.splice(at, 1);
            }
        }

        let back = edit.from ? rows.indexOf(edit.from) : -1;

        move(back === -1 ? 0 : back, 'end');

        if (split) {
            let rejoin = split;

            split = null;
            update([rejoin]);
        }

        if (refocus) {
            viewport?.focus({ preventScroll: true });
        }
    }

    // The callback settles before the input closes; one that refuses, or fails, leaves it open to try again.
    function commit(refocus: boolean) {
        let edit = peek(draft);

        if (!edit || peek(edit.busy)) {
            return;
        }

        let element = edit.element;

        if (element && edit.value === element.name) {
            close(refocus);
            return;
        }

        let { message, parent, parts } = inspect(edit);

        if (message) {
            write(edit.message, message);
            return;
        }

        write(edit.busy, true);

        Promise.resolve()
            .then(() => element ? rename!(element, edit.value) : create!(parent, parts, edit.kind))
            .then(
                (accepted) => {
                    if (peek(draft) !== edit) {
                        return;
                    }

                    write(edit.busy, false);

                    if (accepted !== false) {
                        close(refocus);
                    }
                },
                (error) => {
                    if (peek(draft) !== edit) {
                        return;
                    }

                    write(edit.busy, false);
                    write(edit.message, error instanceof Error ? error.message : String(error));
                }
            );
    }

    function conceal(row: Row) {
        let at = rows.indexOf(row);

        if (at === -1) {
            return;
        }

        rows.splice(at, 1 + (row.open && peek(row.open) ? visible(branch(row)).length : 0));
        prune();

        if (cursor && rows.indexOf(cursor) === -1 && rows.length) {
            focus(rows[Math.min(at, rows.length - 1)]);
        }
    }

    // A pinned copy keeps its name; the input for a rename lives on the row itself.
    function contents(row: Row, mark: Signal<Mark> | null, pinned: boolean) {
        let element = row.element,
            open = row.open;

        return html`
            <span aria-hidden='true' class='file-tree-twistie'>
                ${open && icon({ class: 'file-tree-chevron' }, chevron)}
            </span>
            ${() => !header(row) && render(element, open !== null && read(open))}
            ${() => {
                let edit = read(draft);

                if (pinned || edit?.row !== row) {
                    return row.segments
                        ? segments(row, (node) => ({
                            class: () => node !== row && state.selected === node.id && '--active',
                            ...(search ? { 'data-match': () => search.mark(node.id) } : undefined),
                            ...dragging?.segment(node)
                        }), (node) => () => emphasis(node.element.name, read(query) || read(given)))
                        : html`<span class='file-tree-name'>${() => emphasis(element.name, read(query) || read(given))}</span>`;
                }

                return html`
                    ${row.segments && html`<span class='file-tree-name'>${row.segments.map((node) => `${node.element.name}/`).join('')}</span>`}
                    ${field(edit, id, {
                        blur: leave,
                        cancel: () => close(true),
                        input: change,
                        submit: () => commit(true)
                    })}
                `;
            }}
            ${element.symlink && icon({ 'aria-hidden': 'true', class: 'file-tree-marker' }, symlink)}
            ${element.readonly && icon({ 'aria-hidden': 'true', class: 'file-tree-marker' }, lock)}
            ${mark && html`
                <span aria-hidden='true' class='file-tree-badge'>
                    ${() => read(mark).parts.map(chip)}
                </span>
            `}
        `;
    }

    function decorate(ids: Iterable<string>) {
        for (let id of ids) {
            let hide = unseen(id),
                // A hidden row marks nothing, its folders included; a deleted file is hidden only for being gone from
                // disk, and is still a change to its folders, unless it's excluded as well. A row a search filters out
                // is only out of view.
                silent = gone(id) && (filtered.has(id) || !deleted(id)),
                after = silent ? -1 : rank(decorations?.get(id)),
                before = own.get(id) ?? -1;

            if (hide !== hidden.has(id)) {
                let row = built.get(id);

                if (hide) {
                    hidden.add(id);
                }
                else {
                    hidden.delete(id);
                }

                // Ahead of any rebuild, which counts the group afresh.
                if (row) {
                    write(row.gaps, peek(row.gaps) + (hide ? 1 : -1));
                }

                let groups = refold(id);

                // Rows whose chains the change joined or split are rebuilt; otherwise the row alone goes or comes back.
                if (groups.length) {
                    update(groups);
                }
                else if (row && hide) {
                    conceal(row);
                }
                else if (row) {
                    restore(row);
                }
            }

            if (after !== before) {
                if (after === -1) {
                    own.delete(id);
                }
                else {
                    own.set(id, after);
                }

                let from = lift(before),
                    to = lift(after);

                if (from !== to && (from > 0 || to > 0)) {
                    for (let parent = index.get(id)?.parent ?? null; parent !== null; parent = index.get(parent)!.parent) {
                        let list = counts.get(parent);

                        if (!list) {
                            counts.set(parent, list = new Array(RANK.length).fill(0));
                        }

                        if (from > 0) {
                            list[from]--;
                        }

                        if (to > 0) {
                            list[to]++;
                        }

                        refresh(parent);
                    }
                }
            }

            let decoration = silent ? undefined : decorations?.get(id),
                lines = [decoration?.additions ?? 0, decoration?.deletions ?? 0],
                previous = diffs.get(id),
                added = lines[0] - (previous?.[0] ?? 0),
                removed = lines[1] - (previous?.[1] ?? 0);

            if (added || removed) {
                if (lines[0] || lines[1]) {
                    diffs.set(id, lines);
                }
                else {
                    diffs.delete(id);
                }

                for (let parent = index.get(id)?.parent ?? null; parent !== null; parent = index.get(parent)!.parent) {
                    let total = totals.get(parent);

                    if (!total) {
                        totals.set(parent, total = [0, 0]);
                    }

                    total[0] += added;
                    total[1] += removed;
                    refresh(parent);
                }
            }

            refresh(id);
        }
    }

    function deleted(id: string) {
        let decoration = decorations?.get(id);

        return (decoration?.status ?? decoration?.staged) === 'deleted';
    }

    // Copies of the rows below 'element' that are on screen, laid where they sit now, to stand in for rows the list
    // is about to swap out.
    function copy(element: HTMLElement, limit: number, container: HTMLElement, scroller: HTMLElement) {
        let edge = element.getBoundingClientRect().bottom,
            frame = container.getBoundingClientRect(),
            ghosts = document.createElement('div'),
            layer = document.createElement('div'),
            view = scroller.getBoundingClientRect(),
            left = view.left + scroller.clientLeft,
            top = view.top + scroller.clientTop,
            bottom = top + scroller.clientHeight;

        ghosts.className = 'file-tree-motion';
        ghosts.inert = true;
        ghosts.setAttribute('aria-hidden', 'true');
        ghosts.style.height = `${scroller.clientHeight}px`;
        ghosts.style.left = `${left - frame.left - container.clientLeft}px`;
        ghosts.style.top = `${top - frame.top - container.clientTop}px`;
        ghosts.style.width = `${scroller.clientWidth}px`;
        layer.className = 'file-tree-motion-layer';
        layer.style.top = `${edge - top}px`;

        for (let i = 0, node = element.nextElementSibling; i < limit && node instanceof HTMLElement && node.classList.contains('file-tree-row'); i++, node = node.nextElementSibling) {
            let rect = node.getBoundingClientRect();

            if (rect.top >= bottom) {
                break;
            }

            let clone = node.cloneNode(true) as HTMLElement;

            clone.dataset.ghost = node.dataset.id;
            clone.removeAttribute('data-id');
            clone.removeAttribute('id');
            clone.removeAttribute('role');
            // Laid out by its measured box, so the depth margin would count twice.
            clone.style.margin = '0';
            clone.style.left = `${rect.left - left}px`;
            clone.style.top = `${rect.top - edge}px`;
            clone.style.width = `${rect.width}px`;
            layer.append(clone);
        }

        ghosts.append(layer);

        return ghosts;
    }

    // Where a paste lands: the focused folder, or the folder holding the focused file; null for the top level.
    function destination(row: Row) {
        return row.open ? row.element : (row.parent?.element ?? null);
    }

    async function discard(elements: Element[], permanent: boolean) {
        if (!elements.length || (operations?.confirm && !(await operations.confirm(elements, permanent)))) {
            return;
        }

        operations?.delete?.(elements, permanent);
    }

    function expand(row: Row, value: boolean) {
        if (!row.open || peek(row.open) === value) {
            return;
        }

        settle();

        let at = rows.indexOf(row);

        if (value) {
            write(row.open, true);
            opened++;

            if (at !== -1) {
                insert(at + 1, visible(branch(row)));
            }
        }
        else {
            if (at !== -1) {
                rows.splice(at + 1, visible(branch(row)).length);
            }

            write(row.open, false);
            opened--;
            prune();

            if (loader?.forget(row.id)) {
                row.children = null;
            }

            if (cursor) {
                focus(shown(cursor));
            }
        }

        ui.any = opened > 0;
        persist();
    }

    // Ctrl+click and Ctrl+Space add a row to the selection or take it out; it becomes the anchor either way.
    function flip(row: Row) {
        if (row.locked) {
            return;
        }

        anchor = row;

        if (!selection.has(row.id)) {
            selection.replace([...selection.ids, row.id]);
            primary(row.id);
            // The primary it replaces may sit in a closed folder, kept only while it was primary.
            prune();
            return;
        }

        let rest = [...selection.ids].filter((id) => id !== row.id);

        selection.replace(rest);

        if (state.selected === row.id) {
            primary(rest[rest.length - 1] ?? '');
        }
    }

    // Opens or closes a folder the way the tree view does: an edge sweeps over its rows while the rows below ride on
    // it. The list swaps rows at once, so copies stand in for rows no longer rendered: the folder's own on the way
    // closed, and on the way open whichever rows below were pushed out of the rendered window.
    function fold(row: Row, value: boolean) {
        if (!row.open || peek(row.open) === value) {
            return;
        }

        settle();

        let container = root,
            element = rendered.get(row),
            inner = visible(branch(row)),
            scroller = viewport;

        if (!container || !element || !inner.length || !scroller) {
            expand(row, value);
            return;
        }

        if (value) {
            for (let i = 0, n = inner.length; i < n; i++) {
                revealing.set(inner[i], i);
            }
        }

        let ghosts = copy(element, value ? Infinity : inner.length, container, scroller);

        expand(row, value);

        motion = {
            element,
            // Queued after the list's own frame, so the rows are already swapped when the motion starts.
            frame: requestAnimationFrame(() => {
                // A row still rendered rides the edge itself, so the highlight on it moves with it.
                for (let clone of ghosts.querySelectorAll<HTMLElement>('[data-ghost]')) {
                    let ghost = lookup(clone.dataset.ghost!);

                    if (ghost && rendered.has(ghost)) {
                        clone.remove();
                    }
                }

                scroller.after(ghosts);
                container.style.setProperty('--motion-rows', String(inner.length));
                container.dataset.motion = value ? 'open' : 'close';
                element.dataset.motion = '';
            }),
            ghosts
        };
    }

    function focus(row: Row) {
        cursor = row;
        ui.focused = row.key;
    }

    function follow(row: Row) {
        clearTimeout(timer);

        if (preview && !row.open && !row.locked) {
            timer = setTimeout(() => activate(row, PREVIEW), REST);
        }
    }

    function gone(id: string) {
        return filtered.has(id) || (deleted(id) && !display.deleted) || (display.ignored === false && decorations?.get(id)?.status === 'ignored');
    }

    // The sibling group's shared count of hidden rows, kept across rebuilds so the rows already rendered go on reading
    // the one being written. Every write notifies, even of the same count, since a rebuild also moves kept rows to new
    // places the template reads alongside it.
    function group(elements: Element[], parent: Row | null) {
        let owner = parent?.id ?? null;

        for (let i = 0, n = elements.length; i < n; i++) {
            let row = built.get(elements[i].id);

            if (row && (row.parent?.id ?? null) === owner) {
                return row.gaps;
            }
        }

        return signal(0, () => false);
    }

    // A root's own row, heading its tree.
    function header(row: Row) {
        return roots && row.parent === null;
    }

    // Every row is the same height, so any row on screen measures them all.
    function height() {
        for (let element of rendered.values()) {
            return element.offsetHeight;
        }

        return 0;
    }

    function insert(at: number, items: Row[]) {
        for (let i = 0, n = items.length; i < n; i += CHUNK) {
            rows.splice(at + i, 0, ...items.slice(i, i + CHUNK));
        }
    }

    function inspect(edit: Draft<Row>) {
        let parent = edit.parent?.element ?? null,
            result = resolve(edit.value, parent, edit.element, siblings, folder);

        if (!result.message && validate) {
            result.message = validate(edit.value, parent, edit.element) || '';
        }

        return result;
    }

    // The folder 'element' shares its row with, when compacting. A hidden folder has no row to share, the one split
    // out for a name input keeps its own, and a root heads its tree alone, though a chain may start below it.
    function joined(element: Element) {
        if (!compact || element.id === split || hidden.has(element.id) || !folder(element) || (roots && index.get(element.id)?.parent === null)) {
            return null;
        }

        return sole(element, hidden, folder);
    }

    // Moves the cursor to the next or previous file git reports changed, in tree order, opening the folders down to it.
    function jump(step: 1 | -1) {
        let changed: Row[] = [];

        for (let id of decorations?.keys() ?? []) {
            let entry = index.get(id),
                status = decorations!.get(id)!.status;

            if (!entry || folder(entry.element) || !status || status === 'ignored' || hidden.has(id)) {
                continue;
            }

            changed.push(locate(id)!);
        }

        if (!changed.length) {
            return null;
        }

        changed.sort(order);

        let n = changed.length,
            target = step === 1 ? changed[0] : changed[n - 1];

        if (cursor) {
            for (let i = 0; i < n; i++) {
                let row = changed[step === 1 ? i : n - 1 - i];

                if (order(row, cursor) * step > 0) {
                    target = row;
                    break;
                }
            }
        }

        reveal(target.id, true);
        follow(target);

        return target.element;
    }

    // The row for 'layout', the one built before for its element when there is one. A folder folded into a compact
    // row reads as open but counts among the open folders only while it has a row of its own; folding in or out, its
    // children, built for where it stood, rebuild when it next shows them.
    function lay(layout: Layout, folded: boolean) {
        let element = layout.element,
            previous = built.get(element.id);

        if (!previous) {
            let open = folder(element) ? folded || initial.has(element.id) : null,
                row: Row = {
                    ...layout,
                    children: null,
                    id: element.id,
                    key: ++key,
                    locked: element.selectable === false,
                    open: open === null ? null : signal(open)
                };

            if (open && !folded) {
                opened++;
            }

            built.set(element.id, row);

            return row;
        }

        let was = !!previous.host,
            row = carry(previous, layout);

        // Set again by the build that folds it.
        row.host = undefined;

        if (was !== folded) {
            row.children = null;

            // Unfolded, it counts only while open: a search ending shuts one it opened, folded or not.
            if (!folded) {
                opened += peek(row.open!) ? 1 : 0;
            }
            else if (peek(row.open!)) {
                opened--;
            }
            else {
                write(row.open!, true);
            }
        }

        // A compact row's spoken name reads its folders' names, which the store may have just changed.
        if (row !== previous) {
            refresh(element.id);
        }

        return row;
    }

    // Clicking away commits a good name and drops a bad one, as VS Code does.
    function leave() {
        let edit = peek(draft);

        if (!edit || peek(edit.busy)) {
            return;
        }

        if (peek(edit.message) || inspect(edit).message) {
            close(false);
        }
        else {
            commit(false);
        }
    }

    // Loaded children join the store, reaching every tree showing it; a failure shows on this tree alone. A folder
    // removed meanwhile drops them, and one another tree already filled keeps what it has.
    function loaded(id: string, children: Element[] | null) {
        let element = model.get(id);

        if (!element) {
            return;
        }

        if (children && !element.children) {
            model.add(children, id);
        }
        else {
            update([id]);
        }
    }

    // The row for 'id', building the folders above it without opening them.
    function locate(id: string) {
        let chain: string[] = [];

        for (let node = index.get(id)?.parent ?? null; node !== null; node = index.get(node)!.parent) {
            chain.push(node);
        }

        // A folder folded into a compact row lists nothing itself; the row's last folder lists what it shows.
        for (let i = chain.length - 1; i >= 0; i--) {
            let row = built.get(chain[i])!;

            if (!row.host) {
                branch(row);
            }
        }

        let row = built.get(id);

        return row?.host ?? row;
    }

    function look(id: string): Mark {
        let entry = index.get(id),
            inside = -1,
            list = counts.get(id);

        if (list) {
            for (let i = list.length - 1; i > 0; i--) {
                if (list[i]) {
                    inside = i;
                    break;
                }
            }
        }

        let decoration = decorations?.get(id),
            highest = Math.max(own.get(id) ?? -1, inside),
            mine = diffs.get(id),
            total = totals.get(id),
            lines = display.stats ? [(mine?.[0] ?? 0) + (total?.[0] ?? 0), (mine?.[1] ?? 0) + (total?.[1] ?? 0)] : [0, 0],
            row = built.get(id),
            subject = entry?.element ?? { name: id },
            label = spoken(
                { ...subject, name: row?.segments ? caption(row) : subject.name, root: roots && entry?.parent === null },
                decoration,
                lines,
                inside > 0 ? RANK[inside] : undefined
            ),
            parts = badge(decoration, lines, entry && folder(entry.element) ? (highest > 0 ? RANK[highest] : '') : null),
            tone: Mark['tone'] = highest === -1 ? '' : RANK[highest];

        return { key: JSON.stringify([label, parts]), label, parts, tone };
    }

    // A notice row isn't among the built rows; a drag over one aims at its folder.
    function lookup(id: string) {
        return built.get(id) ?? rows.find((row) => row.notice && row.id === id);
    }

    // The search's mark for a row, from any of its folders: the current match wherever it sits in a compact row.
    function matched(row: Row) {
        let out: string | false = false;

        for (let node of lineage(row)) {
            let mark = search!.mark(node.id);

            if (mark === 'current') {
                return mark;
            }

            out ||= mark;
        }

        return out;
    }

    function modes() {
        return [display.deleted, display.dotfiles, display.ignored, display.stats].join();
    }

    function move(index: number, align: Align) {
        let row = rows[index];

        if (!row || !viewport) {
            return;
        }

        focus(row);

        let element = rendered.get(row);

        // Outside the rendered window; the slot scrolls it in and renders it straight away. Aligned to the top, it
        // starts the view at the rows its pinned folders will cover, one each.
        if (!element) {
            slot.scrollTo(align === 'start' ? index - pins.cover(row) : index, align);
            return;
        }

        let r = element.getBoundingClientRect(),
            v = viewport.getBoundingClientRect(),
            top = v.top + pins.cover(row) * r.height;

        if (r.top < top) {
            viewport.scrollTop -= top - r.top;
        }
        else if (r.bottom > v.bottom) {
            viewport.scrollTop += r.bottom - v.bottom;
        }
    }

    function notice(parent: Row, value: Notice): Row {
        let at = ++key,
            self = `${id}-${at}`;

        return {
            children: null,
            depth: parent.depth + 1,
            // Nameless, so type-ahead passes over it.
            element: { id: self, name: '' },
            gaps: signal(0),
            id: self,
            key: at,
            locked: true,
            notice: value,
            open: null,
            parent,
            position: 1,
            scope: parent.scope,
            size: 1
        };
    }

    function onscreen(row: Row): Attributes {
        return {
            ondisconnect: (element: HTMLElement) => {
                if (rendered.get(row) === element) {
                    rendered.delete(row);
                }
            },
            onrender: (element: HTMLElement) => {
                rendered.set(row, element);
            }
        };
    }

    function page() {
        let size = height();

        return size && viewport ? Math.max(1, Math.floor(viewport.clientHeight / size)) : 1;
    }

    // False when the tree has nothing to do with the command, leaving the key to the page.
    function perform(name: Command, row: Row) {
        switch (name) {
            case 'all':
                selection.replace(rows.filter((item) => !item.locked).map((item) => item.id));

                if (!selection.has(state.selected) && !row.locked) {
                    primary(row.id);
                }

                return true;
            case 'clear': {
                // Down to the focused row, or the primary when the focused row can't be selected. With nothing to
                // clear, Escape is left to whatever holds the tree, like a dialog closing.
                let cut = clipboard.cancel(),
                    lead = row.locked ? built.get(state.selected) : row;

                if (!cut && selection.ids.size < 2) {
                    return false;
                }

                selection.replace(lead ? [lead.id] : []);

                if (lead) {
                    anchor = lead;
                    primary(lead.id);
                }

                return true;
            }
            case 'copy':
            case 'cut': {
                let elements = targets(row, true);

                if (!operations || !elements.length) {
                    return false;
                }

                clipboard.hold(elements, name === 'cut');
                operations[name]?.(elements);
                return true;
            }
            case 'delete':
            case 'trash':
                if (!operations?.delete) {
                    return false;
                }

                void discard(targets(row, true), name === 'delete');
                return true;
            case 'duplicate': {
                let elements = targets(row, true);

                if (!operations?.duplicate || !elements.length) {
                    return false;
                }

                operations.duplicate(elements);
                return true;
            }
            case 'paste': {
                let paste = operations?.paste,
                    target = destination(segment(row));

                if (!paste) {
                    return false;
                }

                void clipboard.paste((elements, cut) => paste(elements, target, cut));
                return true;
            }
            case 'path':
            case 'relative': {
                let elements = targets(row, false);

                if (!elements.length) {
                    return false;
                }

                void writeText(elements.map((element) => address(element, name === 'relative')).join('\n'));
                return true;
            }
            case 'redo':
            case 'undo':
                if (!history || !(name === 'undo' ? history.canUndo : history.canRedo)) {
                    return false;
                }

                void history[name]();
                return true;
            case 'toggle':
                flip(row);
                return true;
        }
    }

    // The folders open here, and those still to open once they're shown or loaded.
    function persist() {
        if (!snapshot) {
            return;
        }

        let out: string[] = [];

        for (let [id, row] of built) {
            if (row.open && peek(row.open) && !unfolded.get(id)) {
                out.push(id);
            }
        }

        for (let id of initial) {
            if (!built.has(id) && (loader || index.has(id))) {
                out.push(id);
            }
        }

        snapshot.expanded = out;
    }

    // Counted among the siblings still shown, so hidden rows leave no hole in "3 of 5".
    function position(row: Row) {
        // A row still rendered as its folder folds into a compact row has no list left; it's on its way out.
        let siblings = row.parent ? row.parent.children : top;

        if (!read(row.gaps) || !siblings) {
            return row.position;
        }

        let out = 1;

        for (let i = 0, n = row.position - 1; i < n; i++) {
            if (!hidden.has(siblings[i].id)) {
                out++;
            }
        }

        return out;
    }

    // A click previews a file and a double or middle click pins it, beside the current one with Alt. Alt+click opens
    // or closes a folder with everything in it. Shift+click selects a range and Ctrl/Cmd+click toggles one row.
    function press(row: Row, event: MouseEvent) {
        let from = cursor,
            subject = pick(row, event),
            type = event.type;

        // Right clicks belong to the context menu.
        if (type === 'auxclick' && event.button !== 1) {
            return;
        }

        focus(row);

        if (type === 'click' && event.shiftKey) {
            span(from ?? row, row);
            return;
        }

        if (type === 'click' && (event.ctrlKey || event.metaKey)) {
            flip(subject);
            return;
        }

        if (!row.open) {
            activate(row, { mode: type === 'click' ? 'preview' : 'pinned', side: event.altKey });
            return;
        }

        // Whether a single click opens it; a double click does whenever that doesn't.
        let single = unfold === 'click' || twistie(event);

        if (type === 'click' && event.altKey) {
            activate(row, PREVIEW, false, subject);
            all(!peek(row.open), row);
        }
        else if (type === 'click') {
            activate(row, PREVIEW, single, subject);
        }
        else if (type === 'dblclick' && !single && !event.altKey && !row.locked) {
            fold(row, !peek(row.open));
        }
    }

    function primary(id: string) {
        quiet = id;
        state.selected = id;
    }

    // Rows hidden as their folder closes leave the selection, as in VS Code. The primary stays: it's the file the
    // editor shows, and the highlight finds it again once the folder reopens.
    function prune() {
        selection.replace([...selection.ids].filter((id) => {
            let row = built.get(id);

            return id === state.selected || (!!row && !hidden.has(id) && shown(row) === row);
        }));
    }

    function purge(ids: string[]) {
        for (let i = 0, n = ids.length; i < n; i++) {
            let id = ids[i],
                row = built.get(id);

            if (row?.open && peek(row.open) && !row.host) {
                opened--;
            }

            if (anchor?.id === id) {
                anchor = null;
            }

            built.delete(id);
            counts.delete(id);
            diffs.delete(id);
            filtered.delete(id);
            hidden.delete(id);
            initial.delete(id);
            marks.delete(id);
            notes.delete(id);
            own.delete(id);
            totals.delete(id);
        }
    }

    // Keeps the cursor on its row through a change: on the folder it went into when that's closed, or where it stood
    // once the row is gone.
    function recover(at: number) {
        if (cursor && rows.includes(cursor)) {
            return;
        }

        let row: Row | undefined;

        for (let node = cursor && index.has(cursor.id) ? cursor.id : null; node !== null; node = index.get(node)!.parent) {
            let found = built.get(node),
                candidate = found?.host ?? found;

            if (candidate && rows.includes(candidate)) {
                row = candidate;
                break;
            }
        }

        if (row) {
            focus(row);
        }
        else if (rows.length) {
            focus(rows[Math.min(Math.max(at, 0), rows.length - 1)]);
        }
        else {
            cursor = null;
            ui.focused = 0;
        }
    }

    // 'force' rebuilds the rows even when none was hidden or shown, as when folders opened or closed.
    function redisplay(force = false) {
        settle();
        filtered = filter(model.elements, display.dotfiles !== false, excluded, roots);

        let changed: string[] = [];

        for (let id of new Set([...index.keys(), ...(decorations?.keys() ?? [])])) {
            let hide = unseen(id);

            if (hide === hidden.has(id)) {
                continue;
            }

            if (hide) {
                hidden.add(id);
            }
            else {
                hidden.delete(id);
            }

            let row = built.get(id);

            if (row) {
                write(row.gaps, peek(row.gaps) + (hide ? 1 : -1));
            }

            changed.push(id);
        }

        // Hidden is already in step, so this only moves the folder marks; the rows are swapped below in one go.
        decorate(changed);

        for (let id of marks.keys()) {
            refresh(id);
        }

        if (!changed.length && !force) {
            return;
        }

        // Chains count only what's shown, so those the change joined or split are rebuilt before the rows are swapped.
        for (let group of new Set(changed.flatMap(refold))) {
            sync(group);
        }

        if (cursor?.host) {
            focus(cursor.host);
        }

        let next = visible(top),
            kept = new Set(next),
            // A hidden cursor moves to the first row after it still shown, as it does when a single row goes.
            target = cursor && !kept.has(cursor)
                ? rows.slice(rows.indexOf(cursor)).find((row) => kept.has(row)) ?? next[next.length - 1]
                : undefined;

        // Replaced in place by one splice, as 'all' does.
        rows.splice(0, rows.length, ...next.slice(0, CHUNK));
        insert(CHUNK, next.slice(CHUNK));
        prune();

        if (target) {
            focus(target);
        }
    }

    // Chains count only what's shown, so hiding or showing 'id' can join or split its own and its folder's: the
    // folders to rebuild for it, each listing a row that no longer compacts as it would now.
    function refold(id: string) {
        let out: (string | null)[] = [];

        for (let node of [id, index.get(id)?.parent ?? null]) {
            let row = node === null ? undefined : built.get(node);

            if (row && stale(row)) {
                out.push((row.host ?? row).parent?.id ?? null);
            }
        }

        return out;
    }

    function refresh(id: string) {
        let mark = marks.get(id);

        if (!mark) {
            return;
        }

        let current = peek(mark),
            next = look(id);

        if (current.key !== next.key || current.tone !== next.tone) {
            write(mark, next);
        }
    }

    // The folder to rebuild for a change inside 'id'. Folded into a compact row, or folding differently now, its rows
    // are the folder's listing that row.
    function regroup(id: string | null) {
        let row = id === null ? undefined : built.get(id);

        return row && (row.host || stale(row)) ? (row.host ?? row).parent?.id ?? null : id;
    }

    // Puts a row back after its previous visible sibling's subtree, when its folder is open and on screen.
    function restore(row: Row) {
        let parent = row.parent,
            at = parent ? rows.indexOf(parent) + 1 : 0;

        if (parent && (!peek(parent.open!) || at === 0)) {
            return;
        }

        let siblings = parent ? branch(parent) : top;

        for (let i = row.position - 2; i >= 0; i--) {
            let sibling = siblings[i];

            if (!hidden.has(sibling.id)) {
                at = rows.indexOf(sibling) + 1 + (sibling.open && peek(sibling.open) ? visible(branch(sibling)).length : 0);
                break;
            }
        }

        insert(at, [row, ...(row.open && peek(row.open) ? visible(branch(row)) : [])]);
    }

    // A change from the store, applied to the folders it touched.
    function restructure({ from = null, ids, parent, type }: Change) {
        let groups: (string | null)[] = [];

        seen = model.version;

        if (type === 'remove') {
            let edit = peek(draft),
                removed = new Set(ids);

            if (edit && ((edit.element && removed.has(edit.element.id)) || (edit.parent && removed.has(edit.parent.id)))) {
                close(false);
            }

            shift(ids, parent, null);
            purge(ids);

            // The rest of the selection takes over from a removed primary.
            if (removed.has(state.selected)) {
                primary([...selection.ids].find((id) => !removed.has(id)) ?? '');
            }
        }
        else {
            // Exclude and dotfile patterns match paths, so whatever was added, moved or renamed is checked again,
            // before the rows are built so a new row that's hidden is never inserted.
            filtered = filter(model.elements, display.dotfiles !== false, excluded, roots);

            for (let id of ids) {
                // A root added live opens, as those given at first do.
                if (roots && type === 'add' && index.get(id)?.parent === null) {
                    initial.add(id);
                }

                if (unseen(id) === hidden.has(id)) {
                    continue;
                }

                if (hidden.has(id)) {
                    hidden.delete(id);
                }
                else {
                    hidden.add(id);
                }

                // Deeper in, a folder kept as it was can still hold a chain the change joined or split.
                groups.push(...refold(id));
            }

            if (type === 'move') {
                shift(ids, from, parent);
            }

            // Hidden is already in step, so this only moves the folder marks.
            if (decorations) {
                decorate(ids);
            }
        }

        update([...(type === 'move' && from !== parent ? [from, parent] : [parent]), ...groups]);
        search?.refresh();
    }

    // Catches up on changes made while disconnected, which went unseen: every folder rebuilds when next shown.
    function resync() {
        close(false);

        for (let [id, row] of built) {
            if (index.has(id)) {
                row.children = null;
            }
            else {
                purge([id]);
            }
        }

        filtered = filter(model.elements, display.dotfiles !== false, excluded, roots);
        hidden = new Set([...filtered, ...(decorations?.keys() ?? [])].filter(gone));

        // Rolled up again from scratch by the decorations catching up on connect.
        if (decorations) {
            counts.clear();
            diffs.clear();
            own.clear();
            totals.clear();

            for (let id of marks.keys()) {
                refresh(id);
            }
        }

        seen = model.version;
        update([null]);
    }

    // Points whatever held a row at the copy replacing it.
    function retarget(row: Row, next: Row) {
        let edit = peek(draft);

        if (anchor === row) {
            anchor = next;
        }

        if (cursor === row) {
            focus(next);
        }

        if (!edit) {
            return;
        }

        if (edit.from === row) {
            edit.from = next;
        }

        if (edit.parent === row) {
            edit.parent = next;

            if (!edit.element) {
                edit.row.parent = next;
            }
        }

        if (edit.row === row) {
            edit.element = next.element;
            edit.row = next;
        }
    }

    // Selects what an undo or redo brought back, moved or renamed, in tree order, revealing the first; one that only
    // took items away selects the folder they left.
    function retrace({ operations }: Step) {
        let ids = new Set<string>(),
            left: string | null = null;

        for (let i = 0, n = operations.length; i < n; i++) {
            let operation = operations[i];

            if (operation.type === 'remove') {
                left ??= operation.parent;
            }
            else {
                ids.add(operation.element.id);
            }
        }

        if (!ids.size && left !== null) {
            ids.add(left);
        }

        // By id, since a folder folded into a compact row is selected as its segment, on the row that shows it.
        let found: { id: string; row: Row }[] = [];

        for (let id of ids) {
            let row = locate(id);

            if (row && !row.locked && !hidden.has(id)) {
                found.push({ id, row });
            }
        }

        if (!found.length) {
            return;
        }

        found.sort((a, b) => order(a.row, b.row));
        anchor = found[0].row;
        selection.replace(found.map((item) => item.id));
        primary(found[0].id);
        reveal(found[0].id, true);
    }

    // The row under a folder that failed to load tries again; the loading row does nothing.
    function retry(row: Row) {
        if (row.notice?.type === 'error' && loader?.forget(row.parent!.id)) {
            update([row.parent!.id]);
        }
    }

    function reveal(id: string, scroll: boolean) {
        let row = locate(id);

        if (!row) {
            return;
        }

        for (let node = row.parent; node; node = node.parent) {
            expand(node, true);
        }

        let at = rows.indexOf(row);

        if (at === -1) {
            return;
        }

        if (scroll) {
            move(at, 'center');
        }
        else {
            focus(row);
        }
    }

    // 'full' is the element's path from the tree's root, or from its own root under 'roots'; 'inherited' its
    // folder's tint.
    function scope(element: Element, full: string, inherited: string) {
        for (let i = 0, n = scopes.length; i < n; i++) {
            let match = scopes[i].match;

            if (typeof match === 'function' ? match(element) : match.test(full)) {
                return scopes[i].color;
            }
        }

        return inherited;
    }

    // What a command on 'row' acts on: the folder of a compact row's selected segment, or the row's own.
    function segment(row: Row) {
        return row.segments?.find((node) => node.id === state.selected) ?? row;
    }

    // Splits a compact row at 'row', which shows as the last folder of what's left of it; the chain joins again once
    // the name input closes.
    function separate(row: Row) {
        split = row.id;
        update([row.id]);

        return built.get(row.id)!;
    }

    function settle() {
        if (!motion) {
            return;
        }

        cancelAnimationFrame(motion.frame);
        motion.element.removeAttribute('data-motion');
        motion.ghosts.remove();
        motion = null;
        root?.removeAttribute('data-motion');
        root?.style.removeProperty('--motion-rows');

        for (let row of revealing.keys()) {
            rendered.get(row)?.removeAttribute('data-reveal');
        }

        revealing.clear();
    }

    // Moves the rollup that 'ids' carry, their tones and their lines, from one chain of folders to another; null ends
    // a chain.
    function shift(ids: string[], from: string | null, to: string | null) {
        for (let i = 0, n = ids.length; i < n; i++) {
            let lines = diffs.get(ids[i]),
                value = lift(own.get(ids[i]) ?? -1);

            if (value > 0 || lines) {
                tally(from, value, lines, -1);
                tally(to, value, lines, 1);
            }
        }
    }

    // The names a new or renamed item can clash with. Deleted files are gone from disk, even shown, so theirs are free.
    function siblings(parent: Element | null) {
        return (parent ? parent.children ?? [] : model.elements).filter((element) => decorations?.get(element.id)?.status !== 'deleted');
    }

    // Filter mode's view: the rows the search keeps stay, and the folders down to its matches open while it lasts;
    // null ends it. Each folder opens once, so one the reader closes meanwhile stays closed. Ending closes only the
    // folders it opened, bar those down to the cursor and the primary, which would otherwise drop out of view.
    //
    // Chains follow the view as they follow anything else hiding rows, so its rows are laid out first and the
    // folders opened on the chains it makes. A closed folder it folds into a compact row reads as open there, so it
    // counts as opened by the search, and closes again once the chain splits.
    function sift(folders: string[] | null) {
        let changed = false,
            next = new Set(folders),
            shut = compact ? [...built.values()].filter((row) => row.open && !row.host && !peek(row.open)).map((row) => row.id) : [],
            spared = new Set<string>();

        redisplay();

        for (let i = 0, n = shut.length; i < n; i++) {
            if (built.get(shut[i])?.host && !unfolded.has(shut[i])) {
                unfolded.set(shut[i], true);
            }
        }

        if (!folders) {
            for (let row of [cursor, built.get(state.selected)]) {
                for (let node of row ? ancestors(row) : []) {
                    spared.add(node.id);
                }
            }
        }

        for (let [id, mine] of unfolded) {
            if (next.has(id)) {
                continue;
            }

            let row = built.get(id);

            unfolded.delete(id);

            if (!mine || spared.has(id) || !row?.open || !peek(row.open)) {
                continue;
            }

            // One still folded counts among the open folders only once it shows its own row, closed now.
            write(row.open, false);
            opened -= row.host ? 0 : 1;
            changed = true;
        }

        for (let id of folders ?? []) {
            if (unfolded.has(id)) {
                continue;
            }

            // Built with the folders above it.
            locate(id);

            let row = built.get(id),
                open = !!row?.open && !row.host && !row.locked && !peek(row.open);

            unfolded.set(id, open);

            if (open) {
                write(row!.open!, true);
                opened++;
                changed = true;
            }
        }

        redisplay(changed);
        ui.any = opened > 0;
        persist();
    }

    // Shift+click and Shift+arrows: the rows from the anchor to 'to' become the selection. Without an anchor still on
    // screen, the range starts where the cursor was.
    function span(from: Row, to: Row) {
        if (!anchor || rows.indexOf(anchor) === -1) {
            anchor = from.locked ? to : from;
        }

        let a = rows.indexOf(anchor),
            b = rows.indexOf(to),
            ids: string[] = [];

        for (let i = Math.min(a, b), n = Math.max(a, b); i <= n; i++) {
            if (!rows[i].locked) {
                ids.push(rows[i].id);
            }
        }

        selection.replace(ids);
        primary(anchor.locked ? (ids[0] ?? '') : anchor.id);
    }

    // Whether the row compacts, as built, other than it would now.
    function stale(row: Row) {
        let now = joined(index.get(row.id)?.element ?? row.element),
            was = row.host ? lineage(row.host)[lineage(row).length] : undefined;

        return (now?.id ?? null) !== (was?.id ?? null);
    }

    // Replaces rows 'at' to 'end' with 'next', splicing only the stretch that differs so the rest stay rendered.
    function swap(at: number, end: number, next: Row[]) {
        let head = 0,
            n = next.length,
            tail = 0;

        while (head < n && at + head < end && rows[at + head] === next[head]) {
            head++;
        }

        while (tail < n - head && tail < end - at - head && rows[end - tail - 1] === next[n - tail - 1]) {
            tail++;
        }

        let items = next.slice(head, n - tail),
            removed = end - at - head - tail;

        if (!items.length && !removed) {
            return;
        }

        rows.splice(at + head, removed, ...items.slice(0, CHUNK));
        insert(at + head + CHUNK, items.slice(CHUNK));
    }

    // Rebuilds a folder's rows from its element's children, or the top level's for null.
    function sync(target: string | null) {
        let row = target === null ? null : built.get(target);

        // Never built, so it builds fresh when it opens.
        if (row === undefined || (row && !row.children)) {
            return;
        }

        let next: Row[];

        if (row) {
            row.children = null;
            next = branch(row);
        }
        else {
            next = top = build(model.elements, 0, null);
        }

        let at = row ? rows.indexOf(row) + 1 : 0,
            end = row ? at : rows.length;

        if (row && (at === 0 || !peek(row.open!))) {
            return;
        }

        while (row && end < rows.length && rows[end].depth > row.depth) {
            end++;
        }

        swap(at, end, visible(next));
    }

    // Adds or takes away one row's tone and lines along a chain of folders.
    function tally(start: string | null, value: number, lines: number[] | undefined, sign: 1 | -1) {
        for (let parent = start; parent !== null; parent = index.get(parent)?.parent ?? null) {
            if (value > 0) {
                let list = counts.get(parent);

                if (!list) {
                    counts.set(parent, list = new Array(RANK.length).fill(0));
                }

                list[value] += sign;
            }

            if (lines) {
                let total = totals.get(parent);

                if (!total) {
                    totals.set(parent, total = [0, 0]);
                }

                total[0] += sign * lines[0];
                total[1] += sign * lines[1];
            }

            refresh(parent);
        }
    }

    // What a command acts on: the selection when the focused row is part of it, else the focused row alone, as in
    // VS Code. Moving a selected folder carries its contents, so 'distinct' drops selected rows inside one. Roots
    // never move, so 'distinct' drops them instead, leaving what's selected inside them.
    function targets(row: Row, distinct: boolean) {
        let subject = segment(row);

        if (!selection.has(subject.id)) {
            return subject.locked || (distinct && header(subject)) ? [] : [subject.element];
        }

        let out: Element[] = [];

        for (let i = 0, n = rows.length; i < n; i++) {
            // Any of a compact row's folders can be selected.
            for (let candidate of lineage(rows[i])) {
                let nested = distinct && ancestors(candidate).some((node) => selection.has(node.id) && !header(node));

                if (selection.has(candidate.id) && !nested && !(distinct && header(candidate))) {
                    out.push(candidate.element);
                }
            }
        }

        return out;
    }

    // Created when a row first renders; every later change is a single write the row alone reacts to.
    function track(id: string) {
        let mark = marks.get(id);

        if (!mark) {
            marks.set(id, mark = signal(look(id)));
        }

        return mark;
    }

    function typeahead(character: string, from: number) {
        let now = performance.now(),
            next = (now - typedAt > TYPEAHEAD ? '' : typed) + character.toLowerCase(),
            // Repeating one letter cycles through the rows that start with it.
            repeat = [...next].every((c) => c === next[0]),
            start = repeat ? from + 1 : from;

        typed = repeat ? next[0] : next;
        typedAt = now;

        for (let i = 0, n = rows.length; i < n; i++) {
            let index = (start + i) % n;

            if (caption(rows[index]).toLowerCase().startsWith(typed)) {
                return index;
            }
        }

        return -1;
    }

    // A pinned folder's own row is scrolled back to where its copy sits, then clicked, so a folder that closes stays
    // under the pointer with the rows after it following on.
    function unpin(row: Row) {
        move(rows.indexOf(row), 'start');
        // Once the list has rendered the rows it scrolled to, so the folder closes with its motion.
        requestAnimationFrame(() => activate(row, PREVIEW));
    }

    // Out of view: hidden for good, or left out by a search filtering the rows.
    function unseen(id: string) {
        return gone(id) || !!search?.hides(id);
    }

    // Rebuilds the folders a change touched, then finds the cursor again.
    function update(folders: (string | null)[]) {
        settle();

        let at = cursor ? rows.indexOf(cursor) : 0;

        for (let i = 0, n = folders.length; i < n; i++) {
            sync(regroup(folders[i]));
        }

        prune();
        clipboard.retain((id) => model.get(id));
        recover(at);
        ui.any = opened > 0;
        persist();
    }

    // The rows a reader can see: every row not inside a closed folder.
    function visible(list: Row[], out: Row[] = []) {
        let edit = peek(draft);

        // A new item's input sits first in its folder.
        if (edit && !edit.element && list === (edit.parent ? edit.parent.children : top)) {
            out.push(edit.row);
        }

        // Only a root with no children at all has a note, so one row hiding or showing never adds or drops it.
        if (roots && !list.length && list !== top) {
            let root = top.find((row) => row.children === list);

            if (root) {
                out.push(blank(root));
            }
        }

        for (let i = 0, n = list.length; i < n; i++) {
            let row = list[i];

            if (hidden.has(row.id)) {
                continue;
            }

            out.push(row);

            if (row.open && peek(row.open)) {
                visible(branch(row), out);
            }
        }

        return out;
    }

    return html`
        <div
            class='file-tree ${indicator !== 'never' && 'file-tree--indicator'} ${indicator === 'hover' && 'file-tree--indicator-hover'}'
            ${attributes}
            ${dragging?.root}
            ${{
                onanimationend: (event: AnimationEvent) => {
                    if (event.target === root) {
                        settle();
                    }
                },
                onconnect: () => {
                    forget = history?.subscribe(retrace);
                    unwatch = model.subscribe(restructure);

                    if (seen !== model.version) {
                        resync();
                    }

                    effects.push(
                        // Selection written from outside, like an editor switching tabs, becomes the whole selection
                        // and opens the folders down to it.
                        effect(() => state.selected, (value) => {
                            if (value === known) {
                                return;
                            }

                            known = value;

                            if (!selection.has(value)) {
                                anchor = built.get(value) ?? null;
                                selection.replace(value ? [value] : []);
                            }

                            if (value !== quiet && autoreveal !== 'off') {
                                reveal(value, autoreveal === 'on');
                            }

                            quiet = null;
                        }),
                        effect(() => state.selection, (value) => {
                            if (!value || value === selection.ids) {
                                return;
                            }

                            selection.replace(value);

                            if (!value.has(state.selected)) {
                                primary(value.values().next().value ?? '');
                            }
                        }),
                        // Display written from outside, like a settings toggle, hides and shows rows in place.
                        effect(modes, (value) => {
                            if (value !== settings) {
                                settings = value;
                                redisplay();
                                search?.refresh();
                            }
                        })
                    );

                    if (typeof phrase === 'function') {
                        effects.push(effect(phrase, (value) => {
                            write(given, value);
                        }));
                    }

                    // Changes made while disconnected went unsearched.
                    search?.refresh();

                    if (snapshot?.scroll) {
                        let offset = snapshot.scroll;

                        requestAnimationFrame(() => {
                            viewport!.scrollTop = offset;
                        });
                    }

                    detach = editor?.subscribe((request) => {
                        if (request.action === 'cancel') {
                            close(!!viewport?.contains(document.activeElement));
                        }
                        else {
                            begin(request.action, request.target);
                        }
                    });

                    if (!decorations) {
                        return;
                    }

                    // A file shown again, no longer ignored or deleted, may match.
                    unsubscribe = decorations.subscribe((ids) => {
                        decorate(ids);
                        search?.refresh();
                    });
                    // Catches up on whatever changed while disconnected, including ids since cleared.
                    decorate(new Set([...own.keys(), ...decorations.keys()]));
                },
                ondisconnect: () => {
                    clearTimeout(timer);
                    search?.dispose();
                    detach?.();
                    detach = undefined;

                    for (let dispose of effects.splice(0)) {
                        dispose();
                    }

                    forget?.();
                    forget = undefined;
                    unsubscribe?.();
                    unsubscribe = undefined;
                    unwatch?.();
                    unwatch = undefined;
                },
                onrender: (element: HTMLElement) => {
                    root = element;
                }
            }}
        >
            <div
                aria-label='${label}'
                aria-multiselectable='true'
                class='file-tree-viewport'
                id='${id}'
                role='tree'
                tabindex='0'
                ${dragging?.viewport}
                ${{
                    'aria-activedescendant': () => ui.focused > 0 && `${id}-${ui.focused}`,
                    oncontextmenu: (event: MouseEvent) => {
                        if (!menu || !viewport) {
                            return;
                        }

                        event.preventDefault();

                        let item = (event.target as HTMLElement).closest<HTMLElement>('.file-tree-row'),
                            // Shift+F10 and the menu key fire on the tree itself, with no pointer to place the menu at.
                            keyboard = !item && event.button !== 2,
                            row = keyboard ? cursor : item && built.get(item.dataset.id!);

                        if (!row) {
                            menu([], { x: event.clientX, y: event.clientY }, false);
                            return;
                        }

                        let subject = keyboard ? segment(row) : pick(row, event);

                        if (!subject.locked && !selection.has(subject.id)) {
                            anchor = row;
                            selection.replace([subject.id]);
                            primary(subject.id);
                        }

                        focus(row);

                        let box = keyboard ? (rendered.get(row) ?? viewport).getBoundingClientRect() : null;

                        menu(targets(row, false), box ? { x: box.left, y: box.bottom } : { x: event.clientX, y: event.clientY }, header(row));
                    },
                    onkeydown: (event: KeyboardEvent) => {
                        if (search?.key(event)) {
                            event.preventDefault();
                            return;
                        }

                        let index = cursor ? rows.indexOf(cursor) : -1,
                            row = rows[index];

                        if (!row || !viewport) {
                            return;
                        }

                        let name = command(event);

                        if (name && perform(name, row)) {
                            event.preventDefault();
                            return;
                        }

                        let align: Align = 'end',
                            target = -1;

                        switch (event.key) {
                            // Opens every folder beside the cursor's row, one level deep.
                            case '*': {
                                let siblings = row.parent ? branch(row.parent) : top;

                                for (let i = 0, n = siblings.length; i < n; i++) {
                                    if (!siblings[i].locked) {
                                        expand(siblings[i], true);
                                    }
                                }

                                break;
                            }
                            case 'ArrowDown':
                                target = index + 1;
                                break;
                            case 'ArrowUp':
                                align = 'start';
                                target = index - 1;
                                break;
                            case 'End':
                                target = rows.length - 1;
                                break;
                            case 'Enter':
                            case ' ':
                                activate(row, event.key === ' ' ? PREVIEW : { mode: 'pinned', side: event.ctrlKey || event.metaKey });
                                break;
                            // Next and previous change, as in VS Code's editor.
                            case 'F5':
                                if (!event.altKey) {
                                    return;
                                }

                                jump(event.shiftKey ? -1 : 1);
                                break;
                            case 'F2':
                                begin('rename');
                                break;
                            case 'Home':
                                align = 'start';
                                target = 0;
                                break;
                            case 'PageDown':
                                target = Math.min(rows.length - 1, index + page());
                                break;
                            case 'PageUp':
                                align = 'start';
                                target = Math.max(0, index - page());
                                break;
                            case 'ArrowLeft':
                            case 'ArrowRight': {
                                // Arrows point into and out of folders; flipped for right-to-left layouts.
                                let inward = (event.key === 'ArrowRight') !== (getComputedStyle(viewport).direction === 'rtl'),
                                    open = row.open && peek(row.open);

                                // Alt opens or closes the folder with everything in it.
                                if (event.altKey && row.open && (inward || open)) {
                                    all(inward, row);
                                }
                                else if (inward && row.open && !row.locked) {
                                    if (!open) {
                                        fold(row, true);
                                    }
                                    else if (row.element.children?.length) {
                                        target = index + 1;
                                    }
                                }
                                else if (!inward && open) {
                                    fold(row, false);
                                }
                                else if (!inward && row.parent) {
                                    align = 'start';
                                    target = rows.indexOf(row.parent);
                                }
                                break;
                            }
                            default:
                                // By code, since macOS turns Alt+N into a symbol.
                                if (shortcuts && event.altKey && event.code === 'KeyN' && !event.ctrlKey && !event.metaKey) {
                                    begin(event.shiftKey ? 'folder' : 'file');
                                    break;
                                }

                                if (event.key.length !== 1 || event.altKey || event.ctrlKey || event.metaKey) {
                                    return;
                                }

                                if (search && typing === 'find') {
                                    search.type(event.key);
                                }
                                else {
                                    target = typeahead(event.key, index);
                                }
                        }

                        event.preventDefault();

                        if (target !== -1) {
                            if (rows[target] && extending(event)) {
                                span(row, rows[target]);
                            }

                            move(target, align);

                            if (cursor && cursor !== row) {
                                follow(cursor);
                            }
                        }
                    },
                    ondisconnect: () => {
                        release?.();
                    },
                    onrender: (element: HTMLElement) => {
                        viewport = element;
                        // Delegated mousedown is passive, so bind directly.
                        element.addEventListener('mousedown', middle);
                        release = () => element.removeEventListener('mousedown', middle);
                    },
                    onscroll: () => {
                        // The copies are laid out against the rows as they stood; once scrolled they no longer line up.
                        settle();
                        pins.update();

                        if (snapshot) {
                            snapshot.scroll = viewport!.scrollTop;
                        }
                    }
                }}
                ${hint ? {
                    onpointerleave: (event: PointerEvent) => {
                        if (event.pointerType !== 'touch') {
                            tip.release();
                        }
                    },
                    onpointerover: (event: PointerEvent) => {
                        let scroller = event.currentTarget as HTMLElement,
                            target = (event.target as HTMLElement).closest<HTMLElement>('.file-tree-row'),
                            row = target && built.get(target.dataset.id!);

                        // Between rows, in the space beside a nested one, the tooltip stays on the last row.
                        if (!target || !row) {
                            return;
                        }

                        // Past the tree's edge, in line with the row, so it glides straight up and down between rows.
                        tip.request(target, about(row), () => {
                            let box = scroller.getBoundingClientRect(),
                                rect = target.getBoundingClientRect();

                            return new DOMRect(box.left, rect.top, box.width, rect.height);
                        });
                    }
                } : undefined}
            >
                ${highlight({ class: 'file-tree-highlight', target: '.file-tree-row' })}
                ${pins.render()}
                ${slot.fragment}
            </div>

            ${() => empty && !rows.length && !search?.filtering() && html`<div class='file-tree-empty'>${empty()}</div>`}

            ${search?.render(id)}

            ${hint && tip.render({ 'aria-hidden': 'true', class: 'file-tree-tooltip' })}

            ${toggle && html`
                <button
                    class='button file-tree-toggle'
                    onclick='${() => all(!ui.any)}'
                    type='button'
                >
                    ${() => ui.any ? 'Collapse all' : 'Expand all'}
                </button>
            `}

            ${dragging?.ghost}
        </div>
    `;
};

export { Decorations as FileTreeDecorations, Editor as FileTreeEditor, Elements as FileTreeElements, History as FileTreeHistory };
export type {
    Badge as FileTreeBadge,
    Change as FileTreeChange,
    Controller as FileTreeController,
    Decoration as FileTreeDecoration,
    Drag as FileTreeDrag,
    Drop as FileTreeDrop,
    Element as FileTreeElement,
    HistoryEntry as FileTreeHistoryEntry,
    Operation as FileTreeHistoryOperation,
    HistoryOptions as FileTreeHistoryOptions,
    Place as FileTreeHistoryPlace,
    Step as FileTreeHistoryStep,
    Indicator as FileTreeIndicator,
    Kind as FileTreeKind,
    Load as FileTreeLoad,
    Open as FileTreeOpen,
    Operations as FileTreeOperations,
    Result as FileTreeResult,
    Scope as FileTreeScope,
    Snapshot as FileTreeSnapshot,
    Sort as FileTreeSort,
    Case as FileTreeSortCase,
    Options as FileTreeSortOptions,
    Order as FileTreeSortOrder,
    State as FileTreeState,
    Status as FileTreeStatus
};
