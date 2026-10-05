import { flush, reactive } from '@esportsplus/reactivity';
import { html, type Attributes } from '@esportsplus/template';
import icon from '~/components/icon';
import { clamp } from '~/shared/clamp';
import { mac } from '~/shared/platform';
import { observeSize } from '~/shared/resize';
import { copied, read, write } from '../clipboard';
import { addNextOccurrence, deleteCharacter, indent, insertText, lineCommand, toggleComment } from '../commands';
import { composition } from '../composition';
import { write as writeField } from '../field';
import { find } from '../find';
import { mapFolds, outerFolds, type FoldRange } from '../folding';
import { goto } from '../goto';
import { commands, keymap } from '../keymap';
import { EditorLayout, type Rect } from '../layout';
import { minimap, type Source } from '../minimap';
import { move } from '../navigation';
import { pointer } from '../pointer';
import { inputEdit, NativeText, type Before } from '../projection';
import { syntaxCache, type Token } from '../syntax';
import { markdownCommand } from './editing';
import { parseInline, type Inline, type References } from './inline';
import { arrange, cache, headingScale, MarkdownLayout, SCALED_LINE, unitStart, type Unit } from './layout';
import {
    blockAt,
    contentEnd,
    markdownBackspace,
    markdownReferences,
    parseMarkdown,
    reparse,
    toggleTask,
    type Kind,
    type MarkdownBlock
} from './model';
import { renderer } from './render';
import { foldable, foldAt, markdownFolds } from './structure';
import type { Change, Edit, EditorDocument, Selection, Snapshot } from '../document';
import type { Callbacks, Controller, Options } from '../view';
import chevron from '@esportsplus/ui/svg/chevron-down.svg';


type Active = { first: number; from: number; last: number; to: number };

type Decoration = { kind: string; style: string };

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


const DECORATIONS = 1000;

const NAVIGATION = /^(ArrowDown|ArrowLeft|ArrowRight|ArrowUp|End|Home|PageDown|PageUp)$/;

const NONE: readonly number[] = [];

const NO_TOKENS: readonly Token[] = [];

const TOKEN_COLORS = ['comment', 'keyword', 'operator', 'property', 'string', 'type', 'variable'] as const;

const VERTICAL = /^(ArrowDown|ArrowUp|PageDown|PageUp)$/;


let uid = 0;


// Brings a reactive list to 'next' with the fewest splices, so units that stay keep their DOM. Both are ordered
// runs of the same unit list.
function assign(list: Unit[], next: readonly Unit[]) {
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

function prevent(e: Event) {
    e.preventDefault();
}


// The markdown editor's view: blocks render formatted until the caret enters one, which then edits as source in a
// native textarea standing in its place. Only units near the viewport are drawn, keyed by block, so edits redraw the
// block they touched. Returns its template and controller.
const view = (model: EditorDocument, callbacks: Callbacks, receive?: (controller: MarkdownController) => void) => {
    let active: Active | null = null,
        activeIndex = -1,
        apple = mac(),
        before: Before | null = null,
        beforeRanges: readonly Selection[] = [],
        beforeSelection: Selection | undefined,
        blocks = parseMarkdown(model),
        decorations = reactive([] as Decoration[]),
        definitions: References = new Map(),
        disposed = false,
        drag: { anchor: number; head: number } | null = null,
        // Content height the minimap last drew.
        drawn = 0,
        dropAt: number | null = null,
        editing = false,
        escapeTab = false,
        estimated = false,
        fieldSource = '',
        folds: FoldRange[] = [],
        frame = 0,
        geometry: EditorLayout | null = null,
        goals: number[] = [],
        help = `markdown-editor-help-${++uid}`,
        host: HTMLElement | undefined,
        inlines = new WeakMap<MarkdownBlock, { definitions: References; tokens: readonly Inline[] }>(),
        inputData: string | null = null,
        inputType = '',
        keys = keymap(apple),
        layout = new MarkdownLayout(),
        length = model.value.length,
        listed = { after: reactive([] as Unit[]), before: reactive([] as Unit[]) },
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
        observer: ResizeObserver | undefined = new ResizeObserver(resized),
        options: MarkdownOptions = { wrap: true },
        palette: Record<string, string> = {},
        parsed = model.revision,
        pendingValue: string | undefined,
        pinned = false,
        pointerId = -1,
        projection = new NativeText(''),
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
        textarea: HTMLTextAreaElement | undefined,
        ui = reactive({
            between: 0,
            bottom: 0,
            editing: false,
            foldable: false,
            height: 20,
            input: '',
            label: 'Markdown editor',
            minimap: false,
            name: '',
            next: 0,
            placeholder: '',
            readonly: false,
            spellcheck: true,
            style: '',
            tabSize: 4,
            top: 0,
            wrap: true
        }),
        units = cache(),
        unitsDirty = true,
        unsubscribe: VoidFunction | undefined,
        // Where each document this editor showed was left.
        visited = new WeakMap<EditorDocument, Memo>(),
        whole: { layout: EditorLayout; projection: NativeText; revision: number } | null = null,
        writing = false,
        written = '';

    let activeUnit: Unit = {
        active: true,
        block: blocks[0],
        continuation: false,
        continues: false,
        estimate: 0,
        estimated: -1,
        height: 0,
        measured: -1,
        raw: false
    };

    let draw = renderer({
        fold: (unit) => {
            controller.fold(model.lineAt(unit.block.from) + 1);
        },
        foldable: opens,
        inline: inlineOf,
        press,
        readonly: () => ui.readonly,
        shown: (element, unit) => {
            if (unit) {
                shown.set(element, unit);

                observer?.observe(element);
            }
            else {
                shown.delete(element);
                observer?.unobserve(element);
            }
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

    let ime = composition({
        begin: () => {
            capture();
            beforeRanges = model.selections;
            beforeSelection = model.selection;
            model.breakHistory();
        },
        commit: (conflict) => {
            if (conflict) {
                reset();
                resync();
            }
            else {
                accept(true);
            }

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
        focus: () => {
            if (editing) {
                textarea?.focus({ preventScroll: true });
            }
        },
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

    // Applies a native input to the document. 'beforeinput' recorded the field's selection and length, so most inputs
    // resolve without a diff; the rest diff the field's value.
    function accept(composed = false) {
        if (disposed || !textarea || !active) {
            return;
        }

        if (options.readonly) {
            reset();
            resync();
            return;
        }

        let after = { end: textarea.selectionEnd, length: textarea.textLength, start: textarea.selectionStart },
            base = active.from,
            direction = textarea.selectionDirection,
            native = before && !composed ? inputEdit(before, after, inputType, inputData) : null,
            ranges = beforeRanges.length ? beforeRanges : model.selections,
            value = textarea.value,
            edit: Edit;

        if (native) {
            edit = projection.toSourceEdit(model.value, native.from, native.to, native.insert);
        }
        else if (value === projection.value) {
            reset();
            capture();
            return;
        }
        else {
            let selection = beforeSelection
                ? { end: clamp(beforeSelection.end - base, 0, fieldSource.length), start: clamp(beforeSelection.start - base, 0, fieldSource.length) }
                : undefined;

            edit = projection.edit(model.value, value, selection, inputType);
        }

        // A native edit the projection can't map would remove text the field doesn't show; the field goes back.
        if (edit.from === edit.to && !edit.insert) {
            reset();
            resync();
            return;
        }

        let group = !composed && /^(deleteContentBackward|deleteContentForward|insertText)$/.test(inputType) ? inputType : undefined,
            origin = composed ? 'composition' : 'input';

        written = value;

        if (ranges.length > 1) {
            reset();
            insertText(model, edit.insert, origin);
            return;
        }

        let from = base + edit.from,
            caret = native
                ? { direction, end: from + edit.insert.length, start: from + edit.insert.length }
                : caretAfter(edit, after, direction);

        reset();
        model.replace(from, base + edit.to, edit.insert, { group, selection: caret, source: origin });
    }

    // Shows the field for the selection.
    function activate(focus: boolean) {
        if (disposed) {
            return;
        }

        editing = true;
        ui.editing = true;
        refresh();
        schedule();

        if (focus && textarea && host?.ownerDocument.activeElement !== textarea) {
            // The field must be displayed before it can take focus.
            flush();
            textarea.focus({ preventScroll: true });
        }
    }

    // Takes over from the previous document: whatever was derived from it goes, and this one's view comes back as
    // this editor left it, folds only while its text is unchanged since.
    function adopt() {
        let memo = visited.get(model),
            { selections, ...single } = model.state;

        reset();
        active = null;
        activeIndex = -1;
        blocks = parseMarkdown(model);
        activeUnit.block = blocks[0];
        drag = null;
        dropAt = null;
        escapeTab = false;
        fieldSource = '';
        folds = memo?.revision === model.revision ? memo.folds : [];
        geometry = null;
        goals = [];
        length = model.value.length;
        metrics.scrollLeft = memo?.left ?? 0;
        metrics.scrollTop = memo?.top ?? 0;
        parsed = model.revision;
        pendingValue = undefined;
        projection = new NativeText('');
        secondary = selections.length > 1;
        whole = null;
        written = '';
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

    function capture() {
        if (disposed || !textarea || !active || !editing || ime.busy() || writing || textarea.value !== written) {
            return;
        }

        let base = active.from,
            next: Selection = {
                direction: textarea.selectionDirection,
                end: base + projection.toSource(textarea.selectionEnd),
                start: base + projection.toSource(textarea.selectionStart)
            };

        let primary = model.selection;

        // A field reports a direction even for a caret, and 'forward' where the document has none.
        if (
            next.start === primary.start &&
            next.end === primary.end &&
            (next.start === next.end || next.direction === primary.direction || primary.direction === 'none')
        ) {
            return;
        }

        model.selectMany([next, ...model.selections.slice(1)]);
    }

    function caretAfter(edit: Edit, after: Before, direction: Selection['direction']) {
        let base = active!.from,
            next = new NativeText(fieldSource.slice(0, edit.from) + edit.insert + fieldSource.slice(edit.to));

        return { direction, end: base + next.toSource(after.end), start: base + next.toSource(after.start) };
    }

    // Client rectangle of a source offset: the field's geometry inside it, the drawn text elsewhere, or else the
    // unit's top.
    function clientRect(offset: number): Rect | null {
        if (!surface) {
            return null;
        }

        current();

        let box = surface.getBoundingClientRect(),
            originX = box.left + surface.clientLeft - surface.scrollLeft,
            originY = box.top + surface.clientTop - surface.scrollTop;

        if (active && editing && geometry && offset >= active.from && offset <= active.to) {
            let rect = geometry.rect(projection.toNative(offset - active.from));

            return {
                height: rect.height,
                left: originX + fieldLeft() + rect.left,
                top: originY + metrics.padTop + layout.top(activeIndex) + rect.top,
                width: rect.width
            };
        }

        let index = layout.indexOf(offset),
            unit = layout.units[index];

        if (!unit) {
            return null;
        }

        let rects = textRects(unit, offset, offset);

        if (rects.length) {
            return rects[0];
        }

        return { height: metrics.lineHeight, left: originX + metrics.padLeft, top: originY + metrics.padTop + layout.top(index), width: 1 };
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
        if (disposed || !host || !ruler || !surface || !textarea || unsubscribe) {
            return;
        }

        measure();
        subscribe();
        refresh();
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

    // Hides the field; every block shows formatted again.
    function deactivate() {
        if (!editing) {
            return;
        }

        ime.flush();
        editing = false;
        drag = null;
        ui.editing = false;
        gestures.reset();
        refresh();
        schedule();
    }

    function decorate() {
        let items: Decoration[] = [],
            ranges = model.selections,
            matches = search.state.open || search.state.query ? search.result() : null;

        if (ranges.length < 2 && !drag && dropAt === null && !matches?.matches.length) {
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

        if (drag) {
            mark(Math.min(drag.anchor, drag.head), Math.max(drag.anchor, drag.head), 'markdown-editor-mark markdown-editor-mark--selection');
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

    function editable(run: () => boolean) {
        if (disposed || options.readonly || ime.busy()) {
            return false;
        }

        capture();
        revealFolds(true);

        let changed = run();

        start(true);

        return changed;
    }

    // Lays out the field's text and sizes it; the field's styles must match what this assumes.
    function fieldGeometry() {
        if (!active) {
            geometry = null;
            return;
        }

        let block = blocks[active.first],
            scale = headingScale(block.level),
            fontSize = metrics.fontSize * scale,
            lineHeight = block.level && block.level <= 2 ? fontSize * SCALED_LINE : metrics.lineHeight,
            wrap = options.wrap !== false,
            width = Math.max(1, metrics.width - block.quoteDepth * metrics.quoteIndent);

        geometry = new EditorLayout(projection, fieldSource, wrap ? width : Number.MAX_SAFE_INTEGER, lineHeight, metrics.charWidth * scale, options.tabSize ?? 4, wrap);
        estimated = false;

        if (wrap) {
            for (let i = 0, n = geometry.count; i < n && !estimated; i++) {
                estimated = geometry.estimated(i);
            }
        }

        let height = Math.max(lineHeight, geometry.height),
            widest = 0;

        if (!wrap) {
            for (let i = 0, n = geometry.count; i < n; i++) {
                widest = Math.max(widest, geometry.end(i) - geometry.lineFrom(i));
            }
        }

        ui.height = height;
        ui.input = `markdown-editor-input markdown-editor-input--${block.kind}${block.level ? ` markdown-editor-input--h${block.level}` : ''}${block.quoteDepth ? ' markdown-editor-input--quoted' : ''}`;
        ui.style = `--depth: ${block.quoteDepth};${wrap ? '' : ` --field-width: ${Math.ceil((widest + 1) * metrics.charWidth * scale)}px;`}`;

        layout.measure(activeUnit, height);
    }

    // Left edge of the field's text in the surface's padding box.
    function fieldLeft() {
        return metrics.padLeft + (active ? blocks[active.first].quoteDepth * metrics.quoteIndent : 0);
    }

    // Client rectangles of [from, to) inside the field, one per row, from its geometry.
    function fieldRects(from: number, to: number, out: Rect[]) {
        if (!active || !geometry || !surface) {
            return;
        }

        let box = surface.getBoundingClientRect(),
            x = box.left + surface.clientLeft - surface.scrollLeft + fieldLeft(),
            y = box.top + surface.clientTop - surface.scrollTop + metrics.padTop + layout.top(activeIndex),
            end = geometry.rect(projection.toNative(clamp(to, active.from, active.to) - active.from)),
            start = geometry.rect(projection.toNative(clamp(from, active.from, active.to) - active.from)),
            lineHeight = geometry.lineHeight;

        if (from === to) {
            out.push({ height: lineHeight, left: x + start.left, top: y + start.top, width: 1 });
            return;
        }

        for (let top = start.top; top <= end.top && out.length < DECORATIONS; top += lineHeight) {
            let left = top === start.top ? start.left : 0,
                right = top === end.top ? end.left : geometry.width;

            out.push({ height: lineHeight, left: x + left, top: y + top, width: Math.max(1, right - left) });
        }
    }

    // Applies a drag or click on the drawn text once the pointer comes back up.
    function finish() {
        if (!drag) {
            return;
        }

        let { anchor, head } = drag;

        drag = null;
        model.select({ direction: head < anchor ? 'backward' : 'forward', end: Math.max(anchor, head), start: Math.min(anchor, head) });
        activate(true);
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

    // The block kind at a source offset, for commands that leave literal source alone.
    function kindAt(offset: number): Kind | undefined {
        return blocks[blockAt(blocks, offset)]?.kind;
    }

    // Whether a plain arrow key at the field's edge leaves it for the neighbouring block.
    function leaves(key: string) {
        if (!active || !geometry || !textarea) {
            return false;
        }

        let head = textarea.selectionDirection === 'backward' ? textarea.selectionStart : textarea.selectionEnd;

        if (key === 'ArrowLeft') {
            return head === 0 && active.from > 0;
        }

        if (key === 'ArrowRight') {
            return head === textarea.textLength && active.to < model.value.length;
        }

        let rect = geometry.rect(head);

        if (key === 'ArrowUp') {
            return rect.top < geometry.lineHeight / 2 && active.from > 0;
        }

        return rect.top + geometry.lineHeight >= geometry.height - 0.5 && active.to < model.value.length;
    }

    // Source lines [first, last] unit 'index' covers.
    function linesOf(index: number) {
        let units = layout.units,
            from = unitStart(units[index]),
            to = index + 1 < units.length ? unitStart(units[index + 1]) - 1 : model.value.length;

        return { first: model.lineAt(from), last: model.lineAt(Math.max(from, to)) };
    }

    // Marks which drawn units in [from, to) show a fold marker; only neighbouring blocks are looked at.
    function markFoldable(from: number, to: number) {
        let units = layout.units;

        for (let i = from; i < to; i++) {
            let unit = units[i],
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
        if (disposed || !host || !ruler || !surface || !textarea) {
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
            fieldGeometry();
            map.invalidate();
            unitsDirty = true;
        }

        schedule();
    }

    function moveSelection(key: string, extend: boolean, word = false, add = false, boundary = false) {
        if (!VERTICAL.test(key) || boundary || add) {
            goals = [];
        }

        if (!whole || whole.revision !== model.revision) {
            let native = new NativeText(model.value);

            whole = {
                layout: new EditorLayout(native, model.value, Number.MAX_SAFE_INTEGER, metrics.lineHeight, metrics.charWidth, options.tabSize ?? 4, false),
                projection: native,
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
        if (disposed || !surface) {
            return null;
        }

        current();

        let box = surface.getBoundingClientRect();

        if (box.width && (clientX < box.left || clientX > box.right || clientY < box.top || clientY > box.bottom)) {
            return null;
        }

        if (active && editing && textarea && geometry) {
            let field = textarea.getBoundingClientRect();

            if (clientY >= field.top && clientY < field.bottom) {
                return active.from + projection.toSource(geometry.offset(clientX - field.left + textarea.scrollLeft, clientY - field.top));
            }
        }

        let point = pointAt(clientX, clientY);

        if (point !== null) {
            return point;
        }

        // Off the text (a marker, padding, an image): the unit under the point.
        let under = host!.ownerDocument.elementFromPoint(clientX, clientY)?.closest('.markdown-editor-block'),
            unit = under && shown.get(under);

        if (unit) {
            return contentStart(unit);
        }

        let index = layout.at(clientY - box.top - surface.clientTop + surface.scrollTop - metrics.padTop);

        return layout.units[index] ? contentStart(layout.units[index]) : null;
    }

    // Whether a drawn unit shows a fold marker; only neighbouring blocks are looked at.
    function opens(unit: Unit) {
        return options.fold !== false && !unit.continuation && !unit.raw && !unit.fold && foldable(blocks, blockAt(blocks, unit.block.from), model.value);
    }

    function paint() {
        frame = 0;

        if (disposed || !surface) {
            return;
        }

        current();

        if (estimated && textarea && editing) {
            // The arithmetic only estimated some of the field's rows; it takes the height the DOM drew instead.
            flush();

            let height = textarea.scrollHeight;

            if (height > ui.height + 0.5) {
                ui.height = height;
                layout.measure(activeUnit, height);
            }

            estimated = false;
        }

        if (revealing) {
            revealing = false;
            reveal();
        }

        let n = layout.units.length,
            a = activeIndex,
            view = layout.window(metrics.scrollTop - metrics.padTop, metrics.clientHeight),
            split = a < 0 ? n : a,
            s1 = Math.min(view.start, split),
            e1 = Math.min(view.end, split),
            s2 = Math.max(view.start, split + 1),
            e2 = Math.max(view.end, s2);

        if (a < 0) {
            s2 = e2 = n;
        }

        if (view.start > split) {
            s1 = e1 = split;
        }

        assign(listed.before, layout.units.slice(s1, e1));
        assign(listed.after, layout.units.slice(s2, e2));
        ui.top = layout.top(s1);
        ui.between = a < 0 ? 0 : layout.top(split) - layout.top(e1);
        ui.next = a < 0 ? 0 : layout.top(s2) - layout.top(a + 1);
        ui.bottom = layout.total - layout.top(a < 0 ? e1 : e2);
        ui.foldable = !!active && options.fold !== false && foldable(blocks, active.first, model.value);

        markFoldable(s1, e1);
        markFoldable(s2, e2);
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

    // Source offset under a client point from the text node there.
    function pointAt(clientX: number, clientY: number) {
        let doc = host!.ownerDocument as Document & {
                caretPositionFromPoint?: (x: number, y: number) => { offset: number; offsetNode: Node } | null;
            },
            point = doc.caretPositionFromPoint?.(clientX, clientY),
            range = point ? null : doc.caretRangeFromPoint?.(clientX, clientY);

        return draw.offset(point?.offsetNode ?? range?.startContainer ?? null, point?.offset ?? range?.startOffset ?? 0);
    }

    // Draws the window at the scroll position now rather than next frame, so the surface is as tall as its content
    // before the position applies.
    function present() {
        if (disposed || !surface) {
            return;
        }

        if (frame) {
            cancelAnimationFrame(frame);
        }

        paint();
        flush();
        surface.scrollLeft = metrics.scrollLeft;
        surface.scrollTop = metrics.scrollTop;
    }

    // A press on a drawn unit places the caret where it lands, in the same gesture: nothing redraws until the
    // pointer comes back up, so the press and release meet the same nodes.
    function press(e: MouseEvent, unit: Unit | null) {
        if (disposed || ime.busy() || e.button !== 0 || e.altKey || e.defaultPrevented) {
            return;
        }

        let target = e.target as Element;

        if ((e.ctrlKey || e.metaKey) && target.closest('a')) {
            return;
        }

        e.preventDefault();

        let offset = pointAt(e.clientX, e.clientY) ?? (unit ? contentStart(unit) : offsetAt(e.clientX, e.clientY) ?? 0),
            selection = model.selection;

        drag = {
            anchor: e.shiftKey ? (selection.direction === 'backward' ? selection.end : selection.start) : offset,
            head: offset
        };

        if (pointerId >= 0 && surface?.isConnected) {
            try {
                surface.setPointerCapture(pointerId);
            }
            catch {
                // The pointer may already be gone.
            }
        }

        schedule();
    }

    function rangeRects(from: number, to: number) {
        let out: Rect[] = [],
            units = layout.units,
            first = layout.indexOf(from),
            last = layout.indexOf(to);

        for (let i = first; i <= last && out.length < DECORATIONS; i++) {
            let unit = units[i];

            if (unit === activeUnit) {
                fieldRects(from, to, out);
            }
            else {
                let rects = textRects(unit, from, to);

                for (let j = 0, n = rects.length; j < n; j++) {
                    out.push(rects[j]);
                }
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

        if (active) {
            activeUnit.block = blocks[active.first];
        }

        let list = arrange(
            blocks,
            model.value,
            options.fold === false ? [] : folds,
            units,
            active && editing ? { first: active.first, last: active.last, unit: activeUnit } : null,
            raw ? (index) => raw.has(index) : null
        );

        layout.set(list, model.value);
        activeIndex = -1;

        if (active && editing) {
            let index = layout.indexOf(active.from);

            activeIndex = list[index] === activeUnit ? index : list.indexOf(activeUnit);
        }

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

    // Brings the field to the primary selection: which blocks it covers, its text, its selection and its size.
    function refresh() {
        if (disposed) {
            return;
        }

        if (!editing || !blocks.length) {
            if (active) {
                active = null;
                geometry = null;
                unitsDirty = true;
            }

            return;
        }

        let selection = model.selection,
            first = blockAt(blocks, selection.start),
            last = blockAt(blocks, selection.end) + 1;

        // A drag inside the field never shrinks it under the pointer.
        if (pinned && active && active.last <= blocks.length) {
            first = Math.min(first, active.first);
            last = Math.max(last, active.last);
        }

        let from = blocks[first].from,
            to = Math.max(selection.end, contentEnd(model.value, blocks[last - 1]));

        if (!active || active.first !== first || active.last !== last) {
            unitsDirty = true;
        }

        active = { first, from, last, to };

        let text = model.value.slice(from, to),
            shaped = fieldSource !== text || !geometry;

        if (fieldSource !== text) {
            fieldSource = text;
            projection = new NativeText(text);
        }

        if (shaped || activeUnit.block !== blocks[first]) {
            activeUnit.block = blocks[first];
            fieldGeometry();
        }

        if (!textarea || ime.busy()) {
            return;
        }

        if (written !== projection.value) {
            writing = true;

            try {
                writeField(textarea, written, projection.value, null);
            }
            finally {
                writing = false;
            }

            written = projection.value;
        }

        let nativeEnd = projection.toNative(clamp(selection.end - from, 0, text.length)),
            nativeStart = projection.toNative(clamp(selection.start - from, 0, text.length));

        if (
            textarea.selectionStart !== nativeStart ||
            textarea.selectionEnd !== nativeEnd ||
            (nativeStart !== nativeEnd && selection.direction !== 'none' && textarea.selectionDirection !== selection.direction)
        ) {
            textarea.setSelectionRange(nativeStart, nativeEnd, selection.direction);
        }
    }

    // Brings the blocks up to the document: only from the edited block until block boundaries line up again. True
    // when only blocks the field stands for changed, so the units stay as they are.
    function reparseBlocks() {
        let deltas = model.deltas(parsed),
            previous = length;

        length = model.value.length;
        parsed = model.revision;

        if (!deltas) {
            blocks = parseMarkdown(model);
            map.invalidate();
            references();
            return false;
        }

        if (!deltas.length) {
            return true;
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
            return false;
        }

        // Edits that kept the line count only redraw their lines in the minimap.
        if (moved) {
            map.invalidate();
        }
        else {
            map.invalidate(start, end);
        }

        return !!active &&
            editing &&
            splice.dropped.length === splice.inserted &&
            splice.start >= active.first &&
            splice.start + splice.inserted <= active.last;
    }

    function reset() {
        before = null;
        beforeRanges = [];
        beforeSelection = undefined;
        inputData = null;
        inputType = '';
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

    // Writes the field again whatever it holds.
    function resync() {
        written = '';
        refresh();
        schedule();
    }

    // Scrolls the primary selection's head into view.
    function reveal() {
        let selection = model.selection,
            head = selection.direction === 'backward' ? selection.start : selection.end,
            height = metrics.lineHeight,
            y: number;

        if (active && editing && geometry && head >= active.from && head <= active.to) {
            let rect = geometry.rect(projection.toNative(head - active.from));

            height = rect.height;
            y = metrics.padTop + layout.top(activeIndex) + rect.top;

            if (options.wrap === false && surface) {
                let x = fieldLeft() + rect.left;

                if (x < metrics.scrollLeft + metrics.padLeft) {
                    surface.scrollLeft = metrics.scrollLeft = Math.max(0, x - metrics.padLeft);
                }
                else if (x + metrics.padLeft > metrics.scrollLeft + metrics.width) {
                    surface.scrollLeft = metrics.scrollLeft = x + metrics.padLeft - metrics.width;
                }
            }
        }
        else {
            let index = layout.indexOf(head),
                unit = layout.units[index];

            if (!unit) {
                return;
            }

            y = metrics.padTop + layout.top(index);
            height = Math.min(layout.height(unit), metrics.clientHeight);
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

    // Shows the selection once a gesture or command set it, revealing it when asked.
    function start(reveal: boolean) {
        if (!editing) {
            activate(false);
        }

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
            }

            if (change.selectionChanged) {
                revealFolds();
                // Blocks holding secondary carets draw as source.
                unitsDirty ||= secondary || selections.length > 1;
                secondary = selections.length > 1;
            }

            refresh();
            schedule();

            if (change.selectionChanged) {
                callbacks.onSelection?.(snapshot.selection, model.position());
            }

            if (change.textChanged) {
                callbacks.onChange?.(snapshot.value, change, snapshot);
            }
        });
    }

    function textChanged(change: Change) {
        let local = reparseBlocks();

        if (folds.length) {
            folds = outerFolds(mapFolds(folds, change.editBatches ?? [], model));
            local = false;
        }

        whole = null;
        unitsDirty ||= !local || secondary;
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
                observer?.disconnect();
                observer = undefined;
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
            if (!disposed) {
                activate(true);
            }
        },
        fold: (line) => {
            if (disposed || ime.busy() || options.fold === false) {
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

            // A field showing the fold's own lines would hide nothing; the block shows folded instead.
            if (active && range.from < blocks[active.last - 1].to && range.to > active.from) {
                deactivate();
                textarea?.blur();
            }

            unitsDirty = true;
            schedule();

            return true;
        },
        foldAll: () => {
            if (disposed || ime.busy() || options.fold === false) {
                return;
            }

            model.select({ start: 0 });
            folds = outerFolds(markdownFolds(model, blocks));
            deactivate();
            textarea?.blur();
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
                fieldGeometry();
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

            let focused = editing && !!textarea && host?.ownerDocument.activeElement === textarea;

            // Hiding the field commits a composition to the document it started in.
            deactivate();

            if (surface) {
                visited.set(model, { folds, left: metrics.scrollLeft, revision: model.revision, top: metrics.scrollTop });
            }

            model = next;
            adopt();
            controller.setOptions(settings ?? {}, !!settings);
            present();

            if (focused) {
                activate(true);
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

            ui.label = options.label ?? 'Markdown editor';
            ui.minimap = !!options.minimap;
            ui.name = options.name ?? '';
            ui.placeholder = options.placeholder ?? '';
            ui.readonly = !!options.readonly;
            ui.spellcheck = options.spellcheck ?? true;
            ui.tabSize = options.tabSize;
            ui.wrap = options.wrap !== false;
            search.status();

            if (options.fold === false) {
                folds = [];
            }

            whole = null;
            fieldGeometry();
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
        get textarea() {
            return textarea!;
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
        deleteVisible: (backwards, word) => deleteCharacter(model, backwards, word),
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

    let field: Attributes = {
        'aria-describedby': help,
        'aria-label': () => ui.label,
        class: () => ui.input,
        name: () => ui.name,
        onbeforeinput: (e: InputEvent) => {
            if (writing || ime.busy() || e.isComposing || !textarea) {
                return;
            }

            capture();
            revealFolds(!e.inputType.startsWith('history') && !options.readonly);

            before = { end: textarea.selectionEnd, length: textarea.textLength, start: textarea.selectionStart };
            beforeRanges = model.selections;
            beforeSelection = model.selection;
            inputData = e.data;
            inputType = e.inputType;

            if (e.inputType === 'historyUndo' || e.inputType === 'historyRedo') {
                if (e.cancelable) {
                    e.preventDefault();
                    e.inputType === 'historyUndo' ? controller.undo() : controller.redo();
                }

                return;
            }

            if (!e.cancelable || options.readonly) {
                return;
            }

            if (model.selections.length > 1) {
                if (e.inputType === 'insertText' && e.data !== null) {
                    e.preventDefault();
                    editable(() => insertText(model, e.data!, 'input'));
                    return;
                }

                if (/^delete(?:Content|Word)(?:Backward|Forward)$/.test(e.inputType)) {
                    e.preventDefault();
                    editable(() => e.inputType === 'deleteContentBackward'
                        ? markdownCommand(model, 'backspace', kindAt)
                        : deleteCharacter(model, e.inputType.endsWith('Backward'), e.inputType.startsWith('deleteWord')));
                    return;
                }
            }

            if (e.inputType === 'insertLineBreak' || e.inputType === 'insertParagraph') {
                e.preventDefault();
                controller.newline();
            }
            else if (e.inputType === 'deleteContentBackward' && editable(() => markdownBackspace(model))) {
                e.preventDefault();
            }
        },
        oncompositionend: ime.attributes.oncompositionend,
        oncompositionstart: ime.attributes.oncompositionstart,
        oncopy: (e: ClipboardEvent) => clip(e, false),
        oncut: (e: ClipboardEvent) => clip(e, true),
        ondragstart: gestures.ondragstart,
        onfocus: () => {
            if (!editing) {
                activate(false);
            }

            capture();
        },
        oninput: (e: InputEvent) => {
            if (writing) {
                return;
            }

            if (ime.input(e)) {
                // The field grows with a composition the document doesn't hold yet.
                if (textarea && textarea.scrollHeight > ui.height) {
                    ui.height = textarea.scrollHeight;
                }

                return;
            }

            if (e.inputType === 'historyUndo' || e.inputType === 'historyRedo') {
                e.inputType === 'historyUndo' ? controller.undo() : controller.redo();
                return;
            }

            accept();
        },
        onkeydown: (e: KeyboardEvent) => {
            gestures.alt(e);

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

            if (mod) {
                if (e.altKey || !NAVIGATION.test(e.key)) {
                    return;
                }

                if (/^(End|Home)$/.test(e.key) || (apple && /^Arrow(Down|Up)$/.test(e.key))) {
                    e.preventDefault();
                    moveSelection(e.key, e.shiftKey, false, false, true);
                }
                else if (model.selections.length > 1 || (/^Arrow(Left|Right)$/.test(e.key) && leaves(e.key))) {
                    e.preventDefault();
                    moveSelection(e.key, e.shiftKey, true);
                }

                return;
            }

            if (e.key === 'Tab' && !e.altKey && options.captureTab !== false && !options.readonly) {
                e.preventDefault();
                e.shiftKey ? controller.outdent() : controller.indent();
            }
            else if (e.key === 'Enter' && !e.altKey && !options.readonly) {
                e.preventDefault();
                controller.newline();
            }
            else if ((e.key === 'Backspace' || e.key === 'Delete') && !options.readonly && model.selections.length > 1) {
                e.preventDefault();
                editable(() => e.key === 'Backspace' && !e.altKey
                    ? markdownCommand(model, 'backspace', kindAt)
                    : deleteCharacter(model, e.key === 'Backspace', e.altKey));
            }
            else if ((e.key === 'Backspace' || e.key === 'Delete') && !options.readonly && active) {
                let selection = model.selection,
                    collapsed = selection.start === selection.end;

                if (e.key === 'Backspace' && collapsed && editable(() => markdownBackspace(model))) {
                    e.preventDefault();
                }
                else if (e.key === 'Backspace' && collapsed && selection.start === active.from && active.from > 0) {
                    // The line break before the field isn't in it; joining lines takes the document.
                    e.preventDefault();
                    editable(() => deleteCharacter(model, true, e.altKey));
                }
                else if (e.key === 'Delete' && collapsed && selection.end === active.to && active.to < model.value.length) {
                    e.preventDefault();
                    editable(() => deleteCharacter(model, false, e.altKey));
                }
            }
            else if (NAVIGATION.test(e.key) && (model.selections.length > 1 || e.key.startsWith('Page') || leaves(e.key))) {
                e.preventDefault();
                moveSelection(e.key, e.shiftKey, e.altKey);
            }
        },
        onkeyup: (e: KeyboardEvent) => {
            gestures.alt(e);
            capture();
        },
        onpaste: (e: ClipboardEvent) => {
            if (ime.busy() || options.readonly || !e.clipboardData) {
                return;
            }

            e.preventDefault();

            let text = read(e.clipboardData, model.selections.length);

            editable(() => insertText(model, text, 'paste'));
        },
        onpointerdown: () => {
            goals = [];
            pinned = true;
        },
        onpointerup: () => {
            pinned = false;
            capture();
        },
        onselect: capture,
        onselectionchange: capture,
        placeholder: () => ui.placeholder,
        readOnly: () => ui.readonly,
        spellcheck: () => ui.spellcheck,
        style: () => `${ui.style} height: ${ui.height}px;`,
        wrap: () => ui.wrap ? 'soft' : 'off'
    };


    let body: Attributes = {
        'aria-label': () => ui.label,
        onclick: (e: MouseEvent) => {
            // Links edit in place on a plain click and open with the platform's modifier.
            if (!(e.ctrlKey || e.metaKey) && (e.target as Element).closest('a')) {
                e.preventDefault();
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
        onfocus: (e: FocusEvent) => {
            if (e.target === surface) {
                controller.focus();
            }
        },
        onlostpointercapture: () => {
            gestures.end();
            finish();
        },
        onmousedown: (e: MouseEvent) => {
            if (e.target === textarea || (e.target as Element).closest('.markdown-editor-block, .markdown-editor-active')) {
                return;
            }

            press(e, null);
        },
        onpointercancel: () => {
            gestures.end();
            finish();
        },
        onpointerdown: (e: PointerEvent) => {
            pointerId = e.pointerId;
            gestures.onpointerdown(e);
        },
        onpointermove: (e: PointerEvent) => {
            gestures.onpointermove(e);

            if (!drag) {
                return;
            }

            let offset = offsetAt(e.clientX, e.clientY);

            if (offset !== null && offset !== drag.head) {
                drag.head = offset;
                schedule();
            }
        },
        onpointerup: () => {
            pinned = false;
            pointerId = -1;
            gestures.end();
            finish();
        },
        onscroll: () => {
            metrics.scrollLeft = surface!.scrollLeft;
            metrics.scrollTop = surface!.scrollTop;
            schedule();
        },
        tabindex: () => ui.editing ? -1 : 0
    };

    let template = (attributes?: Attributes) => html`
        <div
            class='markdown-editor'
            ${attributes}
            ${{
                class: [
                    () => ime.state.composing && 'markdown-editor--composing',
                    () => gestures.state.crosshair && 'markdown-editor--crosshair',
                    () => ui.minimap && 'markdown-editor--minimap',
                    () => !ui.wrap && 'markdown-editor--nowrap',
                    () => ui.readonly && 'markdown-editor--readonly'
                ],
                onconnect: (element: HTMLElement) => {
                    host = element;
                    connect();
                },
                ondisconnect: () => controller.dispose(),
                onfocusout: (e: FocusEvent) => {
                    let next = e.relatedTarget as Node | null;

                    if (!next || !host?.contains(next)) {
                        capture();
                        deactivate();
                    }
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
                    <div aria-hidden='true' class='markdown-editor-spacer' ${{ style: () => `height: ${ui.top}px;` }}></div>
                    ${html.reactive(listed.before, draw.template)}
                    <div aria-hidden='true' class='markdown-editor-spacer' ${{ style: () => `height: ${ui.between}px;` }}></div>
                    <div class='markdown-editor-active' ${{ class: () => ui.editing && '--active' }}>
                        <button
                            aria-label='Fold block'
                            class='markdown-editor-fold'
                            tabindex='-1'
                            type='button'
                            ${{
                                class: () => !ui.foldable && 'markdown-editor-fold--none',
                                onclick: () => {
                                    if (active) {
                                        controller.fold(model.lineAt(blocks[active.first].from) + 1);
                                    }
                                },
                                onmousedown: prevent
                            }}
                        >
                            ${icon({ 'aria-hidden': 'true', class: 'markdown-editor-fold-icon' }, chevron)}
                        </button>
                        <textarea
                            autocapitalize='off'
                            autocomplete='off'
                            autocorrect='off'
                            dir='ltr'
                            ${field}
                            ${{
                                onconnect: (element: HTMLTextAreaElement) => {
                                    textarea = element;
                                    connect();
                                }
                            }}
                        ></textarea>
                    </div>
                    <div aria-hidden='true' class='markdown-editor-spacer' ${{ style: () => `height: ${ui.next}px;` }}></div>
                    ${html.reactive(listed.after, draw.template)}
                    <div aria-hidden='true' class='markdown-editor-spacer' ${{ style: () => `height: ${ui.bottom}px;` }}></div>
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
        </div>
    `;

    return { controller, template };
};


export { view };
export type { MarkdownController, MarkdownOptions };
