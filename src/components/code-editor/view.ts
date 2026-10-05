import { flush, reactive } from '@esportsplus/reactivity';
import { html, type Attributes } from '@esportsplus/template';
import { clamp } from '~/shared/clamp';
import { mac } from '~/shared/platform';
import { observeSize } from '~/shared/resize';
import { copied, read, write } from './clipboard';
import {
    addNextOccurrence,
    bracket,
    closeIndent,
    deleteCharacter,
    deletePair,
    indent,
    insertText,
    lineCommand,
    newline,
    toggleComment,
    type LineCommand
} from './commands';
import { composition } from './composition';
import { EditorDocument, type Change, type Edit, type Selection, type Snapshot } from './document';
import { RANGES, write as writeField, type Pending } from './field';
import { find } from './find';
import { enclosingFold, foldAt, mapFolds, outerFolds, pairAt, structureOf, type FoldRange } from './folding';
import { goto } from './goto';
import { gutter } from './gutter';
import { commands, keymap } from './keymap';
import { EditorLayout, irregular, type Rect } from './layout';
import { minimap, type Source } from './minimap';
import { move } from './navigation';
import { pointer } from './pointer';
import { inputEdit, NativeText, type Before, type Placeholder } from './projection';
import { markup, marks, pool, rowOffset, rowRect, tokens, type Fold, type Paint, type Slot } from './rows';
import { search as scan, type Match, type SearchOptions, type SearchResult } from './search';
import { services, type LanguageServiceOptions } from './services';
import { commentSyntax, languageFor, syntaxCache, type Language, type SyntaxCache, type Token } from './syntax';


type Callbacks = {
    onChange?: (value: string, change: Change, state: Snapshot) => void;
    // Doesn't mark the document saved; call document.markSaved() once persistence succeeds.
    onSave?: (value: string, state: Snapshot) => void;
    onSelection?: (selection: Selection, position: { column: number; line: number }) => void;
};

type Controller = {
    readonly document: EditorDocument;
    // The editor's root element; set once the editor connects, like 'scroller' and 'textarea'.
    readonly host: HTMLElement;
    // The element that scrolls the text.
    readonly scroller: HTMLElement;
    // A reactive snapshot for toolbars and status bars; read-only.
    readonly state: Snapshot;
    // Set once the editor connects; the 'controller' callback runs after that.
    readonly textarea: HTMLTextAreaElement;
    addNextOccurrence(all?: boolean): boolean;
    closeFind(): void;
    dispose(): void;
    find(query?: string, options?: SearchOptions): SearchResult;
    findNext(): Match | null;
    findPrevious(): Match | null;
    focus(): void;
    // Folds the block starting on 'line'; without one, the block starting on the caret's line, or else the
    // innermost block around the caret.
    fold(line?: number): boolean;
    foldAll(): void;
    goToLine(line: number, column?: number): void;
    indent(): boolean;
    insert(text: string): boolean;
    lineCommand(command: LineCommand): boolean;
    newline(): boolean;
    offsetAt(clientX: number, clientY: number): number | null;
    openFind(replace?: boolean): void;
    openGoToLine(): void;
    outdent(): boolean;
    rectAt(offset: number): Rect | null;
    redo(): boolean;
    redoSelection(): boolean;
    refresh(): void;
    replace(replacement: string): boolean;
    replaceAll(replacement: string): boolean;
    save(): void;
    select(selection: Partial<Selection>, reveal?: boolean): void;
    selectMany(selections: readonly Partial<Selection>[], reveal?: boolean): void;
    // Shows another document in place, back at the scroll and folds it had here; 'options' replace the current ones
    // in the same step, so the language and services follow the new file.
    setDocument(document: EditorDocument, options?: Options): void;
    setOptions(options: Options, replace?: boolean): void;
    setValue(value: string): boolean;
    toggleComment(): boolean;
    undo(): boolean;
    undoSelection(): boolean;
    unfold(line?: number): boolean;
    unfoldAll(): void;
};

type Decoration = { kind: string; style: string };

type Memo = Position & { folded: FoldRange[]; revision: number };

type Metrics = {
    charWidth: number;
    clientWidth: number;
    lineHeight: number;
    minimap: number;
    padLeft: number;
    padRight: number;
    padTop: number;
    // The field's content width, unrounded: wrapping happens at fractions of a pixel.
    width: number;
};

type Options = {
    autoBrackets?: boolean;
    autoIndent?: boolean;
    blockComment?: readonly [string, string];
    // Tab inserts indentation by default; Escape then Tab always moves focus.
    captureTab?: boolean;
    fileName?: string;
    fold?: boolean;
    highlight?: boolean;
    indent?: string;
    label?: string;
    language?: Language;
    lineComment?: string | false;
    lineNumbers?: boolean;
    minimap?: boolean;
    name?: string;
    // Ctrl/Cmd+Space requests completion; text changes stay observable through onChange.
    onAutocomplete?: (controller: Controller, explicit: boolean) => void;
    // Services may claim keys before the built-in keymap; return true when consumed.
    onCompletionKey?: (event: KeyboardEvent, controller: Controller) => boolean;
    placeholder?: string;
    readonly?: boolean;
    // Completion, hover and diagnostics from a language server; '{}' alone completes from the document's words.
    services?: LanguageServiceOptions;
    tabSize?: number;
    whitespace?: boolean;
    wrap?: boolean;
};

type Position = { left: number; top: number };


const NAVIGATION = /^(ArrowDown|ArrowLeft|ArrowRight|ArrowUp|End|Home|PageDown|PageUp)$/;

// Occurrences of the selected text are only looked for in selections this short.
const OCCURRENCE_LIMIT = 10000;

// Rows rendered above and below the viewport.
const OVERSCAN = 4;

const TOKEN_COLORS = [
    'color',
    'comment',
    'function',
    'keyword',
    'number',
    'operator',
    'property',
    'regexp',
    'selector',
    'string',
    'tag',
    'type',
    'variable'
] as const;


let uid = 0;


function pixels(value: string) {
    return parseFloat(value) || 0;
}


// The editor's view of one document: a transparent native textarea owns input, selection, IME and scrolling, while
// pooled rows draw the visible lines from the incremental layout. Returns its template and controller.
const view = (model: EditorDocument, callbacks: Callbacks, receive?: (controller: Controller) => void) => {
    let accepting = -1,
        apple = mac(),
        before: Before | null = null,
        beforeRanges: readonly Selection[] = [],
        beforeSelection: Selection | undefined,
        breaks = { key: '', map: new Map<string, readonly number[]>() },
        cache: SyntaxCache = syntaxCache(model, 'plain'),
        decorations = reactive([] as Decoration[]),
        disposed = false,
        drop: number | null = null,
        escapeTab = false,
        folded: FoldRange[] = [],
        foldedLines = new Map<number, FoldRange>(),
        foldMarks = new Map<number, Fold>(),
        foldRevision = -1,
        frame = 0,
        goals: number[] = [],
        help = `code-editor-help-${++uid}`,
        host: HTMLElement | undefined,
        inputData: string | null = null,
        inputType = '',
        keys = keymap(apple),
        language: Language = 'plain',
        layout: EditorLayout | null = null,
        lines: HTMLElement | undefined,
        metrics: Metrics = { charWidth: 7.8, clientWidth: 0, lineHeight: 20, minimap: 0, padLeft: 12, padRight: 12, padTop: 12, width: 0 },
        occurrences: { key: string; marks: readonly { from: number; to: number }[] } = { key: '', marks: [] },
        options: Options = {},
        palette: Record<string, string> = {},
        pending: Pending | null = null,
        pendingValue: string | undefined,
        projection = new NativeText(model.value),
        rows = pool(),
        ruler: HTMLElement | undefined,
        state = reactive({
            ...model.state,
            selection: { ...model.selection },
            selections: model.selections.map((range) => ({ ...range }))
        }),
        textarea: HTMLTextAreaElement | undefined,
        ui = reactive({
            digits: Math.max(3, String(model.lineCount).length),
            fold: true,
            highlight: true,
            label: 'Code editor',
            lineNumbers: true,
            minimap: false,
            name: '',
            placeholder: '',
            readonly: false,
            tabSize: 4,
            whitespace: false,
            width: 0,
            wrap: false,
            x: 12,
            y: 12
        }),
        unsubscribe: VoidFunction | undefined,
        // Where each document this editor showed was left.
        visited = new WeakMap<EditorDocument, Memo>(),
        writing = false,
        written = '';

    let ime = composition({
        begin: () => {
            capture();
            reveal(true);
            beforeRanges = model.selections;
            beforeSelection = model.selection;
            model.breakHistory();
        },
        commit: (conflict) => {
            if (conflict) {
                reset();
                written = '';
                sync();
            }
            else {
                accept('composition', true);
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
            drop = offset;
            schedule();
        },
        focus: () => textarea?.focus(),
        insert: (text) => controller.insert(text),
        offsetAt,
        placeholder: placeholderAt,
        readonly: () => !!options.readonly,
        rows: rowsBetween,
        select: (ranges, revealing = false) => {
            model.selectMany(ranges);
            sync(revealing);
        },
        transact: (edits, caret) => {
            model.transact(edits, { selection: { start: caret }, source: 'drop' });
            sync(true);
        },
        unfold: (placeholder) => {
            unfold(folded.filter((fold) => fold.from !== placeholder.from));
        }
    });

    let jump = goto({
        focus: () => textarea?.focus(),
        go: (line, column) => controller.goToLine(line, column)
    });

    let map = minimap({
        focus: () => textarea?.focus(),
        scroll: (top, relative) => {
            if (!textarea) {
                return;
            }

            textarea.scrollTop = relative ? textarea.scrollTop + top : top;
            schedule();
        }
    });

    let search = find({
        get document() {
            return model;
        },
        edit: editable,
        focus: () => textarea?.focus(),
        readonly: () => !!options.readonly,
        reveal: (match) => {
            model.select({ end: match.to, start: match.from });
            sync(true);
        },
        selection: () => {
            capture();
            return model.selection;
        },
        update: schedule
    });

    let size = observeSize(() => measure());

    let source: Source = {
        breaks: (index) => layout!.breaksOf(index),
        get count() {
            return layout!.count;
        },
        get height() {
            return layout!.height;
        },
        indexAt: (y) => layout!.indexAt(y),
        get lineHeight() {
            return metrics.lineHeight;
        },
        rows: (index) => layout!.rows(index),
        get tabSize() {
            return options.tabSize ?? 4;
        },
        text: (index) => projection.value.slice(layout!.lineFrom(index), layout!.end(index)),
        tokens: tokensOf,
        top: (index) => layout!.top(index)
    };

    // Applies a native input to the document. 'beforeinput' recorded the field's selection and length, so most inputs
    // resolve without reading the field's value; the rest diff it.
    function accept(group?: string, composed = false) {
        if (disposed || !textarea) {
            return;
        }

        if (options.readonly) {
            reset();
            written = '';
            sync();
            return;
        }

        let after = { end: textarea.selectionEnd, length: textarea.textLength, start: textarea.selectionStart },
            direction = textarea.selectionDirection,
            native = before && !composed ? inputEdit(before, after, inputType, inputData) : null,
            ranges = beforeRanges.length ? beforeRanges : model.selections,
            edit: Edit,
            value: string | undefined;

        if (native) {
            edit = projection.toSourceEdit(model.value, native.from, native.to, native.insert);
        }
        else {
            value = textarea.value;

            if (
                composed &&
                value === projection.value &&
                beforeSelection &&
                beforeSelection.start < beforeSelection.end &&
                beforeRanges.length > 1 &&
                after.start === after.end &&
                after.start === projection.toNative(beforeSelection.end)
            ) {
                let text = model.value.slice(beforeSelection.start, beforeSelection.end);

                reset();
                insertText(model, text, 'composition');
                sync();
                return;
            }

            if (value === projection.value) {
                reset();
                capture();
                return;
            }

            edit = projection.edit(model.value, value, beforeSelection, inputType);
        }

        let source = composed ? 'composition' : 'input';

        // A native edit across a placeholder would remove hidden text; the field goes back to the document.
        if (edit.from === edit.to && !edit.insert) {
            reset();
            written = '';
            sync();
            return;
        }

        if (ranges.length > 1) {
            let primary = ranges[0],
                left = edit.from - primary.start,
                right = edit.to - primary.end,
                edits = ranges.map((range) => ({
                    from: Math.max(0, range.start + left),
                    insert: edit.insert,
                    to: Math.min(model.value.length, range.end + right)
                })),
                sorted = [...edits].sort((a, b) => a.from - b.from),
                carets = edits.map((item) => {
                    let shift = 0;

                    for (let i = 0, n = sorted.length; i < n && sorted[i].from < item.from; i++) {
                        shift += sorted[i].insert.length - (sorted[i].to - sorted[i].from);
                    }

                    return { start: item.from + shift + item.insert.length };
                });

            written = value ?? textarea.value;
            reset();

            if (!model.transact(edits, { selections: carets, source }).accepted) {
                sync();
            }

            return;
        }

        let caret = native
            ? { direction, end: edit.from + edit.insert.length, start: edit.from + edit.insert.length }
            : selectionAfter(edit, after, direction);

        // The field already shows this edit: the next projection must come out the same length for it to stay.
        if (native) {
            accepting = projection.value.length - (native.to - native.from) + native.insert.length;
            written = projection.value;
        }
        else {
            written = value!;
        }

        reset();
        model.replace(edit.from, edit.to, edit.insert, { group: composed ? undefined : group, selection: caret, source });
        accepting = -1;
    }

    // Native lines in [first, last) holding a caret.
    function activeLines(first: number, last: number) {
        let geometry = layout!,
            lines = new Set<number>(),
            ranges = model.selections;

        for (let i = 0, n = ranges.length; i < n; i++) {
            let head = ranges[i].direction === 'backward' ? ranges[i].start : ranges[i].end,
                line = geometry.lineAt(projection.toNative(head));

            if (line >= first && line < last) {
                lines.add(line);
            }
        }

        return lines;
    }

    // Takes over from the previous document: whatever was derived from it goes, and this one's view comes back as
    // this editor left it, folds only while its text is unchanged since.
    function adopt() {
        let memo = visited.get(model),
            { selections, ...single } = model.state;

        reset();
        accepting = -1;
        cache = syntaxCache(model, language);
        drop = null;
        escapeTab = false;
        folded = memo?.revision === model.revision ? memo.folded : [];
        foldMarks.clear();
        foldRevision = -1;
        goals = [];
        occurrences = { key: '', marks: [] };
        pendingValue = undefined;
        written = '';
        state.selections.splice(0, state.selections.length, ...selections.map((range) => ({ ...range })));
        Object.assign(state, single, { selection: { ...single.selection } });
        ui.digits = Math.max(3, String(model.lineCount).length);
        gestures.reset();
        jump.state.open = false;

        if (unsubscribe) {
            subscribe();
        }

        // The gutter's width must apply before the field lays out its new text, or it lays out twice.
        flush();
        rebuild({ left: memo?.left ?? 0, top: memo?.top ?? 0 });
        search.result();
    }

    function capture() {
        if (disposed || !textarea || ime.busy() || written !== projection.value) {
            return;
        }

        let next: Selection = {
                direction: textarea.selectionDirection,
                end: projection.toSource(textarea.selectionEnd),
                start: projection.toSource(textarea.selectionStart)
            },
            primary = model.selection;

        // A field reports a direction even for a caret, and 'forward' where the document has none; taking it would
        // count as moving the caret and end the typing's undo step.
        if (
            next.start === primary.start &&
            next.end === primary.end &&
            (next.start === next.end || next.direction === primary.direction || primary.direction === 'none')
        ) {
            return;
        }

        model.selectMany([next, ...model.selections.slice(1)]);
    }

    function changeFold(line: number, close: boolean) {
        if (disposed || ime.busy() || options.fold === false) {
            return false;
        }

        if (!close) {
            let next = folded.filter((fold) => fold.line !== line);

            if (next.length === folded.length) {
                return false;
            }

            unfold(next);
            return true;
        }

        let range = foldAt(cache, line);

        if (!range || foldedLines.has(line)) {
            return false;
        }

        foldWith(range);

        return true;
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

    // Border box less the scrollbar (whole pixels either way, so the rounded sizes give it exactly) and padding.
    function contentWidth(next: Metrics) {
        let field = textarea!;

        return field.getBoundingClientRect().width - (field.offsetWidth - field.clientWidth) - next.padLeft - next.padRight;
    }

    function deleteVisible(backwards: boolean, word = false) {
        let affected = folded.filter((fold) =>
            model.selections.some((range) => range.start === range.end && range.start === (backwards ? fold.to : fold.from))
        );

        if (affected.length) {
            unfold(folded.filter((fold) => !affected.includes(fold)));
            return true;
        }

        return deleteCharacter(model, backwards, word);
    }

    function editable(run: () => boolean) {
        if (disposed || options.readonly || ime.busy()) {
            return false;
        }

        capture();
        reveal();

        let changed = run();

        sync(true);

        return changed;
    }

    // The rendered row of a native line, when it's in the pool.
    function element(line: number) {
        let size = rows.slots.length;

        if (!lines || !size || rows.slots[line % size]?.line !== line) {
            return null;
        }

        return (lines.children[line % size] as HTMLElement | undefined) ?? null;
    }

    function foldState(line: number): Fold {
        if (foldRevision !== model.revision) {
            foldMarks.clear();
            foldRevision = model.revision;
        }

        if (foldedLines.has(line)) {
            return 2;
        }

        let mark = foldMarks.get(line);

        if (mark === undefined) {
            foldMarks.set(line, mark = foldAt(cache, line) ? 1 : 0);
        }

        return mark;
    }

    function foldWith(range: FoldRange) {
        folded = outerFolds([...folded, range]);

        if (model.selections.some((selection) => selection.start > range.from && selection.start < range.to)) {
            model.select({ start: Math.max(0, range.from - 1) });
        }

        rebuild();
    }

    // Reads computed geometry and colors on connect, resize, font load or refresh; never per frame.
    function measure() {
        if (disposed || !textarea || !host || !ruler) {
            return;
        }

        let computed = getComputedStyle(textarea),
            style = getComputedStyle(host),
            fallback = style.getPropertyValue('--color').trim() || 'currentColor',
            colors: Record<string, string> = {},
            next: Metrics = {
                charWidth: ruler.getBoundingClientRect().width / (ruler.textContent?.length || 1) || 7.8,
                clientWidth: textarea.clientWidth,
                lineHeight: pixels(computed.lineHeight) || 20,
                minimap: pixels(style.getPropertyValue('--minimap-width')),
                padLeft: pixels(computed.paddingLeft),
                padRight: pixels(computed.paddingRight),
                padTop: pixels(computed.paddingTop),
                width: 0
            };

        next.width = contentWidth(next);

        for (let i = 0, n = TOKEN_COLORS.length; i < n; i++) {
            let kind = TOKEN_COLORS[i];

            colors[kind] = style.getPropertyValue(`--${kind === 'color' ? 'literal' : kind}-color`).trim() || fallback;
        }

        let changed = !layout ||
            next.charWidth !== metrics.charWidth ||
            next.clientWidth !== metrics.clientWidth ||
            next.lineHeight !== metrics.lineHeight ||
            next.padLeft !== metrics.padLeft ||
            next.padRight !== metrics.padRight ||
            next.width !== metrics.width;

        metrics = next;
        palette = colors;

        if (changed) {
            relayout();
        }

        schedule();
    }

    function moveSelection(key: string, extend: boolean, word = false, add = false, boundary = false) {
        if (!layout) {
            return;
        }

        if (!/^(ArrowDown|ArrowUp|PageDown|PageUp)$/.test(key) || boundary || add) {
            goals = [];
        }

        let lineHeight = metrics.lineHeight,
            ranges = move(model, layout, projection, lineHeight, {
                boundary,
                extend,
                goals,
                key,
                page: Math.max(lineHeight, (textarea?.clientHeight ?? 0) - lineHeight),
                word
            });

        model.selectMany(add ? [...model.selections, ...ranges] : ranges, 'navigation');
        sync(true);
    }

    function offsetAt(clientX: number, clientY: number) {
        if (disposed || !textarea || !layout) {
            return null;
        }

        let box = textarea.getBoundingClientRect(),
            x = clientX - box.left - metrics.padLeft + textarea.scrollLeft,
            y = clientY - box.top - metrics.padTop + textarea.scrollTop,
            index = layout.indexAt(y),
            row = element(index);

        if (row && irregular(projection.value.slice(layout.lineFrom(index), layout.end(index)))) {
            let local = rowOffset(row, clientX, clientY);

            if (local !== null) {
                return projection.toSource(layout.lineFrom(index) + local);
            }
        }

        return projection.toSource(layout.offset(x, y));
    }

    function paint() {
        frame = 0;

        if (disposed || !textarea || !layout) {
            return;
        }

        let clientHeight = textarea.clientHeight,
            clientWidth = textarea.clientWidth,
            scrollLeft = textarea.scrollLeft,
            scrollTop = textarea.scrollTop;

        if (clientWidth !== metrics.clientWidth) {
            metrics.clientWidth = clientWidth;
            metrics.width = contentWidth(metrics);
            relayout();
        }

        let geometry = layout!,
            lineHeight = metrics.lineHeight,
            first = geometry.indexAt(Math.max(0, scrollTop - metrics.padTop - OVERSCAN * lineHeight)),
            size = Math.ceil(clientHeight / lineHeight) + OVERSCAN * 2 + 1,
            last = Math.min(geometry.count, first + size),
            active = activeLines(first, last),
            context = prepare(first, last),
            slots = rows.slots,
            whitespace = !!options.whitespace;

        rows.resize(size);

        for (let line = first; line < last; line++) {
            let from = geometry.lineFrom(line),
                number = geometry.number(line),
                slot = slots[line % size] as Slot,
                to = geometry.end(line),
                text = projection.value.slice(from, to);

            slot.active = active.has(line);
            slot.fold = ui.fold ? foldState(number) : 0;
            slot.height = geometry.rows(line) * lineHeight;
            slot.html = markup(text, tokensOf(line), marks(projection, from, to, context), whitespace);
            slot.line = line;
            slot.number = number;
            slot.top = geometry.top(line);
        }

        for (let line = last; line < first + size; line++) {
            let slot = slots[line % size] as Slot;

            slot.active = false;
            slot.html = '';
            slot.line = -1;
        }

        ui.x = metrics.padLeft - scrollLeft;
        ui.y = metrics.padTop - scrollTop;
        paintDecorations(scrollTop, clientHeight);
        lsp.paint();

        if (options.minimap) {
            map.paint(
                source,
                { clientHeight, scrollHeight: Math.max(textarea.scrollHeight, geometry.height + 2 * metrics.padTop), scrollTop },
                palette,
                metrics.minimap
            );
        }

        if (geometry.wrap) {
            settle(first, last);
        }
    }

    function paintDecorations(scrollTop: number, clientHeight: number) {
        let geometry = layout!,
            items: Decoration[] = [],
            lineHeight = metrics.lineHeight,
            ranges = model.selections,
            top = scrollTop - metrics.padTop,
            bottom = top + clientHeight;

        for (let i = 1, n = ranges.length; i < n && items.length < 1000; i++) {
            let range = ranges[i],
                end = geometry.rect(projection.toNative(range.end)),
                start = geometry.rect(projection.toNative(range.start));

            if (end.top + lineHeight < top || start.top > bottom) {
                continue;
            }

            for (let y = Math.max(start.top, top - ((top - start.top) % lineHeight)); range.start !== range.end && y <= Math.min(end.top, bottom) && items.length < 1000; y += lineHeight) {
                let left = y === start.top ? start.left : 0,
                    right = y === end.top ? end.left : geometry.width;

                items.push({
                    kind: 'code-editor-decoration code-editor-decoration--selection',
                    style: `height: ${lineHeight}px; left: ${left}px; top: ${y}px; width: ${Math.max(1, right - left)}px;`
                });
            }

            let caret = range.direction === 'backward' ? start : end;

            items.push({
                kind: 'code-editor-decoration code-editor-decoration--caret',
                style: `height: ${lineHeight}px; left: ${caret.left}px; top: ${caret.top}px;`
            });
        }

        if (drop !== null) {
            let caret = geometry.rect(projection.toNative(drop));

            items.push({
                kind: 'code-editor-decoration code-editor-decoration--drop',
                style: `height: ${lineHeight}px; left: ${caret.left}px; top: ${caret.top}px;`
            });
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

    function placeholderAt(clientX: number, clientY: number): Placeholder | null {
        if (!folded.length || !textarea || !layout) {
            return null;
        }

        let box = textarea.getBoundingClientRect(),
            placeholders = projection.placeholders(),
            x = clientX - box.left - metrics.padLeft + textarea.scrollLeft,
            y = clientY - box.top - metrics.padTop + textarea.scrollTop;

        for (let i = 0, n = placeholders.length; i < n; i++) {
            let end = layout.rect(placeholders[i].at + 1),
                start = layout.rect(placeholders[i].at),
                right = end.top === start.top ? end.left : start.left + metrics.charWidth;

            if (y >= start.top && y < start.top + start.height && x >= start.left && x < right) {
                return placeholders[i];
            }
        }

        return null;
    }

    function prepare(first: number, last: number): Paint {
        let geometry = layout!,
            from = geometry.lineFrom(first),
            selection = model.selection,
            to = last > first ? geometry.end(last - 1) : from,
            selected = selection.end - selection.start <= OCCURRENCE_LIMIT ? model.value.slice(selection.start, selection.end) : '',
            key = selected && !/[\r\n]/.test(selected) ? `${model.revision}\u0000${from}\u0000${to}\u0000${selected}` : '';

        if (key !== occurrences.key) {
            let found = key ? scan(projection.value.slice(from, to), selected, {}, '', 2000).matches : [],
                list: { from: number; to: number }[] = [];

            for (let i = 0, n = found.length; i < n; i++) {
                list.push({ from: found[i].from + from, to: found[i].to + from });
            }

            occurrences = { key, marks: list };
        }

        let { index, matches } = search.matches(projection.toSource(from));

        return {
            active: search.state.index,
            diagnostics: lsp.marks(projection.toSource(from), projection.toSource(to)),
            index,
            matches,
            occurrences: occurrences.marks,
            pair: pairAt(cache, selection.direction === 'backward' ? selection.start : selection.end),
            placeholders: folded.length ? projection.placeholders() : []
        };
    }

    function rebuild(position?: Position) {
        foldedLines = new Map(folded.map((fold) => [fold.line, fold]));
        pending = null;
        projection = new NativeText(model.value, folded);
        relayout();
        sync(false, position);
    }

    function relayout() {
        if (!textarea) {
            return;
        }

        let key = `${metrics.width}:${metrics.charWidth}:${options.tabSize}`,
            tabSize = options.tabSize ?? 4;

        if (key !== breaks.key) {
            breaks = { key, map: new Map() };
        }

        ui.width = Math.max(1, metrics.width);
        layout = new EditorLayout(projection, model, ui.width, metrics.lineHeight, metrics.charWidth, tabSize, !!options.wrap, breaks.map);
        map.invalidate();
        schedule();
    }

    function reset() {
        before = null;
        beforeRanges = [];
        beforeSelection = undefined;
        inputData = null;
        inputType = '';
    }

    // Unfolds whatever hides a selection edge, or with 'editing', whatever an edit of the selection would touch.
    function reveal(editing = false) {
        let next = folded.filter((fold) => !model.selections.some((range) =>
            (range.start > fold.from && range.start < fold.to) ||
            (range.end > fold.from && range.end < fold.to) ||
            (editing && range.start < fold.to && range.end > fold.from)
        ));

        if (next.length !== folded.length) {
            unfold(next);
        }
    }

    function revealSelection() {
        if (!textarea || !layout) {
            return;
        }

        let selection = model.selection,
            offset = selection.direction === 'backward' ? selection.start : selection.end;

        if (folded.some((fold) => offset > fold.from && offset < fold.to)) {
            unfold(folded.filter((fold) => offset <= fold.from || offset >= fold.to));
        }

        let { lineHeight, padLeft, padTop } = metrics,
            rect = layout!.rect(projection.toNative(offset)),
            top = rect.top + padTop;

        if (top < textarea.scrollTop) {
            textarea.scrollTop = Math.max(0, top - padTop);
        }
        else if (top + lineHeight > textarea.scrollTop + textarea.clientHeight) {
            textarea.scrollTop = Math.max(0, top + lineHeight + padTop - textarea.clientHeight);
        }

        if (!options.wrap) {
            let x = rect.left + padLeft;

            if (x < textarea.scrollLeft + padLeft) {
                textarea.scrollLeft = Math.max(0, x - padLeft);
            }
            else if (x + padLeft > textarea.scrollLeft + textarea.clientWidth) {
                textarea.scrollLeft = x + padLeft - textarea.clientWidth;
            }
        }

        schedule();
    }

    function rowsBetween(from: number, to: number) {
        let out: number[] = [];

        if (!textarea) {
            return out;
        }

        let lineHeight = metrics.lineHeight,
            origin = textarea.getBoundingClientRect().top + metrics.padTop - textarea.scrollTop,
            a = Math.floor((from - origin) / lineHeight),
            b = Math.floor((to - origin) / lineHeight);

        for (let row = Math.max(0, Math.min(a, b)), n = Math.max(a, b); row <= n; row++) {
            out.push(origin + row * lineHeight + lineHeight / 2);
        }

        return out;
    }

    function schedule() {
        if (!disposed && !frame && textarea) {
            frame = requestAnimationFrame(paint);
        }
    }

    function selectionAfter(edit: Edit, after: Before, direction: Selection['direction']) {
        let value = model.value.slice(0, edit.from) + edit.insert + model.value.slice(edit.to),
            next = new NativeText(value, mapFolds(folded, [[edit]], value));

        return { direction, end: next.toSource(after.end), start: next.toSource(after.start) };
    }

    // Wrapped lines the arithmetic could only estimate take the rows the DOM drew for them.
    function settle(first: number, last: number) {
        let geometry = layout!,
            changed = false,
            flushed = false,
            half = metrics.lineHeight / 2;

        for (let line = first; line < last; line++) {
            if (!geometry.estimated(line)) {
                continue;
            }

            let row = element(line);

            if (!row) {
                continue;
            }

            if (!flushed) {
                flush();
                flushed = true;
            }

            let breaks: number[] = [],
                length = geometry.end(line) - geometry.lineFrom(line),
                y = rowRect(row, 0)?.top ?? 0;

            for (let offset = 1; offset <= length; offset++) {
                let rect = rowRect(row, offset);

                if (rect && rect.top > y + half) {
                    breaks.push(offset);
                    y = rect.top;
                }
            }

            changed = geometry.measure(line, breaks) || changed;
        }

        if (changed) {
            schedule();
        }
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
                reveal();
            }

            sync();

            if (change.selectionChanged) {
                callbacks.onSelection?.(snapshot.selection, model.position());
            }

            if (change.textChanged) {
                callbacks.onChange?.(snapshot.value, change, snapshot);
            }
        });
    }

    // Writes the projection and the primary selection to the field. Edits it doesn't show yet go in through
    // 'insertText', which Chrome lays out incrementally; assigning the value lays out all of it again. A 'position'
    // replaces the scroll position; otherwise reading it would lay out the text the field is about to drop.
    function sync(revealing = false, position?: Position) {
        if (disposed || !textarea || ime.busy()) {
            return;
        }

        let changed = !!position,
            { left, top } = position ?? { left: textarea.scrollLeft, top: textarea.scrollTop };

        if (written !== projection.value) {
            update();
            changed = true;
        }
        else {
            // Equal text read back from the field compares by content; one shared string compares by reference.
            written = projection.value;
        }

        let { direction, end, start } = model.selection,
            nativeEnd = projection.toNative(end),
            nativeStart = projection.toNative(start);

        if (textarea.selectionStart !== nativeStart || textarea.selectionEnd !== nativeEnd || textarea.selectionDirection !== direction) {
            textarea.setSelectionRange(nativeStart, nativeEnd, direction);
            changed = true;
        }

        // Writing even the current scroll position cancels the browser's pending caret reveal after native input, so
        // it's restored only when this sync changed the field.
        if (changed) {
            textarea.scrollLeft = left;
            textarea.scrollTop = top;
        }

        if (revealing) {
            revealSelection();
        }

        schedule();
    }

    function textChanged(change: Change) {
        let batches = change.editBatches,
            batch = batches && batches.length === 1 ? batches[0] : null,
            edit = batch && batch.length === 1 ? batch[0] : null,
            next = batches && folded.length ? mapFolds(folded, batches, model) : [],
            kept = next.length === folded.length,
            previous = projection,
            incremental = edit && kept ? previous.apply(model.value, edit) : null;

        folded = next;

        if (!kept) {
            foldedLines = new Map(folded.map((fold) => [fold.line, fold]));
        }

        projection = incremental ?? new NativeText(model.value, folded);
        pending = null;

        if (incremental && edit && layout) {
            let from = previous.toNative(edit.from),
                to = previous.toNative(edit.to),
                end = to + projection.value.length - previous.value.length,
                { first, inserted, removed } = layout.edit(projection, from, to, end);

            map.invalidate(inserted === removed ? first : null, first + inserted);
            pending = { base: previous.value, edits: [{ from, insert: projection.value.slice(from, end), to }] };
        }
        else if (batch && kept && layout && previous.identity && projection.identity && batch.length <= RANGES) {
            // Native text is the source here, so each edit lands in the layout as is, shifted by the ones before it.
            let count = layout.count,
                first = Number.MAX_SAFE_INTEGER,
                last = 0,
                shift = 0;

            for (let i = 0, n = batch.length; i < n; i++) {
                let { from, insert, to } = batch[i],
                    step = layout.edit(projection, from + shift, to + shift, from + shift + insert.length);

                first = Math.min(first, step.first);
                last = Math.max(last, step.first + step.inserted);
                shift += insert.length - (to - from);
            }

            map.invalidate(layout.count === count ? first : null, last);
            pending = { base: previous.value, edits: batch.map(({ from, insert, to }) => ({ from, insert, to })) };
        }
        else {
            relayout();
        }

        // The field shows a native input already; it stays when the projection came out as it predicted.
        if (accepting >= 0 && written === previous.value) {
            pending = null;
            written = projection.value.length === accepting ? projection.value : '';
        }

        ui.digits = Math.max(3, String(model.lineCount).length);
    }

    function tokensOf(index: number): readonly Token[] {
        if (language === 'plain' || !ui.highlight) {
            return [];
        }

        return tokens(cache, model, projection, folded, index, layout!.lineFrom(index), layout!.end(index));
    }

    function unfold(next: FoldRange[]) {
        folded = next;
        rebuild();
    }

    // Brings the field's text up to the projection.
    function update() {
        writing = true;

        try {
            writeField(textarea!, written, projection.value, pending);
        }
        finally {
            pending = null;
            writing = false;
        }

        written = projection.value;
    }

    let controller: Controller = {
        addNextOccurrence: (all = false) => {
            if (disposed || ime.busy()) {
                return false;
            }

            capture();

            let changed = addNextOccurrence(model, all);

            sync(true);

            return changed;
        },
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
                size.ondisconnect();
                lsp.dispose();
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
                textarea?.focus();
            }
        },
        fold: (line) => {
            if (line !== undefined) {
                return changeFold(line, true);
            }

            let current = model.position().line;

            if (changeFold(current, true)) {
                return true;
            }

            if (disposed || ime.busy() || options.fold === false) {
                return false;
            }

            let range = enclosingFold(cache, current);

            if (!range || folded.some((fold) => fold.from === range.from && fold.to === range.to)) {
                return false;
            }

            foldWith(range);

            return true;
        },
        foldAll: () => {
            if (disposed || ime.busy() || options.fold === false) {
                return;
            }

            folded = outerFolds(structureOf(cache).folds);
            model.select({ start: 0 });
            rebuild();
        },
        goToLine: (line, column = 1) => {
            if (disposed || ime.busy()) {
                return;
            }

            model.select({ start: model.offset(line, column) });
            sync(true);
            textarea?.focus();
        },
        get host() {
            return host!;
        },
        indent: () => editable(() => indent(model, options.indent)),
        insert: (text) => editable(() => insertText(model, text)),
        lineCommand: (command) => editable(() => lineCommand(model, command)),
        newline: () => editable(() => newline(model, options.indent, language)),
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
            if (disposed || !textarea || !layout || offset < 0 || offset > model.value.length || folded.some((fold) => offset > fold.from && offset < fold.to)) {
                return null;
            }

            let native = projection.toNative(offset),
                index = layout.lineAt(native),
                row = element(index);

            if (row && irregular(projection.value.slice(layout.lineFrom(index), layout.end(index)))) {
                let rect = rowRect(row, native - layout.lineFrom(index));

                if (rect) {
                    return { height: metrics.lineHeight, left: rect.left, top: rect.top, width: 1 };
                }
            }

            let box = textarea.getBoundingClientRect(),
                rect = layout.rect(native);

            return {
                height: rect.height,
                left: box.left + metrics.padLeft + rect.left - textarea.scrollLeft,
                top: box.top + metrics.padTop + rect.top - textarea.scrollTop,
                width: rect.width
            };
        },
        redo: () => editable(() => model.redo()),
        redoSelection: () => {
            if (disposed || ime.busy()) {
                return false;
            }

            let changed = model.redoSelection();

            sync(true);

            return changed;
        },
        refresh: () => {
            if (disposed) {
                return;
            }

            measure();
            relayout();
        },
        replace: (replacement) => search.replace(replacement),
        replaceAll: (replacement) => search.replaceAll(replacement),
        save: () => {
            if (!disposed && !ime.busy()) {
                callbacks.onSave?.(model.value, model.state);
            }
        },
        select: (next, revealing = true) => {
            if (disposed || ime.busy()) {
                return;
            }

            model.select(next);
            sync(revealing);
        },
        selectMany: (ranges, revealing = true) => {
            if (disposed || ime.busy()) {
                return;
            }

            model.selectMany(ranges);
            sync(revealing);
        },
        setDocument: (next, settings) => {
            if (disposed) {
                return;
            }

            if (next !== model) {
                // A composition belongs to the document it started in.
                ime.flush();

                if (textarea) {
                    visited.set(model, { folded, left: textarea.scrollLeft, revision: model.revision, top: textarea.scrollTop });
                }

                model = next;
                lsp.retarget();
                adopt();
            }

            controller.setOptions(settings ?? {}, !!settings);
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

            let geometry = !!options.wrap !== ui.wrap || options.tabSize !== ui.tabSize,
                nextLanguage = options.language ?? languageFor(options.fileName);

            if (nextLanguage !== language) {
                cache = syntaxCache(model, nextLanguage);
                foldMarks.clear();
                language = nextLanguage;
                map.invalidate();
            }

            ui.fold = options.fold !== false;
            ui.highlight = options.highlight !== false;
            ui.label = options.label ?? 'Code editor';
            ui.lineNumbers = options.lineNumbers !== false;
            ui.minimap = !!options.minimap;
            ui.name = options.name ?? '';
            ui.placeholder = options.placeholder ?? '';
            ui.readonly = !!options.readonly;
            ui.tabSize = options.tabSize;
            ui.whitespace = !!options.whitespace;
            ui.wrap = !!options.wrap;
            search.status();
            lsp.configure(options);

            if (options.fold === false && folded.length) {
                unfold([]);
            }
            else if (geometry) {
                // The field's wrapping must apply before the layout reads its width.
                flush();
                relayout();
            }

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

            return model.setValue(value);
        },
        get scroller() {
            return textarea!;
        },
        get state() {
            return state as Snapshot;
        },
        get textarea() {
            return textarea!;
        },
        toggleComment: () => editable(() => {
            let syntax = commentSyntax(language);

            return toggleComment(model, options.lineComment ?? syntax.line, options.blockComment ?? syntax.block);
        }),
        undo: () => editable(() => model.undo()),
        undoSelection: () => {
            if (disposed || ime.busy()) {
                return false;
            }

            let changed = model.undoSelection();

            sync(true);

            return changed;
        },
        unfold: (line = model.position().line) => changeFold(line, false),
        unfoldAll: () => {
            if (disposed || ime.busy()) {
                return;
            }

            unfold([]);
        }
    };

    let run = commands({
        cache: () => cache,
        capture,
        controller,
        deleteVisible,
        get document() {
            return model;
        },
        edit: editable,
        language: () => language,
        move: moveSelection,
        options: () => options,
        select: (selection) => {
            model.select(selection);
            sync(true);
        }
    });

    let lsp = services({
        busy: ime.busy,
        controller,
        rect: (offset) => {
            if (!layout || folded.some((fold) => offset > fold.from && offset < fold.to)) {
                return null;
            }

            return layout.rect(projection.toNative(offset));
        },
        schedule
    });

    let field: Attributes = {
        'aria-describedby': help,
        'aria-label': () => ui.label,
        name: () => ui.name,
        onbeforeinput: (e: InputEvent) => {
            if (writing || ime.busy() || e.isComposing || !textarea) {
                return;
            }

            capture();
            reveal(!e.inputType.startsWith('history') && !options.readonly);

            if (e.cancelable && !options.readonly && e.inputType.startsWith('delete')) {
                let end = textarea.selectionEnd,
                    start = textarea.selectionStart,
                    affected = projection.placeholders().filter((range) =>
                        start === end
                            ? (e.inputType.endsWith('Backward') ? start === range.at + 1 : start === range.at)
                            : start <= range.at && end > range.at
                    );

                if (affected.length) {
                    e.preventDefault();
                    unfold(folded.filter((fold) => !affected.some((range) => range.from === fold.from)));
                    return;
                }
            }

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

            let character = e.data?.length === 1 ? e.data : '';

            if (model.selections.length > 1) {
                if (e.inputType === 'insertText' && e.data !== null) {
                    e.preventDefault();

                    if (
                        !character ||
                        !((options.autoIndent !== false && editable(() => closeIndent(model, character, language))) ||
                            (options.autoBrackets !== false && editable(() => bracket(model, character, language))))
                    ) {
                        editable(() => insertText(model, e.data!, 'input'));
                    }

                    return;
                }

                if (/^delete(?:Content|Word)(?:Backward|Forward)$/.test(e.inputType)) {
                    e.preventDefault();
                    editable(() => deleteVisible(e.inputType.endsWith('Backward'), e.inputType.startsWith('deleteWord')));
                    return;
                }
            }

            if (e.inputType === 'insertLineBreak' || e.inputType === 'insertParagraph') {
                if (options.autoIndent !== false) {
                    e.preventDefault();
                    controller.newline();
                }
            }
            else if (e.inputType === 'insertText' && character && options.autoBrackets !== false) {
                if (
                    editable(() => bracket(model, character, language)) ||
                    (options.autoIndent !== false && editable(() => closeIndent(model, character, language)))
                ) {
                    e.preventDefault();
                }
            }
            else if (e.inputType === 'deleteContentBackward' && options.autoBrackets !== false) {
                if (editable(() => deletePair(model))) {
                    e.preventDefault();
                }
            }
        },
        onblur: () => {
            capture();
            gestures.reset();
            lsp.dismiss();
        },
        oncompositionend: ime.attributes.oncompositionend,
        oncompositionstart: () => {
            lsp.dismiss();
            ime.attributes.oncompositionstart();
        },
        oncopy: (e: ClipboardEvent) => clip(e, false),
        oncut: (e: ClipboardEvent) => clip(e, true),
        ondragend: gestures.ondragend,
        ondragleave: gestures.ondragleave,
        ondragover: gestures.ondragover,
        ondragstart: gestures.ondragstart,
        ondrop: gestures.ondrop,
        onfocus: capture,
        oninput: (e: InputEvent) => {
            if (writing || ime.input(e)) {
                return;
            }

            if (e.inputType === 'historyUndo' || e.inputType === 'historyRedo') {
                e.inputType === 'historyUndo' ? controller.undo() : controller.redo();
                return;
            }

            accept(/^(deleteContentBackward|deleteContentForward|insertText)$/.test(e.inputType) ? e.inputType : undefined);
        },
        onkeydown: (e: KeyboardEvent) => {
            gestures.alt(e);

            if (ime.busy() || e.isComposing || e.keyCode === 229) {
                return;
            }

            if (lsp.keydown(e) || options.onCompletionKey?.(e, controller)) {
                e.preventDefault();
                return;
            }

            if (e.key === 'Escape') {
                escapeTab = true;

                if (model.selections.length > 1) {
                    e.preventDefault();
                    model.select(model.selection);
                    sync();
                }

                return;
            }

            if (e.key === 'Tab' && escapeTab) {
                escapeTab = false;
                return;
            }

            escapeTab = false;

            let command = keys(e);

            if (command) {
                e.preventDefault();
                run(command, e);
                return;
            }

            if (apple ? e.metaKey : e.ctrlKey) {
                if (!e.altKey && model.selections.length > 1 && NAVIGATION.test(e.key) && !e.key.startsWith('Page')) {
                    e.preventDefault();
                    moveSelection(e.key, e.shiftKey, e.ctrlKey, false, /^(End|Home)$/.test(e.key) || (apple && /^Arrow(Down|Up)$/.test(e.key)));
                }

                return;
            }

            if (e.key === 'Tab' && !e.altKey && options.captureTab !== false && !options.readonly) {
                e.preventDefault();
                e.shiftKey ? controller.outdent() : controller.indent();
            }
            else if (e.key === 'Enter' && !e.altKey && !options.readonly && options.autoIndent !== false) {
                e.preventDefault();
                controller.newline();
            }
            else if ((model.selections.length > 1 || e.key === 'Home') && NAVIGATION.test(e.key)) {
                e.preventDefault();
                moveSelection(e.key, e.shiftKey, e.altKey);
            }
            else if ((e.key === 'Backspace' || e.key === 'Delete') && model.selections.length > 1) {
                e.preventDefault();
                editable(() => deleteVisible(e.key === 'Backspace', e.altKey));
            }
        },
        onkeyup: (e: KeyboardEvent) => {
            gestures.alt(e);
            capture();
        },
        onlostpointercapture: gestures.onlostpointercapture,
        onpaste: (e: ClipboardEvent) => {
            if (ime.busy() || options.readonly || !e.clipboardData) {
                return;
            }

            e.preventDefault();

            let text = read(e.clipboardData, model.selections.length);

            editable(() => insertText(model, text, 'paste'));
        },
        onpointercancel: gestures.onpointercancel,
        onpointerdown: (e: PointerEvent) => {
            goals = [];
            gestures.onpointerdown(e);
        },
        onpointerleave: lsp.leave,
        onpointermove: (e: PointerEvent) => {
            gestures.onpointermove(e);
            lsp.pointer(e);
        },
        onpointerup: () => {
            gestures.end();
            capture();
        },
        onscroll: schedule,
        onselect: capture,
        onselectionchange: capture,
        placeholder: () => ui.placeholder,
        readOnly: () => ui.readonly,
        wrap: () => ui.wrap ? 'soft' : 'off'
    };

    let template = (attributes?: Attributes) => html`
        <div
            class='code-editor'
            ${attributes}
            ${{
                class: [
                    () => ime.state.composing && 'code-editor--composing',
                    () => gestures.state.crosshair && 'code-editor--crosshair',
                    () => !ui.fold && 'code-editor--foldless',
                    () => ui.minimap && 'code-editor--minimap',
                    () => !ui.lineNumbers && 'code-editor--numberless',
                    () => ui.wrap && 'code-editor--wrap'
                ],
                onconnect: (element: HTMLElement) => {
                    host = element;
                    measure();
                    subscribe();
                    written = '';
                    sync();
                    void element.ownerDocument.fonts?.ready.then(() => {
                        if (!disposed) {
                            measure();
                        }
                    });
                    receive?.(controller);
                },
                ondisconnect: () => controller.dispose(),
                style: () => `--content-width: ${ui.width}px; --digits: ${ui.digits}; --tab-size: ${ui.tabSize};`
            }}
        >
            ${search.template()}
            ${jump.template()}
            <div class='code-editor-surface' ${size}>
                <div aria-hidden='true' class='code-editor-overlay'>
                    <div
                        class='code-editor-lines'
                        ${{
                            onconnect: (element: HTMLElement) => {
                                lines = element;
                            },
                            style: () => `transform: translate(${ui.x}px, ${ui.y}px);`
                        }}
                    >
                        ${rows.template()}
                    </div>
                    <div class='code-editor-decorations' ${{ style: () => `transform: translate(${ui.x}px, ${ui.y}px);` }}>
                        ${html.reactive(decorations, (decoration) => html`
                            <div ${{ class: () => decoration.kind, style: () => decoration.style }}></div>
                        `)}
                        ${lsp.anchors()}
                    </div>
                </div>
                <div aria-hidden='true' class='code-editor-gutter'>
                    <div class='code-editor-numbers' ${{ style: () => `transform: translateY(${ui.y}px);` }}>
                        ${gutter(rows.slots, (slot) => {
                            if (slot.line < 0 || !slot.fold) {
                                return;
                            }

                            if (slot.fold === 2) {
                                controller.unfold(slot.number);
                            }
                            else {
                                controller.fold(slot.number);
                            }

                            controller.focus();
                        })}
                    </div>
                </div>
                ${map.template()}
                <textarea
                    autocapitalize='off'
                    autocomplete='off'
                    autocorrect='off'
                    class='code-editor-input --scrollbar'
                    dir='ltr'
                    spellcheck='false'
                    ${field}
                    ${lsp.aria}
                    ${{
                        onconnect: (element: HTMLTextAreaElement) => {
                            textarea = element;
                        }
                    }}
                ></textarea>
                <span
                    aria-hidden='true'
                    class='code-editor-ruler'
                    ${{
                        onconnect: (element: HTMLElement) => {
                            ruler = element;
                        }
                    }}
                >0000000000000000000000000000000000000000000000000000000000000000</span>
            </div>
            ${lsp.template()}
            <span class='code-editor-help' id='${help}'>Press Escape then Tab to move focus out of the editor.</span>
        </div>
    `;

    return { controller, template };
};


export { view };
export type { Callbacks, Controller, Options };
