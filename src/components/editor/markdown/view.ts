import { flush, reactive } from '@esportsplus/reactivity';
import { html, type Attributes } from '@esportsplus/template';
import { clamp } from '~/shared/clamp';
import { mac } from '~/shared/platform';
import { observer, observeSize, type Observer } from '~/shared/resize';
import { copied, read, write } from '../code/clipboard';
import { addNextOccurrence, deleteCharacter, indent, insertText, lineCommand, toggleComment } from '../code/commands';
import { composition } from '../code/composition';
import { find } from '../code/find';
import { mapFolds, outerFolds, type FoldRange } from '../code/folding';
import { goto } from '../code/goto';
import { commands, keymap } from '../code/keymap';
import { EditorLayout, type Rect } from '../code/layout';
import { minimap, type Source } from '../code/minimap';
import { move } from '../code/navigation';
import { pointer } from '../code/pointer';
import { NativeText } from '../code/projection';
import { syntaxCache, type Token } from '../code/syntax';
import { markdownCommand } from './editing';
import { reach, widen, type Span } from './erase';
import { parseInline, type Inline, type References } from './inline';
import { arrange, cache, MarkdownLayout, unitStart, type Unit } from './layout';
import {
    blockAt,
    contentEnd,
    markdownBackspace,
    markdownReferences,
    parseMarkdown,
    quotePrefix,
    reparse,
    toggleTask,
    type Kind,
    type MarkdownBlock
} from './model';
import { renderer } from './render';
import { foldable, foldAt, markdownFolds } from './structure';
import type { Change, EditorDocument, Selection, Snapshot } from '../code/document';
import type { Callbacks, Controller, Options } from '../code/view';
import tooltip from '~/components/tooltip';


type Decoration = { kind: string; style: string };

// Space standing in for the units left undrawn between drawn ones.
type Gap = { height: number };

type Item = Gap | Unit;

type MarkdownController = Omit<Controller, 'setDocument' | 'setOptions'> & {
    bold(): boolean;
    italic(): boolean;
    setDocument(document: EditorDocument, options?: MarkdownOptions): void;
    setOptions(options: MarkdownOptions, replace?: boolean): void;
};

type MarkdownOptions = Options & { spellcheck?: boolean };

type Memo = { folds: FoldRange[]; left: number; revision: number; top: number };

type Metrics = {
    charWidth: number;
    clientHeight: number;
    fontSize: number;
    lineHeight: number;
    minimap: number;
    padLeft: number;
    padTop: number;
    quoteIndent: number;
    scrollLeft: number;
    scrollTop: number;
    // The surface's content width, unrounded.
    width: number;
};

type Point = { node: Node; offset: number };


const DECORATIONS = 1000;

// A list item whose text so far is '[]' or '[ ]': a space turns it into a task.
const ITEM_TASK = /^[ \t]*(?:[-+*]|\d+[.)])[ \t]+\[ ?\]$/;

// Kinds whose text joins a neighbour's when the break between them is deleted.
const JOINABLE = new Set<Kind>(['heading', 'list', 'paragraph', 'quote']);

const LINE_BREAK = /[\r\n]/;

// Long enough that the hint only shows once the pointer rests on a link, not as it passes over text.
const LINK_DELAY = 700;

// Source the editor keeps literal, so typing there never turns into markup.
const LITERAL = new Set<Kind>(['code', 'fence', 'frontmatter', 'html']);

const NAVIGATION = /^(ArrowDown|ArrowLeft|ArrowRight|ArrowUp|End|Home|PageDown|PageUp)$/;

const NONE: readonly number[] = [];

const NO_TOKENS: readonly Token[] = [];

// A line whose text so far is '[]' or '[ ]': a space turns it into a task item.
const TASK = /^\[ ?\]$/;

const TOKEN_COLORS = ['comment', 'keyword', 'operator', 'property', 'string', 'type', 'variable'] as const;

const VERTICAL = /^(ArrowDown|ArrowUp|PageDown|PageUp)$/;


let uid = 0;


// Brings a reactive list to 'next' with the fewest splices, so items that stay keep their DOM. Both are ordered runs
// of the same items.
function assign(list: Item[], next: readonly Item[]) {
    if (list.length === next.length) {
        let same = true;

        for (let i = 0, n = list.length; same && i < n; i++) {
            same = list[i] === next[i];
        }

        if (same) {
            return;
        }
    }

    let keep = new Set(next),
        kept = 0;

    for (let i = 0, n = list.length; i < n; i++) {
        if (keep.has(list[i])) {
            kept++;
        }
    }

    if (!kept) {
        list.splice(0, list.length, ...next);
        return;
    }

    for (let i = list.length - 1; i >= 0;) {
        if (keep.has(list[i])) {
            i--;
            continue;
        }

        let end = i;

        while (i >= 0 && !keep.has(list[i])) {
            i--;
        }

        list.splice(i + 1, end - i);
    }

    for (let i = 0; i < next.length;) {
        if (list[i] === next[i]) {
            i++;
            continue;
        }

        let end = i;

        while (end < next.length && next[end] !== list[i]) {
            end++;
        }

        list.splice(i, 0, ...next.slice(i, end));
        i = end;
    }
}

function pixels(value: string) {
    return parseFloat(value) || 0;
}


// The markdown editor's view: blocks stay formatted while they edit. The rendered text itself is editable; every input
// is turned into an edit of the markdown source, and the blocks it touched draw again with the caret put back. Markup
// never shows: deletions skip over it, and a delimiter left with nothing to wrap goes with what it wrapped. Only units
// near the viewport are drawn, plus the ones holding the selection's ends. Returns its template and controller.
const view = (model: EditorDocument, callbacks: Callbacks, receive?: (controller: MarkdownController) => void) => {
    let apple = mac(),
        blocks = parseMarkdown(model),
        // The final text of the composition ending, and the selection it replaces.
        composed = '',
        composing: Selection | null = null,
        content: HTMLElement | undefined,
        decorations = reactive([] as Decoration[]),
        definitions: References = new Map(),
        disposed = false,
        // Content height the minimap last drew.
        drawn = 0,
        dropAt: number | null = null,
        elements = new Map<Unit, HTMLElement>(),
        escapeTab = false,
        folds: FoldRange[] = [],
        frame = 0,
        gaps: Gap[] = [],
        goals: number[] = [],
        help = `markdown-editor-help-${++uid}`,
        host: HTMLElement | undefined,
        inlines = new WeakMap<MarkdownBlock, { definitions: References; tokens: readonly Inline[] }>(),
        items = reactive([] as Item[]),
        keys = keymap(apple),
        layout = new MarkdownLayout(),
        length = model.value.length,
        metrics: Metrics = {
            charWidth: 7.8,
            clientHeight: 320,
            fontSize: 13,
            lineHeight: 20,
            minimap: 0,
            padLeft: 12,
            padTop: 12,
            quoteIndent: 10,
            scrollLeft: 0,
            scrollTop: 0,
            width: 600
        },
        options: MarkdownOptions = { wrap: true },
        palette: Record<string, string> = {},
        parsed = model.revision,
        pendingValue: string | undefined,
        // The native selection this view last set, which maps to the document's but needn't map back to it exactly.
        placed: { anchor: Point; focus: Point } | null = null,
        rendered: Unit[] = [],
        resize: Observer | undefined = observer(resized),
        revealing = false,
        ruler: HTMLElement | undefined,
        secondary = false,
        shown = new WeakMap<Element, Unit>(),
        state = reactive({
            ...model.state,
            selection: { ...model.selection },
            selections: model.selections.map((range) => ({ ...range }))
        }),
        surface: HTMLElement | undefined,
        ui = reactive({
            empty: !model.value,
            fold: false,
            label: 'Markdown editor',
            // The platform's modifier is held, so links show they open on a click.
            linking: false,
            minimap: false,
            placeholder: '',
            readonly: false,
            spellcheck: true,
            tabSize: 4,
            wrap: true
        }),
        units = cache(),
        unitsDirty = true,
        // The document's selection hasn't reached the native one yet, so the native one is stale.
        unplaced = false,
        unsubscribe: VoidFunction | undefined,
        // Where each document this editor showed was left.
        visited = new WeakMap<EditorDocument, Memo>(),
        whole: { layout: EditorLayout; projection: NativeText; revision: number } | null = null;

    let draw = renderer({
        fold: (unit) => {
            controller.fold(model.lineAt(unit.block.from) + 1);
        },
        foldable: opens,
        inline: inlineOf,
        readonly: () => ui.readonly,
        shown: (element, unit) => {
            if (unit) {
                elements.set(unit, element);
                shown.set(element, unit);
                resize?.observe(element);
                return;
            }

            let previous = shown.get(element);

            if (previous && elements.get(previous) === element) {
                elements.delete(previous);
            }

            shown.delete(element);
            resize?.unobserve(element);
        },
        task: (block) => {
            if (!disposed && !options.readonly && !ime.busy() && block.task) {
                toggleTask(model, block.task);
            }
        },
        text: () => model.value,
        unfold: (unit) => {
            controller.unfold(unit.fold?.line ?? model.lineAt(unit.block.from) + 1);
        }
    });

    // The input method writes into the drawn text itself; once it ends, its text replaces what it was typed over and
    // the block draws again, so none of the nodes it made stay behind.
    let ime = composition({
        begin: () => {
            capture();
            composed = '';
            composing = { ...model.selection };
            model.breakHistory();
        },
        commit: (conflict) => {
            let range = composing;

            composing = null;

            if (range && !conflict && composed && !options.readonly) {
                model.replace(range.start, range.end, composed, {
                    selection: { start: range.start + composed.length },
                    source: 'composition'
                });
            }

            composed = '';
            invalidate(range?.start ?? model.selection.start);

            if (pendingValue !== undefined) {
                let value = pendingValue;

                pendingValue = undefined;
                model.setValue(value, { source: 'external' });
            }
        }
    });

    let gestures = pointer({
        busy: ime.busy,
        capture,
        get document() {
            return model;
        },
        drop: (offset) => {
            dropAt = offset;
            schedule();
        },
        focus: () => controller.focus(),
        insert: (text) => controller.insert(text),
        offsetAt,
        placeholder: () => null,
        readonly: () => !!options.readonly,
        rows: rowsBetween,
        select: (ranges, reveal = false) => {
            model.selectMany(ranges);
            start(reveal);
        },
        transact: (edits, caret) => {
            model.transact(edits, { selection: { start: caret }, source: 'drop' });
            start(true);
        },
        unfold: () => {}
    });

    let jump = goto({
        focus: () => controller.focus(),
        go: (line, column) => controller.goToLine(line, column)
    });

    let map = minimap({
        focus: () => content?.focus({ preventScroll: true }),
        scroll: (top, relative) => {
            scrollTo(relative ? metrics.scrollTop + top : top);
        }
    });

    let search = find({
        get document() {
            return model;
        },
        edit: editable,
        focus: () => controller.focus(),
        readonly: () => !!options.readonly,
        reveal: (match) => {
            model.select({ end: match.to, start: match.from });
            start(true);
        },
        selection: () => {
            capture();
            return model.selection;
        },
        update: schedule
    });

    let size = observeSize(() => measure());

    // Links place the caret on a plain click, so resting on one says how to open it.
    let tip = tooltip.shared({ delay: { open: LINK_DELAY } });

    let source: Source = {
        breaks: () => NONE,
        get count() {
            return model.lineCount;
        },
        get height() {
            return layout.total;
        },
        indexAt: (y) => {
            let index = layout.at(y),
                unit = layout.units[index];

            if (!unit) {
                return 0;
            }

            let { first, last } = linesOf(index),
                top = layout.top(index),
                height = layout.height(unit);

            return first + Math.min(last - first, Math.floor(((y - top) / Math.max(1, height)) * (last - first + 1)));
        },
        get lineHeight() {
            return metrics.lineHeight;
        },
        rows: () => 1,
        get tabSize() {
            return options.tabSize ?? 4;
        },
        text: (index) => model.lineText(index),
        tokens: (index) => ui.minimap ? syntaxCache(model, 'markdown').lineTokens(index) : NO_TOKENS,
        top: (index) => {
            let at = layout.indexOf(model.lineStart(index)),
                unit = layout.units[at];

            if (!unit) {
                return 0;
            }

            let { first, last } = linesOf(at);

            return layout.top(at) + (Math.max(0, index - first) * layout.height(unit)) / (last - first + 1);
        }
    };

    // Takes over from the previous document: whatever was derived from it goes, and this one's view comes back as
    // this editor left it, folds only while its text is unchanged since.
    function adopt() {
        let memo = visited.get(model),
            { selections, ...single } = model.state;

        blocks = parseMarkdown(model);
        composed = '';
        composing = null;
        dropAt = null;
        escapeTab = false;
        folds = memo?.revision === model.revision ? memo.folds : [];
        goals = [];
        length = model.value.length;
        metrics.scrollLeft = memo?.left ?? 0;
        metrics.scrollTop = memo?.top ?? 0;
        parsed = model.revision;
        pendingValue = undefined;
        placed = null;
        secondary = selections.length > 1;
        ui.empty = !model.value;
        unitsDirty = true;
        whole = null;
        state.selections.splice(0, state.selections.length, ...selections.map((range) => ({ ...range })));
        Object.assign(state, single, { selection: { ...single.selection } });
        gestures.reset();
        jump.state.open = false;
        map.invalidate();
        references();

        if (unsubscribe) {
            subscribe();
        }

        search.result();
    }

    // Reads the native selection back into the document, unless it is the one this view placed or the document's is
    // still waiting to be placed.
    function capture() {
        if (disposed || !content || ime.busy() || unplaced) {
            return;
        }

        let selection = content.ownerDocument.getSelection(),
            anchorNode = selection?.anchorNode,
            focusNode = selection?.focusNode;

        if (!selection || !anchorNode || !focusNode || !content.contains(anchorNode) || !content.contains(focusNode)) {
            return;
        }

        if (
            placed &&
            placed.anchor.node === anchorNode &&
            placed.anchor.offset === selection.anchorOffset &&
            placed.focus.node === focusNode &&
            placed.focus.offset === selection.focusOffset
        ) {
            return;
        }

        let anchor = sourceAt(anchorNode, selection.anchorOffset),
            head = sourceAt(focusNode, selection.focusOffset);

        if (anchor === null || head === null) {
            return;
        }

        let primary = model.selection,
            next: Selection = {
                direction: head < anchor ? 'backward' : 'forward',
                end: Math.max(anchor, head),
                start: Math.min(anchor, head)
            };

        if (
            next.start === primary.start &&
            next.end === primary.end &&
            (next.start === next.end || next.direction === primary.direction || primary.direction === 'none')
        ) {
            return;
        }

        model.selectMany([next, ...model.selections.slice(1)]);
    }

    // Client rectangle of a source offset: the drawn text there, or else the unit's top.
    function clientRect(offset: number): Rect | null {
        if (!surface) {
            return null;
        }

        current();

        let index = layout.indexOf(offset),
            unit = layout.units[index];

        if (!unit) {
            return null;
        }

        let rects = textRects(unit, offset, offset);

        if (rects.length) {
            return rects[0];
        }

        let box = surface.getBoundingClientRect();

        return {
            height: metrics.lineHeight,
            left: box.left + surface.clientLeft - surface.scrollLeft + metrics.padLeft,
            top: box.top + surface.clientTop - surface.scrollTop + metrics.padTop + layout.top(index),
            width: 1
        };
    }

    function clip(e: ClipboardEvent, cut: boolean) {
        if (disposed || ime.busy() || !e.clipboardData) {
            return;
        }

        capture();

        let ranges = copied(model);

        write(e.clipboardData, model, ranges);
        e.preventDefault();

        if (cut && !options.readonly) {
            model.selectMany(ranges);
            controller.insert('');
        }
    }

    function connect() {
        if (disposed || !content || !host || !ruler || !surface || unsubscribe) {
            return;
        }

        measure();
        subscribe();
        unitsDirty = true;
        schedule();
        void host.ownerDocument.fonts?.ready.then(() => {
            if (!disposed) {
                measure();
            }
        });
        receive?.(controller);
    }

    // Where a unit's text starts, after any markers.
    function contentStart(unit: Unit) {
        return unit.block.from + (unit.rows ? unit.rows[0].contentFrom : unit.block.contentFrom - unit.block.from);
    }

    // Brings the unit list up to the document before anything reads positions from it.
    function current() {
        if (unitsDirty) {
            rebuild();
        }
    }

    function decorate() {
        let items: Decoration[] = [],
            ranges = model.selections,
            matches = search.state.open || search.state.query ? search.result() : null;

        if (ranges.length < 2 && dropAt === null && !matches?.matches.length) {
            if (decorations.length) {
                decorations.splice(0, decorations.length);
            }

            return;
        }

        let box = surface!.getBoundingClientRect(),
            originX = box.left + surface!.clientLeft - surface!.scrollLeft,
            originY = box.top + surface!.clientTop - surface!.scrollTop,
            units = layout.units,
            view = layout.window(metrics.scrollTop - metrics.padTop, metrics.clientHeight, 0),
            from = units[view.start] ? unitStart(units[view.start]) : 0,
            to = view.end < units.length ? unitStart(units[view.end]) : model.value.length;

        let mark = (start: number, end: number, kind: string) => {
            if (end < from || start > to || items.length >= DECORATIONS) {
                return;
            }

            let rects = rangeRects(Math.max(start, from), Math.min(end, to));

            for (let i = 0, n = rects.length; i < n && items.length < DECORATIONS; i++) {
                let rect = rects[i];

                items.push({
                    kind,
                    style: `height: ${rect.height}px; left: ${rect.left - originX}px; top: ${rect.top - originY}px;${start === end ? '' : ` width: ${Math.max(1, rect.width)}px;`}`
                });
            }
        };

        if (matches) {
            let { index, matches: list } = search.matches(from);

            for (let i = index, n = list.length; i < n && list[i].from <= to && items.length < DECORATIONS; i++) {
                mark(list[i].from, list[i].to, i === search.state.index ? 'markdown-editor-mark markdown-editor-mark--match --active' : 'markdown-editor-mark markdown-editor-mark--match');
            }
        }

        for (let i = 1, n = ranges.length; i < n; i++) {
            let range = ranges[i];

            if (range.start !== range.end) {
                mark(range.start, range.end, 'markdown-editor-mark markdown-editor-mark--selection');
            }

            let head = range.direction === 'backward' ? range.start : range.end;

            mark(head, head, 'markdown-editor-mark markdown-editor-mark--caret');
        }

        if (dropAt !== null) {
            mark(dropAt, dropAt, 'markdown-editor-mark markdown-editor-mark--caret');
        }

        while (decorations.length < items.length) {
            decorations.push(reactive({ kind: '', style: '' }));
        }

        if (decorations.length > items.length) {
            decorations.splice(items.length, decorations.length - items.length);
        }

        for (let i = 0, n = items.length; i < n; i++) {
            decorations[i].kind = items[i].kind;
            decorations[i].style = items[i].style;
        }
    }

    // The native point standing for a source offset: in the drawn text holding it, or after the text before it when it
    // falls on markup. Offsets in units that aren't drawn go to the nearest drawn edge. Null while the unit's element
    // has yet to connect.
    function domAt(offset: number): Point | null {
        current();

        let unit = layout.units[layout.indexOf(offset)];

        if (!unit || !draw.segments(unit)) {
            let first = rendered[0],
                last = rendered[rendered.length - 1];

            if (!first || !last) {
                return null;
            }

            if (offset < unitStart(first)) {
                unit = first;
                offset = contentStart(first);
            }
            else {
                unit = last;
                offset = contentEnd(model.value, last.block);
            }
        }

        let element = elements.get(unit),
            segments = draw.segments(unit) ?? [],
            after: Point | null = null,
            before: Point | null = null;

        for (let i = 0, n = segments.length; i < n; i++) {
            let segment = segments[i],
                at = segment.block.from + segment.from,
                end = at + segment.node.length;

            if (at <= offset && offset <= end) {
                return { node: segment.node, offset: offset - at };
            }

            if (end < offset) {
                before = { node: segment.node, offset: segment.node.length };
            }
            else {
                after = { node: segment.node, offset: 0 };
                break;
            }
        }

        if (before || after) {
            return before ?? after;
        }

        if (!element) {
            return null;
        }

        // No text: on the line break that gives the caret its line.
        let children = element.childNodes;

        for (let i = 0, n = children.length; i < n; i++) {
            if (children[i].nodeName === 'BR') {
                return { node: element, offset: i };
            }
        }

        return { node: element, offset: children.length };
    }

    // Source offset at the drawn units' edge nearest a point outside them: on the content root or a spacer.
    function edgeAt(node: Node, offset: number) {
        if (!content) {
            return null;
        }

        let child: Node | null = node === content ? content.childNodes[offset] ?? null : node;

        while (child && child.parentNode !== content) {
            child = child.parentNode;
        }

        for (let at = child; at; at = at.nextSibling) {
            let unit = shown.get(at as Element);

            if (unit) {
                return contentStart(unit);
            }
        }

        for (let at = child ? child.previousSibling : content.lastChild; at; at = at.previousSibling) {
            let unit = shown.get(at as Element);

            if (unit) {
                return contentEnd(model.value, unit.block);
            }
        }

        return null;
    }

    function editable(run: () => boolean) {
        if (disposed || options.readonly || ime.busy()) {
            return false;
        }

        capture();
        revealFolds(true);
        revealing = true;

        let changed = run();

        schedule();

        return changed;
    }

    // Backspace or Delete at a single selection: a selection goes, a caret takes the visible character beside it,
    // and at a block's edge the blocks join, or the empty line or rule beside it goes.
    function erase(backward: boolean) {
        if (model.selections.length > 1) {
            return backward ? markdownCommand(model, 'backspace', kindAt) : deleteCharacter(model, false);
        }

        current();

        let { end, start } = model.selection;

        if (start !== end) {
            return remove({ from: start, to: end });
        }

        let index = blockAt(blocks, start),
            block = blocks[index],
            unit = layout.units[layout.indexOf(start)],
            span = unit && draw.segments(unit) ? reach(model.value, spans(unit), start, backward) : null;

        if (span) {
            // The info string and the code under it never merge, nor does code run into a fence.
            if ((block.kind === 'fence' || block.kind === 'frontmatter') && span.from < block.contentFrom && span.to >= block.contentFrom) {
                return false;
            }

            return remove(span);
        }

        return backward ? joinBackward(index, start) : joinForward(index, start);
    }

    function inlineOf(block: MarkdownBlock) {
        let entry = inlines.get(block);

        if (!entry || entry.definitions !== definitions) {
            let base = block.from,
                text = model.value.slice(block.contentFrom, block.contentTo);

            entry = {
                definitions,
                tokens: parseInline(text, block.contentFrom - base, 0, block.definitions ? new Map() : definitions)
            };
            inlines.set(block, entry);
        }

        return entry.tokens;
    }

    // Drops a block's drawing, for when something other than this view wrote into it.
    function invalidate(offset: number) {
        let block = blocks[blockAt(blocks, offset)];

        if (block) {
            units.folded.delete(block);
            units.plain.delete(block);
            units.raw.delete(block);
        }

        unitsDirty = true;
        schedule();
    }

    // Backspace at the start of a block's text: a list or quote marker goes first, then a heading's, then the break to
    // the block before.
    function joinBackward(index: number, offset: number) {
        if (markdownBackspace(model)) {
            return true;
        }

        let block = blocks[index],
            previous = blocks[index - 1];

        if (block.kind === 'heading' && block.contentFrom > block.from && offset <= block.contentFrom) {
            let from = block.from + quotePrefix(model.lineText(model.lineAt(block.from))).length;

            return model.replace(from, block.contentFrom, '', { selection: { start: from }, source: 'markdown-unwrap' });
        }

        if (!previous) {
            return false;
        }

        if (previous.kind === 'blank' || previous.kind === 'rule') {
            return model.replace(previous.from, previous.to, '', {
                selection: { start: offset - (previous.to - previous.from) },
                source: 'delete'
            });
        }

        if (JOINABLE.has(previous.kind) && (JOINABLE.has(block.kind) || block.kind === 'blank')) {
            return model.replace(previous.contentTo, offset, '', { selection: { start: previous.contentTo }, source: 'delete' });
        }

        model.select({ start: previous.contentTo });

        return false;
    }

    // Delete at the end of a block's text: the empty line or rule after it goes, or the next block's text joins it.
    function joinForward(index: number, offset: number) {
        let block = blocks[index],
            next = blocks[index + 1];

        if (!next) {
            return false;
        }

        if (next.kind === 'blank' || next.kind === 'rule') {
            return model.replace(next.from, next.to, '', { selection: { start: offset }, source: 'delete' });
        }

        if (JOINABLE.has(next.kind) && (JOINABLE.has(block.kind) || block.kind === 'blank')) {
            return model.replace(offset, next.contentFrom, '', { selection: { start: offset }, source: 'delete' });
        }

        return false;
    }

    // The block kind at a source offset, for commands that leave literal source alone.
    function kindAt(offset: number): Kind | undefined {
        return blocks[blockAt(blocks, offset)]?.kind;
    }

    // Source lines [first, last] unit 'index' covers.
    function linesOf(index: number) {
        let units = layout.units,
            from = unitStart(units[index]),
            to = index + 1 < units.length ? unitStart(units[index + 1]) - 1 : model.value.length;

        return { first: model.lineAt(from), last: model.lineAt(Math.max(from, to)) };
    }

    function linking(e: KeyboardEvent | PointerEvent) {
        let next = apple ? e.metaKey : e.ctrlKey;

        if (ui.linking !== next) {
            ui.linking = next;
        }
    }

    // Marks which drawn units show a fold marker; only neighbouring blocks are looked at.
    function markFoldable() {
        for (let i = 0, n = rendered.length; i < n; i++) {
            let unit = rendered[i],
                state = draw.state(unit);

            if (!state) {
                continue;
            }

            let next = opens(unit);

            if (state.foldable !== next) {
                state.foldable = next;
            }
        }
    }

    // Reads computed geometry and colors on connect, resize, font load or refresh; never per frame.
    function measure() {
        if (disposed || !host || !ruler || !surface) {
            return;
        }

        let computed = getComputedStyle(surface),
            style = getComputedStyle(host),
            fallback = style.getPropertyValue('--color').trim() || 'currentColor',
            colors: Record<string, string> = {},
            padLeft = pixels(computed.paddingLeft),
            fontSize = pixels(computed.fontSize) || 13;

        metrics = {
            charWidth: ruler.getBoundingClientRect().width / (ruler.textContent?.length || 1) || 7.8,
            clientHeight: surface.clientHeight,
            fontSize,
            lineHeight: pixels(computed.lineHeight) || fontSize * 1.5,
            minimap: pixels(style.getPropertyValue('--minimap-width')),
            padLeft,
            padTop: pixels(computed.paddingTop),
            quoteIndent: pixels(style.getPropertyValue('--quote-indent')),
            scrollLeft: surface.scrollLeft,
            scrollTop: surface.scrollTop,
            width: surface.getBoundingClientRect().width - (surface.offsetWidth - surface.clientWidth) - padLeft - pixels(computed.paddingRight)
        };

        for (let i = 0, n = TOKEN_COLORS.length; i < n; i++) {
            colors[TOKEN_COLORS[i]] = style.getPropertyValue(`--${TOKEN_COLORS[i]}-color`).trim() || fallback;
        }

        palette = colors;

        if (layout.configure({
            charWidth: metrics.charWidth,
            fontSize: metrics.fontSize,
            lineHeight: metrics.lineHeight,
            quoteIndent: metrics.quoteIndent,
            width: metrics.width
        })) {
            whole = null;
            map.invalidate();
            unitsDirty = true;
        }

        schedule();
    }

    // A single caret moves through the drawn text the way the browser lays it out; several move by source.
    function moveSelection(key: string, extend: boolean, word = false, add = false, boundary = false) {
        let native = content?.ownerDocument.getSelection();

        if (
            native &&
            model.selections.length === 1 &&
            !add &&
            !key.startsWith('Page') &&
            content?.ownerDocument.activeElement === content
        ) {
            let vertical = VERTICAL.test(key);

            native.modify(
                extend ? 'extend' : 'move',
                key === 'ArrowLeft' || key === 'ArrowUp' || key === 'Home' ? 'backward' : 'forward',
                vertical ? 'line' : key === 'Home' || key === 'End' ? (boundary ? 'documentboundary' : 'lineboundary') : word ? 'word' : 'character'
            );
            capture();
            start(true);
            return;
        }

        if (!VERTICAL.test(key) || boundary || add) {
            goals = [];
        }

        if (!whole || whole.revision !== model.revision) {
            let text = new NativeText(model.value);

            whole = {
                layout: new EditorLayout(text, model.value, Number.MAX_SAFE_INTEGER, metrics.lineHeight, metrics.charWidth, options.tabSize ?? 4, false),
                projection: text,
                revision: model.revision
            };
        }

        let lineHeight = metrics.lineHeight,
            ranges = move(model, whole.layout, whole.projection, lineHeight, {
                boundary,
                extend,
                goals,
                key,
                page: Math.max(lineHeight, metrics.clientHeight - lineHeight),
                word
            });

        model.selectMany(add ? [...model.selections, ...ranges] : ranges, 'navigation');
        start(true);
    }

    function offsetAt(clientX: number, clientY: number) {
        if (disposed || !surface || !host) {
            return null;
        }

        current();

        let box = surface.getBoundingClientRect();

        if (box.width && (clientX < box.left || clientX > box.right || clientY < box.top || clientY > box.bottom)) {
            return null;
        }

        let doc = host.ownerDocument as Document & {
                caretPositionFromPoint?: (x: number, y: number) => { offset: number; offsetNode: Node } | null;
            },
            point = doc.caretPositionFromPoint?.(clientX, clientY),
            range = point ? null : doc.caretRangeFromPoint?.(clientX, clientY),
            node = point?.offsetNode ?? range?.startContainer ?? null;

        if (node && content?.contains(node)) {
            let offset = sourceAt(node, point?.offset ?? range?.startOffset ?? 0);

            if (offset !== null) {
                return offset;
            }
        }

        let under = doc.elementFromPoint(clientX, clientY)?.closest('.markdown-editor-block'),
            unit = under && shown.get(under);

        if (unit) {
            return contentStart(unit);
        }

        let index = layout.at(clientY - box.top - surface.clientTop + surface.scrollTop - metrics.padTop);

        return layout.units[index] ? contentStart(layout.units[index]) : null;
    }

    // Whether a drawn unit shows a fold marker; only neighbouring blocks are looked at.
    function opens(unit: Unit) {
        return !!options.fold && !unit.continuation && !unit.raw && !unit.fold && foldable(blocks, blockAt(blocks, unit.block.from), model.value);
    }

    function paint() {
        frame = 0;

        if (disposed || !surface) {
            return;
        }

        current();

        if (revealing) {
            revealing = false;
            reveal();
        }

        // An input method owns the drawn text until it commits.
        if (!ime.busy()) {
            present();
        }

        markFoldable();
        // Rectangles come from the drawn text; units this frame added draw in the list's own pass, queued before.
        queueMicrotask(() => {
            if (!disposed) {
                decorate();
            }
        });

        if (options.minimap) {
            // Heights moved every line below them.
            if (layout.total !== drawn) {
                drawn = layout.total;
                map.invalidate();
            }

            map.paint(
                source,
                { clientHeight: metrics.clientHeight, scrollHeight: layout.total + 2 * metrics.padTop, scrollTop: metrics.scrollTop },
                palette,
                metrics.minimap
            );
        }
    }

    // Puts the native selection where the document's is, unless it already maps there: moving it anyway would lose
    // the column the browser keeps for vertical moves.
    function place() {
        unplaced = false;

        if (disposed || !content || ime.busy() || content.ownerDocument.activeElement !== content) {
            return;
        }

        let native = content.ownerDocument.getSelection();

        if (!native) {
            return;
        }

        let selection = model.selection,
            backward = selection.direction === 'backward',
            anchorAt = backward ? selection.end : selection.start,
            headAt = backward ? selection.start : selection.end;

        if (
            native.anchorNode &&
            native.focusNode &&
            content.contains(native.anchorNode) &&
            content.contains(native.focusNode) &&
            sourceAt(native.anchorNode, native.anchorOffset) === anchorAt &&
            sourceAt(native.focusNode, native.focusOffset) === headAt
        ) {
            return;
        }

        let anchor = domAt(anchorAt),
            focus = anchorAt === headAt ? anchor : domAt(headAt);

        // A unit drawn this frame connects after it; the selection goes there next frame.
        if (!anchor || !focus) {
            unplaced = true;
            schedule();
            return;
        }

        native.setBaseAndExtent(anchor.node, anchor.offset, focus.node, focus.offset);
        placed = { anchor, focus };
        unplaced = false;
    }

    // Draws the units near the viewport and the ones holding the selection's ends, with spacers for the rest, then
    // puts the native selection back.
    function present() {
        let n = layout.units.length,
            view = layout.window(metrics.scrollTop - metrics.padTop, metrics.clientHeight),
            selection = model.selection,
            runs: Span[] = [];

        if (n) {
            let anchor = layout.indexOf(selection.direction === 'backward' ? selection.end : selection.start),
                head = layout.indexOf(selection.direction === 'backward' ? selection.start : selection.end);

            runs.push({ from: anchor, to: anchor + 1 }, { from: head, to: head + 1 }, { from: view.start, to: view.end });
            runs.sort((a, b) => a.from - b.from);
        }

        let cursor = 0,
            gap = 0,
            next: Item[] = [];

        let space = (height: number) => {
            let item = gaps[gap++] ??= reactive({ height: 0 });

            item.height = height;
            next.push(item);
        };

        for (let i = 0, m = runs.length; i < m; i++) {
            let { from, to } = runs[i];

            from = Math.max(from, cursor);

            if (to <= from) {
                continue;
            }

            if (from > cursor || !next.length) {
                space(layout.top(from) - layout.top(cursor));
            }

            for (let j = from; j < to; j++) {
                next.push(layout.units[j]);
            }

            cursor = to;
        }

        space(layout.total - layout.top(cursor));
        assign(items, next);
        rendered = next.filter((item): item is Unit => 'block' in item);
        flush();
        place();
    }

    function rangeRects(from: number, to: number) {
        let out: Rect[] = [],
            units = layout.units,
            first = layout.indexOf(from),
            last = layout.indexOf(to);

        for (let i = first; i <= last && out.length < DECORATIONS; i++) {
            let rects = textRects(units[i], from, to);

            for (let j = 0, n = rects.length; j < n; j++) {
                out.push(rects[j]);
            }
        }

        return out;
    }

    function rebuild() {
        let raw: Set<number> | null = null,
            ranges = model.selections;

        if (ranges.length > 1) {
            raw = new Set();

            for (let i = 1, n = ranges.length; i < n; i++) {
                for (let b = blockAt(blocks, ranges[i].start), e = blockAt(blocks, ranges[i].end); b <= e; b++) {
                    raw.add(b);
                }
            }
        }

        layout.set(arrange(blocks, model.value, options.fold ? folds : [], units, raw ? (index) => raw.has(index) : null), model.value);
        unitsDirty = false;
    }

    // Link reference definitions, from the blocks holding them; links everywhere draw again when they change.
    function references() {
        let next = new Map<string, string>();

        for (let i = 0, n = blocks.length; i < n; i++) {
            let block = blocks[i];

            if (!block.definitions) {
                continue;
            }

            for (let [label, href] of markdownReferences(model.value.slice(block.contentFrom, block.contentTo))) {
                if (!next.has(label)) {
                    next.set(label, href);
                }
            }
        }

        definitions = next;
        units = cache();
        unitsDirty = true;
    }

    // Removes source, widened to take any delimiters it leaves empty.
    function remove(span: Span) {
        let block = blocks[blockAt(blocks, span.from)];

        if (block && JOINABLE.has(block.kind) && span.to <= block.to) {
            span = widen(model.value, inlineOf(block), block.from, span);
        }

        return model.replace(span.from, span.to, '', { group: 'delete', selection: { start: span.from }, source: 'delete' });
    }

    // Brings the blocks up to the document: only from the edited block until block boundaries line up again.
    function reparseBlocks() {
        let deltas = model.deltas(parsed),
            previous = length;

        length = model.value.length;
        parsed = model.revision;

        if (!deltas) {
            blocks = parseMarkdown(model);
            map.invalidate();
            references();
            return;
        }

        if (!deltas.length) {
            return;
        }

        let end = -1,
            moved = 0,
            start = Number.MAX_SAFE_INTEGER;

        for (let i = 0, n = deltas.length; i < n; i++) {
            let { inserted, line, removed } = deltas[i];

            moved += inserted - removed;

            if (end < 0) {
                end = line + inserted;
                start = line;
                continue;
            }

            if (end >= line + removed) {
                end += inserted - removed;
            }
            else if (end > line) {
                end = line + inserted;
            }

            end = Math.max(end, line + inserted);
            start = Math.min(start, line);
        }

        let count = model.lineCount,
            from = model.lineStart(Math.min(start, count - 1)),
            to = end < count ? model.lineStart(end) : length,
            splice = reparse(blocks, model, from, to, length - previous),
            changed = false;

        for (let i = 0, n = splice.dropped.length; !changed && i < n; i++) {
            changed = !!splice.dropped[i].definitions;
        }

        for (let i = splice.start, n = splice.start + splice.inserted; !changed && i < n; i++) {
            changed = !!blocks[i].definitions;
        }

        if (changed) {
            map.invalidate();
            references();
            return;
        }

        // Edits that kept the line count only redraw their lines in the minimap.
        if (moved) {
            map.invalidate();
        }
        else {
            map.invalidate(start, end);
        }
    }

    // Heights the DOM drew for units. Units above the viewport that changed move the view by as much, so it stays on
    // its text.
    function resized(entries: ResizeObserverEntry[]) {
        if (disposed) {
            return;
        }

        current();

        let anchor = layout.at(metrics.scrollTop - metrics.padTop),
            changed = false,
            shift = 0;

        for (let i = 0, n = entries.length; i < n; i++) {
            let entry = entries[i],
                unit = shown.get(entry.target);

            if (!unit) {
                continue;
            }

            let height = entry.borderBoxSize?.[0]?.blockSize ?? (entry.target as HTMLElement).offsetHeight,
                previous = layout.height(unit);

            if (layout.measure(unit, height)) {
                changed = true;

                if (layout.indexOf(unitStart(unit)) < anchor) {
                    shift += height - previous;
                }
            }
        }

        if (shift) {
            scrollTo(metrics.scrollTop + shift);
        }

        if (changed) {
            schedule();
        }
    }

    // Scrolls the primary selection's head into view.
    function reveal() {
        let selection = model.selection,
            head = selection.direction === 'backward' ? selection.start : selection.end,
            index = layout.indexOf(head),
            unit = layout.units[index];

        if (!unit || !surface) {
            return;
        }

        let height = Math.min(layout.height(unit), metrics.clientHeight),
            y = metrics.padTop + layout.top(index),
            rect = draw.segments(unit) ? textRects(unit, head, head)[0] : undefined;

        if (rect) {
            let box = surface.getBoundingClientRect();

            height = rect.height;
            y = rect.top - box.top - surface.clientTop + surface.scrollTop;

            if (options.wrap === false) {
                let x = rect.left - box.left - surface.clientLeft + surface.scrollLeft;

                if (x < metrics.scrollLeft + metrics.padLeft) {
                    surface.scrollLeft = metrics.scrollLeft = Math.max(0, x - metrics.padLeft);
                }
                else if (x + metrics.padLeft > metrics.scrollLeft + metrics.width) {
                    surface.scrollLeft = metrics.scrollLeft = x + metrics.padLeft - metrics.width;
                }
            }
        }

        if (y < metrics.scrollTop) {
            scrollTo(y - metrics.padTop);
        }
        else if (y + height > metrics.scrollTop + metrics.clientHeight) {
            scrollTo(y + height + metrics.padTop - metrics.clientHeight);
        }
    }

    // Unfolds whatever hides a selection edge, or with 'edit', whatever an edit of the selection would touch.
    function revealFolds(edit = false) {
        if (!folds.length) {
            return;
        }

        let ranges = model.selections,
            next = folds.filter((fold) => !ranges.some((range) =>
                (range.start >= fold.from && range.start < fold.to) ||
                (range.end > fold.from && range.end <= fold.to) ||
                (edit && range.start < fold.to && range.end > fold.from)
            ));

        if (next.length !== folds.length) {
            folds = next;
            unitsDirty = true;
        }
    }

    // Client y of the middle of each source line from one client y to another, for rectangular selections.
    function rowsBetween(from: number, to: number) {
        let out: number[] = [];

        if (!surface) {
            return out;
        }

        let left = surface.getBoundingClientRect().left + metrics.padLeft,
            a = offsetAt(left, from),
            b = offsetAt(left, to);

        if (a === null || b === null) {
            return out;
        }

        for (let line = model.lineAt(Math.min(a, b)), last = model.lineAt(Math.max(a, b)); line <= last && out.length < 1000; line++) {
            let rect = clientRect(model.lineStart(line));

            if (rect) {
                out.push(rect.top + rect.height / 2);
            }
        }

        return out;
    }

    function schedule() {
        if (!disposed && !frame && surface) {
            frame = requestAnimationFrame(paint);
        }
    }

    function scrollTo(top: number) {
        if (!surface) {
            return;
        }

        surface.scrollTop = Math.max(0, top);
        metrics.scrollTop = surface.scrollTop;
        schedule();
    }

    // A space after '[]' at the start of a line or a list item's text makes it a task, as '- ' makes a list item.
    function shortcut(text: string) {
        let { end, start } = model.selection;

        if (text !== ' ' || start !== end || model.selections.length > 1 || LITERAL.has(kindAt(start)!)) {
            return false;
        }

        let from = model.lineStart(model.lineAt(start)),
            before = model.value.slice(from, start),
            at = from + quotePrefix(before).length,
            rest = model.value.slice(at, start);

        if (TASK.test(rest)) {
            return model.replace(at, start, '- [ ] ', { selection: { start: at + 6 }, source: 'markdown-task' });
        }

        if (ITEM_TASK.test(rest)) {
            let bracket = at + rest.lastIndexOf('[');

            return model.replace(bracket, start, '[ ] ', { selection: { start: bracket + 4 }, source: 'markdown-task' });
        }

        return false;
    }

    // Source offset of a native point: in a run of drawn text directly, otherwise from the runs of its unit around it.
    function sourceAt(node: Node, offset: number): number | null {
        let direct = draw.offset(node, offset);

        if (direct !== null) {
            return direct;
        }

        let element = (node.nodeType === 1 ? node as Element : node.parentElement)?.closest('.markdown-editor-block'),
            unit = element ? shown.get(element) : undefined;

        if (!unit) {
            return edgeAt(node, offset);
        }

        let range = node.ownerDocument!.createRange(),
            segments = draw.segments(unit) ?? [],
            after: number | null = null,
            before: number | null = null;

        range.setStart(node, offset);

        for (let i = 0, n = segments.length; i < n; i++) {
            let segment = segments[i];

            if (range.comparePoint(segment.node, segment.node.length) <= 0) {
                before = segment.block.from + segment.from + segment.node.length;
            }
            else if (range.comparePoint(segment.node, 0) >= 0) {
                after = segment.block.from + segment.from;
                break;
            }
        }

        // Just past a line break the caret is on the next row.
        let broken = node.nodeType === 3 && offset > 0 && LINE_BREAK.test(node.textContent![offset - 1]);

        if (after !== null && (broken || before === null)) {
            return after;
        }

        return before ?? contentStart(unit);
    }

    // Absolute source runs of a drawn unit's text, in order.
    function spans(unit: Unit) {
        let out: Span[] = [],
            segments = draw.segments(unit) ?? [];

        for (let i = 0, n = segments.length; i < n; i++) {
            let from = segments[i].block.from + segments[i].from;

            out.push({ from, to: from + segments[i].node.length });
        }

        return out;
    }

    // Shows the selection once a gesture or command set it, revealing it when asked.
    function start(reveal: boolean) {
        revealing ||= reveal;
        schedule();
    }

    function subscribe() {
        unsubscribe?.();
        unsubscribe = model.subscribe((snapshot, change) => {
            if (change.source !== 'navigation') {
                goals = [];
            }

            let { selections, ...single } = snapshot;

            state.selections.splice(0, state.selections.length, ...selections.map((range) => ({ ...range })));
            Object.assign(state, single, { selection: { ...snapshot.selection } });

            if (change.textChanged) {
                ime.conflict();
                textChanged(change);
                ui.empty = !snapshot.value;
            }

            if (change.selectionChanged) {
                revealFolds();
                // Blocks holding secondary carets draw as source.
                unitsDirty ||= secondary || selections.length > 1;
                secondary = selections.length > 1;
            }

            // Drawn at once, so the text under the caret is current before the next input reads the selection.
            if (frame) {
                cancelAnimationFrame(frame);
            }

            paint();

            if (change.selectionChanged) {
                callbacks.onSelection?.(snapshot.selection, model.position());
            }

            if (change.textChanged) {
                callbacks.onChange?.(snapshot.value, change, snapshot);
            }
        });
    }

    function textChanged(change: Change) {
        reparseBlocks();

        if (folds.length) {
            folds = outerFolds(mapFolds(folds, change.editBatches ?? [], model));
        }

        whole = null;
        unitsDirty = true;
    }

    // Client rectangles of [from, to) in a drawn unit's text; a collapsed range gives its caret.
    function textRects(unit: Unit, from: number, to: number) {
        let out: Rect[] = [],
            segments = draw.segments(unit);

        if (!segments || !host) {
            return out;
        }

        let range = host.ownerDocument.createRange();

        for (let i = 0, n = segments.length; i < n; i++) {
            let segment = segments[i],
                at = segment.block.from + segment.from,
                end = at + segment.node.length;

            if (end < from || at > to || (from !== to && (end === from || at === to))) {
                continue;
            }

            range.setStart(segment.node, clamp(from - at, 0, segment.node.length));
            range.setEnd(segment.node, clamp(to - at, 0, segment.node.length));

            let rects = range.getClientRects();

            for (let j = 0, m = rects.length; j < m; j++) {
                out.push({ height: rects[j].height, left: rects[j].left, top: rects[j].top, width: rects[j].width });
            }

            if (from === to && out.length) {
                break;
            }
        }

        return out;
    }

    // Typed text, unless it completes a shortcut.
    function typed(text: string) {
        return editable(() => shortcut(text) || insertText(model, text, 'input'));
    }

    let controller: MarkdownController = {
        addNextOccurrence: (all = false) => {
            if (disposed || ime.busy()) {
                return false;
            }

            capture();

            let changed = addNextOccurrence(model, all);

            start(true);

            return changed;
        },
        bold: () => editable(() => markdownCommand(model, 'bold', kindAt)),
        closeFind: () => search.close(),
        dispose: () => {
            if (disposed) {
                return;
            }

            try {
                ime.flush();
            }
            finally {
                disposed = true;

                if (frame) {
                    cancelAnimationFrame(frame);
                    frame = 0;
                }

                unsubscribe?.();
                unsubscribe = undefined;
                resize?.disconnect();
                resize = undefined;
                size.ondisconnect();
                pendingValue = undefined;
            }
        },
        get document() {
            return model;
        },
        find: (query, next) => search.find(query, next),
        findNext: () => search.next(),
        findPrevious: () => search.previous(),
        focus: () => {
            if (disposed || !content) {
                return;
            }

            content.focus({ preventScroll: true });
            place();
            schedule();
        },
        fold: (line) => {
            if (disposed || ime.busy() || !options.fold) {
                return false;
            }

            let target = line === undefined ? model.position().line : line,
                index = blockAt(blocks, model.lineStart(target - 1)),
                range = line === undefined || blocks[index].from === model.lineStart(target - 1) ? foldAt(model, blocks, index) : null;

            if (!range || folds.some((fold) => fold.from === range.from && fold.to === range.to)) {
                return false;
            }

            folds = outerFolds([...folds, range]);

            if (model.selections.some((selection) => (selection.start >= range.from && selection.start < range.to) || (selection.end > range.from && selection.end <= range.to))) {
                model.select({ start: range.open ?? range.from });
            }

            unitsDirty = true;
            schedule();

            return true;
        },
        foldAll: () => {
            if (disposed || ime.busy() || !options.fold) {
                return;
            }

            model.select({ start: 0 });
            folds = outerFolds(markdownFolds(model, blocks));
            unitsDirty = true;
            schedule();
        },
        goToLine: (line, column = 1) => {
            if (disposed || ime.busy()) {
                return;
            }

            model.select({ start: model.offset(line, column) });
            revealing = true;
            controller.focus();
        },
        get host() {
            return host!;
        },
        indent: () => editable(() => indent(model, options.indent)),
        insert: (text) => editable(() => insertText(model, text)),
        italic: () => editable(() => markdownCommand(model, 'italic', kindAt)),
        lineCommand: (command) => editable(() => lineCommand(model, command)),
        newline: () => editable(() => markdownCommand(model, 'enter', kindAt)),
        offsetAt,
        openFind: (replace = false) => {
            if (disposed || ime.busy()) {
                return;
            }

            jump.state.open = false;
            search.open(replace);
            schedule();
        },
        openGoToLine: () => {
            if (disposed || ime.busy()) {
                return;
            }

            capture();
            search.state.open = false;
            jump.open(model.position().line);
        },
        outdent: () => editable(() => indent(model, options.indent, true)),
        rectAt: (offset) => {
            if (disposed || offset < 0 || offset > model.value.length || folds.some((fold) => offset >= fold.from && offset < fold.to)) {
                return null;
            }

            return clientRect(offset);
        },
        redo: () => editable(() => model.redo()),
        redoSelection: () => {
            if (disposed || ime.busy()) {
                return false;
            }

            let changed = model.redoSelection();

            start(true);

            return changed;
        },
        refresh: () => {
            if (!disposed) {
                measure();
                unitsDirty = true;
                schedule();
            }
        },
        replace: (replacement) => search.replace(replacement),
        replaceAll: (replacement) => search.replaceAll(replacement),
        save: () => {
            if (!disposed && !ime.busy()) {
                callbacks.onSave?.(model.value, model.state);
            }
        },
        select: (next, reveal = true) => {
            if (disposed || ime.busy()) {
                return;
            }

            model.select(next);
            start(reveal);
        },
        selectMany: (ranges, reveal = true) => {
            if (disposed || ime.busy()) {
                return;
            }

            model.selectMany(ranges);
            start(reveal);
        },
        setDocument: (next, settings) => {
            if (disposed) {
                return;
            }

            if (next === model) {
                controller.setOptions(settings ?? {}, !!settings);
                return;
            }

            let focused = !!content && host?.ownerDocument.activeElement === content;

            // A composition commits to the document it started in.
            ime.flush();

            if (surface) {
                visited.set(model, { folds, left: metrics.scrollLeft, revision: model.revision, top: metrics.scrollTop });
            }

            model = next;
            adopt();
            controller.setOptions(settings ?? {}, !!settings);

            if (frame) {
                cancelAnimationFrame(frame);
            }

            paint();

            if (surface) {
                surface.scrollLeft = metrics.scrollLeft;
                surface.scrollTop = metrics.scrollTop;
            }

            if (focused) {
                controller.focus();
            }
        },
        setOptions: (next, replace = false) => {
            if (disposed) {
                return;
            }

            options = { ...(replace ? {} : options), ...next };
            options.tabSize = clamp(Math.trunc(options.tabSize ?? 4) || 4, 1, 16);

            if (!options.indent || !/^[\t ]+$/.test(options.indent)) {
                options.indent = '    ';
            }

            ui.fold = !!options.fold;
            ui.label = options.label ?? 'Markdown editor';
            ui.minimap = !!options.minimap;
            ui.placeholder = options.placeholder ?? '';
            ui.readonly = !!options.readonly;
            ui.spellcheck = options.spellcheck ?? true;
            ui.tabSize = options.tabSize;
            ui.wrap = options.wrap !== false;
            search.status();

            if (!options.fold) {
                folds = [];
            }

            whole = null;
            map.invalidate();
            unitsDirty = true;
            schedule();
        },
        setValue: (value) => {
            if (disposed) {
                return false;
            }

            if (ime.busy()) {
                pendingValue = value;
                return false;
            }

            return model.setValue(value, { source: 'external' });
        },
        get scroller() {
            return surface!;
        },
        get state() {
            return state as Snapshot;
        },
        toggleComment: () => editable(() => toggleComment(model, options.lineComment ?? false, options.blockComment ?? ['<!--', '-->'])),
        undo: () => editable(() => model.undo()),
        undoSelection: () => {
            if (disposed || ime.busy()) {
                return false;
            }

            let changed = model.undoSelection();

            start(true);

            return changed;
        },
        unfold: (line = model.position().line) => {
            if (disposed || ime.busy()) {
                return false;
            }

            let next = folds.filter((fold) => fold.line !== line);

            if (next.length === folds.length) {
                return false;
            }

            folds = next;
            unitsDirty = true;
            schedule();

            return true;
        },
        unfoldAll: () => {
            if (disposed || ime.busy() || !folds.length) {
                return;
            }

            folds = [];
            unitsDirty = true;
            schedule();
        }
    };

    let run = commands({
        cache: () => syntaxCache(model, 'markdown'),
        capture,
        controller: controller as Controller,
        deleteVisible: (backwards, word) => word ? deleteCharacter(model, backwards, true) : erase(backwards),
        get document() {
            return model;
        },
        edit: editable,
        language: () => 'markdown',
        move: moveSelection,
        options: () => options,
        select: (selection) => {
            model.select(selection);
            start(true);
        }
    });

    // The editable text. The browser never edits it: each input is read as an edit of the source and prevented, the
    // blocks it touched draw again, and the selection is put back. Only an input method writes into it, until it ends.
    let field: Attributes = {
        'aria-describedby': help,
        'aria-label': () => ui.label,
        'aria-multiline': 'true',
        'aria-placeholder': () => ui.placeholder,
        'aria-readonly': () => ui.readonly ? 'true' : 'false',
        autocapitalize: 'off',
        class: 'markdown-editor-content',
        contenteditable: () => ui.readonly ? 'false' : 'true',
        'data-placeholder': () => ui.placeholder,
        onbeforeinput: (e: InputEvent) => {
            let type = e.inputType;

            if (ime.busy() || e.isComposing || type === 'insertCompositionText' || type === 'deleteCompositionText' || type === 'insertFromComposition') {
                return;
            }

            // One the browser applies regardless is drawn over from the document once it lands.
            if (!e.cancelable) {
                return;
            }

            e.preventDefault();

            if (options.readonly) {
                return;
            }

            capture();
            revealFolds(!type.startsWith('history'));

            switch (type) {
                case 'deleteContentBackward':
                case 'deleteContentForward':
                    editable(() => erase(type === 'deleteContentBackward'));
                    return;
                case 'deleteWordBackward':
                case 'deleteWordForward':
                    editable(() => deleteCharacter(model, type === 'deleteWordBackward', true));
                    return;
                case 'formatBold':
                    controller.bold();
                    return;
                case 'formatItalic':
                    controller.italic();
                    return;
                case 'historyRedo':
                    controller.redo();
                    return;
                case 'historyUndo':
                    controller.undo();
                    return;
                case 'insertLineBreak':
                    editable(() => insertText(model, model.eol, 'input'));
                    return;
                case 'insertParagraph':
                    controller.newline();
                    return;
                case 'insertReplacementText': {
                    let range = e.getTargetRanges()[0],
                        from = range ? sourceAt(range.startContainer, range.startOffset) : null,
                        to = range ? sourceAt(range.endContainer, range.endOffset) : null;

                    if (from !== null && to !== null) {
                        model.select({ end: Math.max(from, to), start: Math.min(from, to) });
                    }

                    break;
                }
            }

            if (type.startsWith('delete')) {
                // Deletions to a line's edge cover what the browser says they do.
                let range = e.getTargetRanges()[0],
                    from = range ? sourceAt(range.startContainer, range.startOffset) : null,
                    to = range ? sourceAt(range.endContainer, range.endOffset) : null;

                if (from !== null && to !== null && from !== to) {
                    editable(() => remove({ from: Math.min(from, to), to: Math.max(from, to) }));
                }

                return;
            }

            let text = e.data ?? e.dataTransfer?.getData('text/plain') ?? '';

            if (text) {
                typed(text);
            }
        },
        oncompositionend: (e: CompositionEvent) => {
            composed = e.data ?? '';
            ime.attributes.oncompositionend();
        },
        oncompositionstart: ime.attributes.oncompositionstart,
        oncopy: (e: ClipboardEvent) => clip(e, false),
        oncut: (e: ClipboardEvent) => clip(e, true),
        ondragstart: gestures.ondragstart,
        onfocus: () => {
            let native = content?.ownerDocument.getSelection();

            if (!native?.anchorNode || !content?.contains(native.anchorNode)) {
                place();
            }
        },
        oninput: (e: InputEvent) => {
            if (ime.input(e)) {
                return;
            }

            invalidate(model.selection.start);
        },
        onkeydown: (e: KeyboardEvent) => {
            gestures.alt(e);
            linking(e);

            if (ime.busy() || e.isComposing || e.keyCode === 229) {
                return;
            }

            if (options.onCompletionKey?.(e, controller as Controller)) {
                e.preventDefault();
                return;
            }

            if (e.key === 'Escape') {
                escapeTab = true;

                if (model.selections.length > 1) {
                    e.preventDefault();
                    model.select(model.selection);
                }

                return;
            }

            if (e.key === 'Tab' && escapeTab) {
                escapeTab = false;
                return;
            }

            escapeTab = false;
            capture();

            let mod = apple ? e.metaKey : e.ctrlKey,
                key = e.key.toLowerCase();

            if (mod && !e.altKey && !e.shiftKey && (key === 'b' || key === 'i')) {
                e.preventDefault();
                key === 'b' ? controller.bold() : controller.italic();
                return;
            }

            let command = keys(e);

            if (command) {
                e.preventDefault();
                run(command, e);
                return;
            }

            if (NAVIGATION.test(e.key) && !e.altKey && model.selections.length > 1) {
                e.preventDefault();
                moveSelection(e.key, e.shiftKey, mod);
                return;
            }

            // Tab nests list items and indents code; in prose, where indentation would make code, it moves focus.
            if (e.key === 'Tab' && !e.altKey && !mod && options.captureTab !== false && !options.readonly) {
                let kind = kindAt(model.selection.start);

                if (kind === 'code' || kind === 'fence' || kind === 'list') {
                    e.preventDefault();
                    e.shiftKey ? controller.outdent() : controller.indent();
                }
            }
        },
        onkeyup: (e: KeyboardEvent) => {
            gestures.alt(e);
            linking(e);
        },
        onpaste: (e: ClipboardEvent) => {
            if (ime.busy() || options.readonly || !e.clipboardData) {
                return;
            }

            e.preventDefault();

            let text = read(e.clipboardData, model.selections.length);

            editable(() => insertText(model, text, 'paste'));
        },
        role: 'textbox',
        spellcheck: () => ui.spellcheck,
        tabindex: '0'
    };

    let body: Attributes = {
        onclick: (e: MouseEvent) => {
            let link = (e.target as Element).closest('a');

            if (!link) {
                return;
            }

            // Links place the caret on a plain click and open with the platform's modifier.
            e.preventDefault();

            if ((e.ctrlKey || e.metaKey) && link.href) {
                window.open(link.href, '_blank', 'noopener');
            }
        },
        onconnect: (element: HTMLElement) => {
            surface = element;
            connect();
        },
        ondragend: gestures.ondragend,
        ondragleave: gestures.ondragleave,
        ondragover: gestures.ondragover,
        ondrop: gestures.ondrop,
        onlostpointercapture: gestures.end,
        // A press beside the text, in the padding or past the end, still puts the caret on the nearest text.
        onmousedown: (e: MouseEvent) => {
            if (e.button !== 0 || ime.busy() || (e.target !== surface && !(e.target as Element).classList.contains('markdown-editor-spacer'))) {
                return;
            }

            e.preventDefault();
            controller.focus();
            model.select({ start: offsetAt(e.clientX, e.clientY) ?? model.value.length });
        },
        onpointercancel: gestures.end,
        onpointerdown: (e: PointerEvent) => {
            tip.release();
            gestures.onpointerdown(e);
        },
        onpointerleave: () => tip.release(),
        onpointermove: (e: PointerEvent) => {
            gestures.onpointermove(e);
            linking(e);
        },
        onpointerover: (e: PointerEvent) => {
            let link = (e.target as Element).closest<HTMLElement>('a.markdown-editor-link[href]');

            if (link && e.pointerType !== 'touch') {
                tip.request(link, apple ? '⌘+Click to open' : 'Ctrl+Click to open');
            }
            else {
                tip.release();
            }
        },
        onpointerup: gestures.end,
        onscroll: () => {
            metrics.scrollLeft = surface!.scrollLeft;
            metrics.scrollTop = surface!.scrollTop;
            schedule();
        }
    };

    let template = (attributes?: Attributes) => html`
        <div
            class='markdown-editor'
            ${attributes}
            ${{
                class: [
                    () => ime.state.composing && 'markdown-editor--composing',
                    () => gestures.state.crosshair && 'markdown-editor--crosshair',
                    () => ui.empty && 'markdown-editor--empty',
                    () => ui.linking && 'markdown-editor--linking',
                    () => ui.fold && 'markdown-editor--fold',
                    () => ui.minimap && 'markdown-editor--minimap',
                    () => !ui.wrap && 'markdown-editor--nowrap',
                    () => ui.readonly && 'markdown-editor--readonly'
                ],
                onconnect: (element: HTMLElement) => {
                    host = element;
                    connect();
                },
                ondisconnect: () => controller.dispose(),
                ondocumentselectionchange: capture,
                // A modifier released in another window never reaches this one.
                onwindowblur: () => {
                    ui.linking = false;
                },
                style: () => `--tab-size: ${ui.tabSize};`
            }}
        >
            ${search.template()}
            ${jump.template()}
            <div class='markdown-editor-body' ${size}>
                <div class='markdown-editor-surface --scrollbar' ${body}>
                    <div aria-hidden='true' class='markdown-editor-overlay'>
                        ${html.reactive(decorations, (decoration) => html`
                            <div ${{ class: () => decoration.kind, style: () => decoration.style }}></div>
                        `)}
                    </div>
                    <div
                        ${field}
                        ${{
                            onconnect: (element: HTMLElement) => {
                                content = element;
                                connect();
                            }
                        }}
                    >
                        ${html.reactive(items, (item) => 'block' in item
                            ? draw.template(item)
                            : html`<div aria-hidden='true' class='markdown-editor-spacer' contenteditable='false' ${{ style: () => `height: ${item.height}px;` }}></div>`
                        )}
                    </div>
                </div>
                ${map.template()}
                <span
                    aria-hidden='true'
                    class='markdown-editor-ruler'
                    ${{
                        onconnect: (element: HTMLElement) => {
                            ruler = element;
                            connect();
                        }
                    }}
                >0000000000000000000000000000000000000000000000000000000000000000</span>
            </div>
            <span class='markdown-editor-help' id='${help}'>Press Escape then Tab to move focus out of the editor.</span>
            ${tip.render()}
        </div>
    `;

    return { controller, template };
};


export { view };
export type { MarkdownController, MarkdownOptions };
