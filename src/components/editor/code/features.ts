import { effect, reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import colorPicker from '~/components/color-picker';
import icon from '~/components/icon';
import tooltip from '~/components/tooltip';
import { changeLines, lineChanges, revertChange, type LineChange } from './changes';
import { colorLiterals, formatColor, toHex, type ColorLiteral } from './colors';
import { conflictsOf, resolveConflict, tints, type Block, type Conflict, type Resolution, type Tint } from './conflicts';
import type { Edit, EditorDocument } from './document';
import { stickyFolds, structureOf, type FoldRange } from './folding';
import type { Navigation } from './keymap';
import type { EditorLayout, Rect } from './layout';
import { linksIn, type Link } from './links';
import type { NativeText } from './projection';
import { markup, tokens as lineTokens, type Mark } from './rows';
import type { Entry } from './services';
import type { Language, SyntaxCache, Token } from './syntax';
import { describeSuspect, suspects, type Suspect } from './unicode';
import arrowDown from '@esportsplus/ui/svg/arrow-down.svg';
import arrowUp from '@esportsplus/ui/svg/arrow-up.svg';
import close from '@esportsplus/ui/svg/close.svg';
import undo from '@esportsplus/ui/svg/undo.svg';


// What the editor's extras reach in the view.
type Host = {
    busy: () => boolean;
    cache: () => SyntaxCache;
    charWidth: () => number;
    document: () => EditorDocument;
    // Applies one undoable edit with the caret at 'caret', as a command would; false while read-only.
    edit: (edit: Edit, caret: number) => boolean;
    focus: VoidFunction;
    folded: () => readonly FoldRange[];
    // Hides the hover card.
    hide: VoidFunction;
    language: () => Language;
    layout: () => EditorLayout | null;
    lineHeight: () => number;
    // Shows a message on the hover card at a source offset.
    notice: (offset: number, text: string) => void;
    offsetAt: (clientX: number, clientY: number) => number | null;
    // The language server's diagnostics, sorted by offset.
    problems: () => readonly Entry[];
    projection: () => NativeText;
    readonly: () => boolean;
    // Client caret rectangle of a source offset.
    rectAt: (offset: number) => Rect | null;
    // Puts the caret at a source offset and scrolls it into view.
    reveal: (offset: number) => void;
    schedule: VoidFunction;
    // Scrolls so that content y 'top' is at the top of the view.
    scrollTo: (top: number) => void;
    // Token colors of a native line, as its row paints them.
    tokens: (index: number) => readonly Token[];
    // The text layers' horizontal offset, reactive.
    x: () => number;
};

type Lens = { readonly: boolean; style: string };

type Settings = {
    colors: boolean;
    links: boolean | ((url: string) => void);
    onMerge?: (conflict: Conflict) => void;
    rulers: readonly number[];
    sticky: number;
    unicode: boolean;
};

type Sticky = { html: string; index: number; number: number };


// Gutter changes are recomputed this long after the last edit.
const BASELINE_DELAY = 250;

const EMPTY: readonly never[] = [];

// Lines cached per kind before the cache starts over.
const MEMO = 2000;

// Rulers drawn at most.
const RULERS = 12;

// Sticky headers pinned when 'sticky' is true, and at most.
const STICKY = 5;

const STICKY_MAX = 20;

// Fold structure for sticky scroll is rebuilt this long after the last edit.
const STRUCTURE_DELAY = 300;


// Clicks on the editor's own controls keep focus, and so the caret and selection, in the text.
function keep(e: MouseEvent) {
    e.preventDefault();
}

// A color the browser resolves, for notations without arithmetic here; null when it can't.
function resolveColor(value: string) {
    let context = document.createElement('canvas').getContext('2d', { willReadFrequently: true });

    if (!context) {
        return null;
    }

    context.canvas.width = context.canvas.height = 1;
    context.fillStyle = value;
    context.fillRect(0, 0, 1, 1);

    let [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;

    return toHex(`rgba(${r}, ${g}, ${b}, ${a / 255})`);
}

function same(a: readonly number[], b: readonly number[]) {
    return a.length === b.length && a.every((value, i) => value === b[i]);
}


// The code editor's extras over its rows: sticky scroll, color swatches with a picker, links, unicode warnings,
// rulers, the git gutter with its peek, and conflict blocks with their lenses. Each paints through the rows and
// decorations the view already has, and per line work is cached by the line's text.
const features = (host: Host, apple: boolean) => {
    let anchor: HTMLElement | undefined,
        baseline: string | null = null,
        blocks: { document: EditorDocument | null; list: Block[]; revision: number; tints: Map<number, Tint> } = { document: null, list: [], revision: -1, tints: new Map() },
        changes: LineChange[] = [],
        kinds = new Map<number, LineChange['kind']>(),
        lenses = reactive([] as Lens[]),
        link: Link | null = null,
        memo = { cache: null as SyntaxCache | null, colors: new Map<string, ColorLiteral[]>(), document: null as EditorDocument | null, revision: -1, suspects: new Map<string, Suspect[]>() },
        // Where the pointer last was, for links that show once Mod goes down without it moving.
        mouse: { x: number; y: number } | null = null,
        noticed = -1,
        peek = reactive({ index: -1, kind: '', label: '', lines: '', open: false, top: 0 }),
        pick: { document: EditorDocument; from: number; initial: string; literal: string; state: { error: string; value: string }; to: number } | null = null,
        seen = { document: null as EditorDocument | null, revision: -1 },
        settings: Settings = { colors: false, links: false, rulers: [], sticky: 0, unicode: true },
        sticky = reactive([] as Sticky[]),
        stuck = '',
        structure: { cache: SyntaxCache | null; folds: FoldRange[]; revision: number } = { cache: null, folds: [], revision: -1 },
        timers: { baseline?: ReturnType<typeof setTimeout>; structure?: ReturnType<typeof setTimeout> } = {},
        tipState = reactive({ active: false, index: -1 }),
        tip = tooltip.shared({ direction: 's', interactive: true, state: tipState }),
        view = reactive({ pointer: false, rulers: '', sticky: 0 });

    let stop = effect(() => tipState.active, (active) => {
        if (!active) {
            commit();
        }
    });

    function blocksOf() {
        let doc = host.document();

        if (blocks.document !== doc || blocks.revision !== doc.revision) {
            let list = conflictsOf(doc.value);

            blocks = { document: doc, list, revision: doc.revision, tints: list.length ? tints(list) : new Map() };
        }

        return blocks.list;
    }

    // The caret's end, where navigation starts from.
    function caret() {
        let selection = host.document().selection;

        return selection.direction === 'backward' ? selection.start : selection.end;
    }

    // Applies the color the picker settled on, once it closes, as one edit.
    function commit() {
        let current = pick;

        pick = null;

        if (!current) {
            return;
        }

        let doc = host.document(),
            value = current.state.value;

        if (
            !value ||
            value.toUpperCase() === current.initial.toUpperCase() ||
            doc !== current.document ||
            doc.value.slice(current.from, current.to) !== current.literal
        ) {
            return;
        }

        let insert = formatColor(current.literal, value);

        host.edit({ from: current.from, insert, to: current.to }, current.from + insert.length);
        host.focus();
    }

    function conflict(block: Block): Conflict {
        return { base: block.base, current: block.current, end: block.end, incoming: block.incoming, line: block.line, start: block.start };
    }

    // Fold structure for sticky scroll: built at once for a new document or language, and otherwise rebuilt after
    // edits settle, keeping the last one meanwhile.
    function foldsOf() {
        let cache = host.cache(),
            revision = host.document().revision;

        if (structure.cache !== cache) {
            structure = { cache, folds: structureOf(cache).folds, revision };
        }
        else if (structure.revision !== revision && !timers.structure) {
            timers.structure = setTimeout(() => {
                timers.structure = undefined;
                structure = { cache, folds: structureOf(cache).folds, revision: host.document().revision };
                stuck = '';
                host.schedule();
            }, STRUCTURE_DELAY);
        }

        return structure.folds;
    }

    // The link under a client point, in source offsets.
    function linkAt(x: number, y: number): Link | null {
        let offset = host.offsetAt(x, y);

        if (offset === null || !settings.links) {
            return null;
        }

        let doc = host.document(),
            line = doc.lineAt(offset),
            start = doc.lineStart(line),
            list = linksIn(doc.lineText(line), typeof settings.links === 'function');

        for (let i = 0, n = list.length; i < n; i++) {
            let item = list[i];

            if (offset >= start + item.from && offset < start + item.to) {
                let left = host.rectAt(start + item.from),
                    right = host.rectAt(start + item.to);

                if (left && right && y >= left.top && y < right.top + right.height && (right.top > left.top || (x >= left.left && x < right.left))) {
                    return { from: start + item.from, to: start + item.to, url: item.url };
                }
            }
        }

        return null;
    }

    // Color literals of a native line, relative to its start.
    function literals(index: number, from: number, to: number, text: string) {
        let language = host.language(),
            stylesheet = language === 'css' || language === 'scss' || language === 'html';

        if (language === 'plain' || (!stylesheet && text.indexOf('#') === -1 && text.indexOf('(') === -1)) {
            return EMPTY;
        }

        refresh();

        let found = memo.colors.get(text);

        if (!found) {
            if (memo.colors.size > MEMO) {
                memo.colors.clear();
            }

            found = colorLiterals(text, lineTokens(host.cache(), host.document(), host.projection(), host.folded(), index, from, to), language);
            memo.colors.set(text, found);
        }

        return found;
    }

    function mod(e: KeyboardEvent | MouseEvent) {
        return apple ? e.metaKey : e.ctrlKey;
    }

    // Moves to the change, conflict or problem after or before the caret, wrapping around.
    function navigate(kind: Navigation, backward: boolean) {
        if (host.busy()) {
            return false;
        }

        let doc = host.document(),
            at = caret();

        if (kind === 'problem') {
            let list = host.problems(),
                entry: Entry | undefined;

            if (!list.length) {
                return false;
            }

            if (backward) {
                for (let i = list.length - 1; i >= 0 && !entry; i--) {
                    if (list[i].from < at) {
                        entry = list[i];
                    }
                }
            }
            else {
                entry = list.find((item) => item.from > at);
            }

            entry ??= backward ? list[list.length - 1] : list[0];
            noticed = -1;
            host.reveal(entry.from);
            host.notice(entry.from, entry.label);

            return true;
        }

        if (kind === 'conflict') {
            let list = blocksOf(),
                block = backward ? [...list].reverse().find((item) => item.end <= at) : list.find((item) => item.start > at);

            block ??= backward ? list[list.length - 1] : list[0];

            if (!block) {
                return false;
            }

            host.reveal(block.start);

            return true;
        }

        sync();

        if (!changes.length) {
            return false;
        }

        let line = doc.lineAt(at),
            index = backward
                ? changes.findLastIndex((item) => Math.max(item.from, item.to - 1) < line)
                : changes.findIndex((item) => item.from > line);

        if (index === -1) {
            index = backward ? changes.length - 1 : 0;
        }

        reveal(index);

        if (peek.open) {
            open(index);
        }

        return true;
    }

    // Shows the peek for change 'index'.
    function open(index: number) {
        let change = changes[index];

        if (!change || baseline === null) {
            peek.open = false;
            return;
        }

        let lines = baseline.split(/\r\n|\r|\n/).slice(change.original.from, change.original.to);

        peek.index = index;
        peek.kind = change.kind;
        peek.label = `${change.kind === 'added' ? 'Added' : change.kind === 'deleted' ? 'Deleted' : 'Changed'}: ${index + 1} of ${changes.length}`;
        peek.lines = change.kind === 'added' ? 'Lines added since the baseline.' : lines.join('\n');
        peek.open = true;
        host.schedule();
    }

    function paintLenses(layout: EditorLayout, first: number, last: number) {
        let list = blocksOf(),
            doc = host.document(),
            projection = host.projection(),
            lineHeight = host.lineHeight(),
            readonly = host.readonly(),
            items: string[] = [];

        for (let i = 0, n = list.length; i < n; i++) {
            let start = doc.lineStart(list[i].line - 1),
                native = projection.toNative(start);

            if (projection.toSource(native) !== start) {
                items.push('display: none;');
                continue;
            }

            let index = layout.lineAt(native);

            if (index < first || index >= last) {
                items.push('display: none;');
                continue;
            }

            let end = layout.rect(layout.end(index));

            items.push(`height: ${lineHeight}px; left: ${end.left + 2 * host.charWidth()}px; top: ${end.top}px;`);
        }

        while (lenses.length < items.length) {
            lenses.push(reactive({ readonly, style: '' }));
        }

        if (lenses.length > items.length) {
            lenses.splice(items.length, lenses.length - items.length);
        }

        for (let i = 0, n = items.length; i < n; i++) {
            if (lenses[i].style !== items[i]) {
                lenses[i].style = items[i];
            }

            if (lenses[i].readonly !== readonly) {
                lenses[i].readonly = readonly;
            }
        }
    }

    function paintPeek(layout: EditorLayout) {
        if (!peek.open) {
            return;
        }

        let change = changes[peek.index];

        if (!change) {
            peek.open = false;
            return;
        }

        let doc = host.document(),
            projection = host.projection(),
            line = Math.min(change.kind === 'deleted' ? change.from : change.to - 1, doc.lineCount - 1),
            index = layout.lineAt(projection.toNative(doc.lineStart(line))),
            top = layout.top(index) + (change.kind === 'deleted' ? 0 : layout.rows(index) * host.lineHeight());

        if (top !== peek.top) {
            peek.top = top;
        }
    }

    function paintSticky(layout: EditorLayout, scrollTop: number, padTop: number) {
        let cap = settings.sticky;

        if (!cap || scrollTop <= padTop) {
            setSticky([], '');
            return;
        }

        let doc = host.document(),
            projection = host.projection(),
            index = layout.indexAt(scrollTop - padTop),
            top = layout.number(index),
            folds = foldsOf(),
            key = `${doc.revision}:${top}:${cap}:${host.folded().length}:${folds.length}:${structure.revision}`;

        if (key === stuck) {
            return;
        }

        let list = stickyFolds(folds, top, cap),
            rows: Sticky[] = [];

        for (let i = 0, n = list.length; i < n; i++) {
            let start = doc.lineStart(list[i].line - 1),
                native = projection.toNative(start);

            if (projection.toSource(native) !== start) {
                continue;
            }

            let line = layout.lineAt(native),
                from = layout.lineFrom(line);

            rows.push({ html: markup(projection.value.slice(from, layout.end(line)), host.tokens(line), [], false), index: line, number: list[i].line });
        }

        setSticky(rows, key);
    }

    // Draws the baseline's changes again from the document as it is now.
    function recompute() {
        clearTimeout(timers.baseline);
        timers.baseline = undefined;

        let doc = host.document();

        changes = baseline === null ? [] : lineChanges(baseline, doc.value);
        kinds = changeLines(changes, doc.lineCount);
        seen = { document: doc, revision: doc.revision };

        if (peek.open && peek.index < changes.length) {
            open(peek.index);
        }
        else {
            peek.open = false;
        }

        host.schedule();
    }

    // Drops per-line results that the document, its revision or the syntax cache made stale.
    function refresh() {
        let doc = host.document(),
            cache = host.cache();

        if (memo.document !== doc || memo.revision !== doc.revision || memo.cache !== cache) {
            memo.cache = cache;
            memo.colors.clear();
            memo.document = doc;
            memo.revision = doc.revision;
        }
    }

    function reveal(index: number) {
        let change = changes[index],
            doc = host.document();

        host.reveal(doc.lineStart(Math.min(change.from, doc.lineCount - 1)));
    }

    function rulers() {
        let width = host.charWidth(),
            columns = settings.rulers;

        view.rulers = columns.length
            ? `background: ${columns.map((column) => `linear-gradient(var(--ruler-color), var(--ruler-color)) ${column * width}px 0 / var(--ruler-width) 100% no-repeat`).join(', ')}; width: ${(Math.max(...columns) + 1) * width}px;`
            : 'display: none;';
    }

    function setSticky(rows: Sticky[], key: string) {
        stuck = key;

        while (sticky.length < rows.length) {
            sticky.push(reactive({ html: '', index: -1, number: 0 }));
        }

        if (sticky.length > rows.length) {
            sticky.splice(rows.length, sticky.length - rows.length);
        }

        for (let i = 0, n = rows.length; i < n; i++) {
            let row = sticky[i];

            if (row.html !== rows[i].html) {
                row.html = rows[i].html;
            }

            row.index = rows[i].index;
            row.number = rows[i].number;
        }

        if (view.sticky !== rows.length) {
            view.sticky = rows.length;
        }
    }

    function suspectsOf(text: string) {
        let found = memo.suspects.get(text);

        if (!found) {
            if (memo.suspects.size > MEMO) {
                memo.suspects.clear();
            }

            found = suspects(text);
            memo.suspects.set(text, found);
        }

        return found;
    }

    // The swatch under a client point: it sits just before its literal.
    function swatchAt(x: number, y: number) {
        let layout = host.layout(),
            offset = host.offsetAt(x, y);

        if (!layout || offset === null || !settings.colors) {
            return null;
        }

        let projection = host.projection(),
            native = projection.toNative(offset),
            index = layout.lineAt(native),
            from = layout.lineFrom(index),
            to = layout.end(index),
            list = literals(index, from, to, projection.value.slice(from, to)),
            width = host.charWidth();

        for (let i = 0, n = list.length; i < n; i++) {
            let item = list[i];

            if (Math.abs(from + item.from - native) > 2) {
                continue;
            }

            let source = projection.toSource(from + item.from),
                rect = host.rectAt(source);

            if (rect && y >= rect.top && y < rect.top + rect.height && x >= rect.left - width && x < rect.left) {
                return { from: source, rect, to: projection.toSource(from + item.to), value: item.value };
            }
        }

        return null;
    }

    // Brings the change bars up to edits since they were drawn: changes below an edit move with it and those it
    // touches stretch over it, until the debounced diff draws them exactly.
    function sync() {
        let doc = host.document();

        if (baseline === null || (seen.document === doc && seen.revision === doc.revision)) {
            return;
        }

        let deltas = seen.document === doc ? doc.deltas(seen.revision) : null;

        if (!deltas) {
            recompute();
            return;
        }

        for (let i = 0, n = deltas.length; i < n; i++) {
            let { inserted, line, removed } = deltas[i],
                end = line + removed,
                by = inserted - removed;

            changes = changes.map((change) => {
                if (change.from >= end && change.from > line) {
                    return { ...change, from: change.from + by, to: change.to + by };
                }

                if (change.to > line || change.from >= line) {
                    return { ...change, to: Math.max(change.from, change.to + by, line + inserted) };
                }

                return change;
            });
        }

        kinds = changeLines(changes, doc.lineCount);
        seen = { document: doc, revision: doc.revision };
    }

    function unicodeAt(x: number, y: number) {
        let offset = host.offsetAt(x, y);

        if (offset === null || !settings.unicode) {
            return null;
        }

        let doc = host.document(),
            line = doc.lineAt(offset),
            start = doc.lineStart(line),
            list = suspectsOf(doc.lineText(line)),
            half = host.charWidth() / 2;

        for (let i = 0, n = list.length; i < n; i++) {
            let item = list[i],
                at = start + item.from;

            if (at !== offset && at !== offset - 1) {
                continue;
            }

            let left = host.rectAt(at),
                right = host.rectAt(at + 1);

            if (left && right && y >= left.top && y < left.top + left.height && x >= left.left - half && x <= Math.max(right.left, left.left) + half) {
                return { at, item };
            }
        }

        return null;
    }

    function updateLink(next: Link | null) {
        if (next?.from === link?.from && next?.to === link?.to) {
            return;
        }

        link = next;
        host.schedule();
    }

    let api = {
        // The baseline the gutter diffs against; null clears it.
        baseline: (text: string | null) => {
            if (text === baseline) {
                return;
            }

            baseline = text;
            peek.open = false;
            recompute();
        },
        // The gutter's change kind for a source line (1-based), or ''.
        change: (line: number) => {
            if (baseline === null) {
                return '';
            }

            sync();

            return kinds.get(line - 1) ?? '';
        },
        // The text changed: change bars follow now, and the diff runs once edits settle. An open picker's choice is
        // dropped, since the literal it would replace may have moved.
        changed: () => {
            if (pick && pick.document === host.document()) {
                pick = null;
                tip.close();
            }

            if (baseline === null) {
                return;
            }

            sync();
            clearTimeout(timers.baseline);
            timers.baseline = setTimeout(recompute, BASELINE_DELAY);
        },
        configure: (options: {
            colors?: boolean;
            links?: boolean | ((url: string) => void);
            onMerge?: (conflict: Conflict) => void;
            rulers?: readonly number[];
            sticky?: boolean | number;
            unicode?: boolean;
        }) => {
            let columns = (options.rulers ?? []).filter((column) => Number.isFinite(column) && column > 0).slice(0, RULERS),
                cap = options.sticky === true ? STICKY : typeof options.sticky === 'number' ? Math.max(0, Math.min(STICKY_MAX, Math.trunc(options.sticky) || 0)) : 0;

            if (!!options.colors !== settings.colors) {
                memo.colors.clear();
            }

            settings.colors = !!options.colors;
            settings.links = options.links ?? false;
            settings.onMerge = options.onMerge;
            settings.unicode = options.unicode !== false;

            if (cap !== settings.sticky) {
                settings.sticky = cap;
                stuck = '';
            }

            if (!same(columns, settings.rulers)) {
                settings.rulers = columns;
                rulers();
            }

            if (!settings.links) {
                updateLink(null);
            }
        },
        conflicts: () => blocksOf().map(conflict),
        decorate: (index: number, from: number, to: number, text: string, out: Mark[]) => {
            if (settings.colors) {
                let list = literals(index, from, to, text);

                for (let i = 0, n = list.length; i < n; i++) {
                    out.push({ from: list[i].from, kind: 'code-editor-swatch', style: `--swatch: ${list[i].value};`, to: list[i].from + 1 });
                }
            }

            if (settings.unicode) {
                let list = suspectsOf(text);

                for (let i = 0, n = list.length; i < n; i++) {
                    out.push({ from: list[i].from, kind: `code-editor-unicode code-editor-unicode--${list[i].kind}`, to: list[i].to });
                }
            }

            if (link) {
                let projection = host.projection(),
                    start = projection.toNative(link.from) - from,
                    end = projection.toNative(link.to) - from;

                if (end > 0 && start < to - from) {
                    out.push({ from: Math.max(0, start), kind: 'code-editor-link', to: Math.min(to - from, end) });
                }
            }
        },
        dispose: () => {
            clearTimeout(timers.baseline);
            clearTimeout(timers.structure);
            timers = {};
            pick = null;
            tip.close();
            stop();
        },
        // Mod pressed or let go with the pointer still: links show or hide.
        key: (e: KeyboardEvent) => {
            if (!settings.links) {
                return;
            }

            if (!mod(e)) {
                updateLink(null);
                view.pointer = false;
            }
            else if (mouse) {
                updateLink(linkAt(mouse.x, mouse.y));
                view.pointer = !!link;
            }
        },
        leave: () => {
            mouse = null;
            updateLink(null);
            view.pointer = false;

            if (noticed >= 0) {
                noticed = -1;
                host.hide();
            }
        },
        // The character width changed: rulers move with it.
        measure: rulers,
        navigate,
        paint: (first: number, last: number, scrollTop: number, padTop: number) => {
            let layout = host.layout();

            if (!layout) {
                return;
            }

            paintSticky(layout, scrollTop, padTop);

            if (lenses.length || blocksOf().length) {
                paintLenses(layout, first, last);
            }

            paintPeek(layout);
        },
        // Opens the peek on the change at a gutter line (1-based).
        peek: (line: number) => {
            sync();

            let index = changes.findIndex((change) => change.kind === 'deleted'
                ? Math.min(change.from, host.document().lineCount - 1) === line - 1
                : change.from <= line - 1 && change.to > line - 1);

            if (index === -1) {
                return;
            }

            if (peek.open && peek.index === index) {
                peek.open = false;
                return;
            }

            open(index);
        },
        // A Mod+click on a link opens it, a click on a swatch opens the picker; true when the press was one of them.
        pointerdown: (e: PointerEvent) => {
            if (e.button !== 0 || host.busy()) {
                return false;
            }

            if (settings.links && mod(e) && !e.altKey && !e.shiftKey) {
                let target = linkAt(e.clientX, e.clientY);

                if (target) {
                    e.preventDefault();

                    if (typeof settings.links === 'function') {
                        settings.links(target.url);
                    }
                    else {
                        window.open(target.url, '_blank', 'noopener,noreferrer');
                    }

                    return true;
                }
            }

            if (!settings.colors || e.altKey || e.shiftKey || mod(e) || host.readonly()) {
                return false;
            }

            let swatch = swatchAt(e.clientX, e.clientY);

            if (!swatch || !anchor) {
                return false;
            }

            let value = toHex(swatch.value) ?? resolveColor(swatch.value);

            if (!value) {
                return false;
            }

            e.preventDefault();
            tip.close();

            let state = reactive({ error: '', value }),
                current = { document: host.document(), from: swatch.from, initial: value, literal: swatch.value, state, to: swatch.to };

            pick = current;
            tip.open(
                anchor,
                () => colorPicker({ class: 'code-editor-picker', recent: false, state, value }),
                () => {
                    let rect = host.rectAt(current.from) ?? swatch.rect,
                        width = host.charWidth();

                    return new DOMRect(rect.left - width, rect.top, width, rect.height);
                }
            );

            return true;
        },
        // Hovering: links show under Mod, swatches take a pointer cursor, and a suspect character explains itself. True
        // while that explanation holds the hover card.
        pointermove: (e: PointerEvent) => {
            mouse = { x: e.clientX, y: e.clientY };

            if (e.buttons || host.busy()) {
                return false;
            }

            updateLink(settings.links && mod(e) ? linkAt(e.clientX, e.clientY) : null);

            let pointer = !!link || (settings.colors && !host.readonly() && !!swatchAt(e.clientX, e.clientY));

            if (pointer !== view.pointer) {
                view.pointer = pointer;
            }

            let suspect = unicodeAt(e.clientX, e.clientY);

            if (suspect) {
                if (noticed !== suspect.at) {
                    noticed = suspect.at;
                    host.notice(suspect.at, describeSuspect(suspect.item));
                }

                return true;
            }

            if (noticed >= 0) {
                noticed = -1;
                host.hide();
            }

            return false;
        },
        // Settles a conflict as one edit, with the caret where the block was.
        resolve: (target: Conflict, resolution: Resolution) => {
            if (host.readonly() || host.busy()) {
                return false;
            }

            let list = blocksOf(),
                block = list.find((item) => item.start === target.start && item.end === target.end) ?? list.find((item) => item.line === target.line);

            if (!block) {
                return false;
            }

            let edit = resolveConflict(host.document().value, block, resolution);

            return host.edit(edit, edit.from);
        },
        // A new document: whatever was derived from the last one goes.
        reset: () => {
            tip.close();
            link = null;
            noticed = -1;
            peek.open = false;
            stuck = '';
            structure = { cache: null, folds: [], revision: -1 };
            clearTimeout(timers.structure);
            timers.structure = undefined;
            recompute();
        },
        rulers: () => view.rulers,
        state: view,
        // Pinned fold headers; clicking one scrolls its line to the top.
        sticky: () => html`
            <div aria-hidden='true' class='code-editor-sticky' ${{ class: () => view.sticky > 0 && '--active' }}>
                ${html.reactive(sticky, (row) => html`
                    <div
                        class='code-editor-sticky-row'
                        ${{
                            onclick: () => {
                                let layout = host.layout();

                                if (layout && row.index >= 0 && row.index < layout.count) {
                                    host.scrollTo(layout.top(row.index));
                                }

                                host.focus();
                            },
                            onmousedown: keep
                        }}
                    >
                        <span class='code-editor-sticky-number'>${() => row.number}</span>
                        <span class='code-editor-sticky-text'>
                            <span
                                class='code-editor-sticky-code'
                                ${{ innerHTML: () => row.html, style: () => `transform: translateX(${host.x()}px);` }}
                            ></span>
                        </span>
                    </div>
                `)}
            </div>
        `,
        // The tint class for a source line (1-based) inside a conflict block, or ''.
        tint: (line: number) => {
            if (!blocksOf().length) {
                return '';
            }

            let tint = blocks.tints.get(line);

            return tint ? `code-editor-line--${tint}` : '';
        },
        // Lenses over conflict blocks and the change peek, above the text; the color picker's tooltip.
        widgets: (y: () => number) => html`
            <div class='code-editor-widgets' ${{ style: () => `transform: translateY(${y()}px);` }}>
                <div class='code-editor-lenses' ${{ style: () => `transform: translateX(${host.x()}px);` }}>
                    ${html.reactive(lenses, (lens) => {
                        let index = lenses.indexOf(lens);

                        let run = (resolution: Resolution | null) => () => {
                            let block = blocksOf()[index];

                            if (!block) {
                                return;
                            }

                            if (resolution === null) {
                                settings.onMerge?.(conflict(block));
                            }
                            else {
                                api.resolve(conflict(block), resolution);
                            }

                            host.focus();
                        };

                        return html`
                            <div class='code-editor-lens' ${{ class: () => lens.readonly && 'code-editor-lens--readonly', style: () => lens.style }}>
                                <button class='code-editor-lens-action code-editor-lens-action--accept' type='button' ${{ onclick: run('current'), onmousedown: keep }}>Accept current</button>
                                <button class='code-editor-lens-action code-editor-lens-action--accept' type='button' ${{ onclick: run('incoming'), onmousedown: keep }}>Accept incoming</button>
                                <button class='code-editor-lens-action code-editor-lens-action--accept' type='button' ${{ onclick: run('both'), onmousedown: keep }}>Accept both</button>
                                <button class='code-editor-lens-action' type='button' ${{ onclick: run(null), onmousedown: keep }}>Compare</button>
                            </div>
                        `;
                    })}
                </div>
                <div
                    class='code-editor-peek'
                    role='group'
                    ${{
                        'aria-label': () => peek.label,
                        class: [() => peek.open && '--active', () => peek.kind && `code-editor-peek--${peek.kind}`],
                        style: () => `top: ${peek.top}px;`
                    }}
                >
                    <div class='code-editor-peek-bar'>
                        <span class='code-editor-peek-title'>${() => peek.label}</span>
                        <button aria-label='Previous change' class='code-editor-peek-button' type='button' ${{ onclick: () => navigate('change', true), onmousedown: keep }}>
                            ${icon({ 'aria-hidden': 'true', class: 'code-editor-peek-icon' }, arrowUp)}
                        </button>
                        <button aria-label='Next change' class='code-editor-peek-button' type='button' ${{ onclick: () => navigate('change', false), onmousedown: keep }}>
                            ${icon({ 'aria-hidden': 'true', class: 'code-editor-peek-icon' }, arrowDown)}
                        </button>
                        <button
                            aria-label='Revert change'
                            class='code-editor-peek-button'
                            type='button'
                            ${{
                                disabled: () => host.readonly(),
                                onclick: () => {
                                    let change = changes[peek.index],
                                        doc = host.document();

                                    if (!change || baseline === null) {
                                        return;
                                    }

                                    let edit = revertChange(baseline, doc.value, change, doc.eol);

                                    peek.open = false;

                                    if (host.edit(edit, edit.from)) {
                                        recompute();
                                    }

                                    host.focus();
                                },
                                onmousedown: keep
                            }}
                        >
                            ${icon({ 'aria-hidden': 'true', class: 'code-editor-peek-icon' }, undo)}
                        </button>
                        <button
                            aria-label='Close'
                            class='code-editor-peek-button'
                            type='button'
                            ${{
                                onclick: () => {
                                    peek.open = false;
                                    host.focus();
                                },
                                onmousedown: keep
                            }}
                        >
                            ${icon({ 'aria-hidden': 'true', class: 'code-editor-peek-icon' }, close)}
                        </button>
                    </div>
                    <pre class='code-editor-peek-lines'>${() => peek.lines}</pre>
                </div>
            </div>
            <span
                aria-hidden='true'
                class='code-editor-picker-anchor'
                ${{
                    onconnect: (element: HTMLElement) => {
                        anchor = element;
                    }
                }}
            ></span>
            ${tip.render({ class: 'code-editor-picker-tooltip' })}
        `
    };

    return api;
};


export { features };
export type { Host as FeaturesHost };
