import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import { effect, flush, reactive, ReactiveArray, read, signal, untrack, write, type Signal } from '@esportsplus/reactivity';
import faces from '~/components/button/faces';
import { check as checked, copy as copied, cross } from '~/components/button/icons';
import checkbox from '~/components/checkbox';
import clipboard from '~/components/clipboard/write';
import input from '~/components/input';
import selectMenu from '~/components/select/menu';
import tooltip from '~/components/tooltip';
import { mac } from '~/shared/platform';
import { active, check, clear, extent, kindAt, link, setKind, toggle, unformat } from './format';
import history, { type Entry, type Kind as Step } from './history';
import { parse, serialize, type Feature, type Group } from './markdown';
import { caret, empty, insert, length, list, nest, order, paste, remove, slice, sort, split, styleAt, text, type Block, type Doc, type Edit, type Kind, type Mark, type Pos, type Selection, type Span, type Tree } from './model';
import { capture, elements, restore, target, written } from './selection';
import status, { INLINE_EDIT_STATUS, type Status } from './status';
import { safe } from './utilities';
import boldSvg from '@esportsplus/ui/svg/bold.svg';
import checkSvg from '@esportsplus/ui/svg/check.svg';
import clearSvg from '@esportsplus/ui/svg/clear-format.svg';
import codeSvg from '@esportsplus/ui/svg/code.svg';
import highlightSvg from '@esportsplus/ui/svg/highlight.svg';
import italicSvg from '@esportsplus/ui/svg/italic.svg';
import linkSvg from '@esportsplus/ui/svg/link.svg';
import openSvg from '@esportsplus/ui/svg/external-link.svg';
import pencilSvg from '@esportsplus/ui/svg/pencil.svg';
import strikeSvg from '@esportsplus/ui/svg/strikethrough.svg';
import unlinkSvg from '@esportsplus/ui/svg/unlink.svg';
import '~/components/button/scss/index.scss';
import '~/components/select/scss/index.scss';
import './scss/index.scss';


type A = Attributes & {
    [INLINE_EDIT_RICH_EDITOR]?: Attributes;
    [INLINE_EDIT_RICH_TOOLBAR]?: Attributes;
    [INLINE_EDIT_STATUS]?: Attributes;
    // The whitelist: only these become formatting, in the toolbar, the shortcuts, pastes and the saved markdown.
    features?: Feature[];
    label: string;
    multiline?: boolean;
    ondisconnect?: never;
    ondocumentselectionchange?: never;
    onfocusout?: never;
    // A returned promise holds the status at saving until it settles.
    onsave?: (value: string) => unknown;
    onwindowpointercancel?: never;
    onwindowpointerup?: never;
    placeholder?: string;
    state?: State;
    // Shows the save status under the field; pass a Status to read or drive it from outside.
    status?: boolean | Status;
    value?: string;
};

type Action = Exclude<Mark, 'link'> | 'clear' | 'copy' | 'link';

// Consecutive blocks rendered together: the items of one list, or a run of other blocks.
type Section = {
    items: ReactiveArray<View>;
    kind: 'block' | 'bullet' | 'ordered' | 'task';
    slot?: { flush(): void };
};

type State = {
    editing: boolean;
    saved: boolean;
    value: string;
};

type Tool = HTMLElement & { [HINT]: Renderable<unknown> };

// A rendered block. A checklist box only toggles 'checked', so its own animation plays instead of a new box.
type View = {
    block: Block;
    checked: Signal<boolean>;
};


const URL_SCHEME = /^[a-z][a-z\d+.-]*:/i;

const RELATIVE_URL = /^[/#?]/;

const EMAIL = /^[^\s/@]+@[^\s/@]+\.[^\s/@]+$/;

const MAC_SHORTCUT = /(⇧?)(\w)$/;

const INLINE_LINE_BREAKS = /\s*\n\s*/g;


const ACTIONS: { action: Action, label: string, shortcut?: string }[] = [
    { action: 'bold', label: 'Bold', shortcut: 'B' },
    { action: 'italic', label: 'Italic', shortcut: 'I' },
    { action: 'strike', label: 'Strikethrough', shortcut: 'Shift+X' },
    { action: 'code', label: 'Code', shortcut: 'E' },
    { action: 'highlight', label: 'Highlight', shortcut: 'Shift+H' },
    { action: 'link', label: 'Link', shortcut: 'K' },
    { action: 'clear', label: 'Clear formatting' },
    { action: 'copy', label: 'Copy as markdown' }
];

const BASE: Feature[] = ['bold', 'italic', 'link', 'copy'];

// Long enough to read the check, short enough to copy again right away.
const COPIED_FOR = 1400;

// The browser's own formatting commands (a menu, a touch bar), as marks.
const FORMATS: Partial<Record<string, Exclude<Mark, 'link'>>> = {
    formatBold: 'bold',
    formatItalic: 'italic',
    formatStrikeThrough: 'strike'
};

// Space between the selection and the toolbar, and between the toolbar and the viewport edge.
const GAP = 8;

const HINT = Symbol();

const ICONS: Record<Exclude<Action, 'copy'> | 'apply' | 'open' | 'unlink', string> = {
    apply: checkSvg,
    bold: boldSvg,
    clear: clearSvg,
    code: codeSvg,
    highlight: highlightSvg,
    italic: italicSvg,
    link: linkSvg,
    open: openSvg,
    strike: strikeSvg,
    unlink: unlinkSvg
};

const INLINE_EDIT_RICH_EDITOR = Symbol.for('@esportsplus/ui/inline-edit.rich.editor');

const INLINE_EDIT_RICH_TOOLBAR = Symbol.for('@esportsplus/ui/inline-edit.rich.toolbar');

const KINDS: { feature?: Group, label: string, value: Kind }[] = [
    { label: 'Text', value: 'paragraph' },
    { feature: 'heading', label: 'Heading 1', value: 'h1' },
    { feature: 'heading', label: 'Heading 2', value: 'h2' },
    { feature: 'heading', label: 'Heading 3', value: 'h3' },
    { feature: 'quote', label: 'Quote', value: 'quote' },
    { feature: 'codeblock', label: 'Code block', value: 'codeblock' },
    { feature: 'bullet', label: 'Bulleted list', value: 'bullet' },
    { feature: 'ordered', label: 'Numbered list', value: 'ordered' },
    { feature: 'task', label: 'Checklist', value: 'task' }
];

// Long enough to notice after the field settles, short enough that the pencil is back before the next edit.
const SAVED_FOR = 1600;

// Long enough that labels only show once the pointer rests, so passing across the toolbar stays quiet.
const TOOLTIP_DELAY = 700;


// What was typed into the link field, as an address: a bare domain gets https, a bare email mailto.
function address(value: string) {
    let href = value.trim();

    if (href && !URL_SCHEME.test(href) && !RELATIVE_URL.test(href)) {
        href = (EMAIL.test(href) ? 'mailto:' : 'https://') + href;
    }

    return href && safe(href) ? href : '';
}

// Where the browser didn't say what a delete covers: a character, a word or a line from the caret, or the break to
// the next block at the edge of one.
function around(doc: Doc, pos: Pos, type: string): Span | null {
    let backward = type.includes('Backward'),
        value = text(doc[pos.block].runs),
        to: number;

    if (backward && pos.offset === 0) {
        return pos.block > 0 ? { end: pos, start: { block: pos.block - 1, offset: length(doc[pos.block - 1].runs) } } : null;
    }

    if (!backward && pos.offset === value.length) {
        return pos.block < doc.length - 1 ? { end: { block: pos.block + 1, offset: 0 }, start: pos } : null;
    }

    if (type.includes('Line')) {
        let edge = backward ? value.lastIndexOf('\n', pos.offset - 1) + 1 : value.indexOf('\n', pos.offset);

        if (edge < 0) {
            edge = value.length;
        }

        to = edge === pos.offset ? pos.offset + (backward ? -1 : 1) : edge;
    }
    else {
        to = boundary(value, pos.offset, backward, type.includes('Word') ? 'word' : 'grapheme');
    }

    let other = { block: pos.block, offset: to };

    return backward ? { end: pos, start: other } : { end: other, start: pos };
}

function boundary(value: string, offset: number, backward: boolean, granularity: 'grapheme' | 'word') {
    let edge = backward ? 0 : value.length;

    for (let { index, isWordLike, segment } of new Intl.Segmenter(undefined, { granularity }).segment(value)) {
        let counts = granularity === 'grapheme' || isWordLike;

        if (backward && index < offset && counts) {
            edge = index;
        }
        else if (!backward && index + segment.length > offset && counts) {
            return Math.max(index + segment.length, offset + 1);
        }
    }

    return edge;
}

function collapsed(span: Span) {
    return span.start.block === span.end.block && span.start.offset === span.end.offset;
}

// Whether 'view' still renders 'next': the same block with the same content. A changed checkbox it takes on itself.
function follows(view: View, next: Block) {
    if (view.block === next) {
        return true;
    }

    if (view.block.key !== next.key || view.block.kind !== next.kind || view.block.runs !== next.runs) {
        return false;
    }

    view.block = next;
    write(view.checked, next.checked);

    return true;
}

function hint(label: string, shortcut?: string) {
    if (!shortcut) {
        return label;
    }

    return mac()
        ? `${label} ${shortcut.replace('Shift+', '⇧')}`.replace(MAC_SHORTCUT, '$1⌘$2')
        : `${label} Ctrl+${shortcut}`;
}

function icon(action: Exclude<Action, 'copy'> | 'apply' | 'open' | 'unlink') {
    return html`<svg aria-hidden='true' class='inline-edit-toolbar-icon'><use href='#${ICONS[action]}' /></svg>`;
}

// Runs as elements; a line break is a <br>.
function inline(trees: Tree[]): Renderable<unknown>[] {
    return trees.map((tree) => {
        if ('text' in tree) {
            return lines(tree.text);
        }

        let children = inline(tree.children);

        switch (tree.mark) {
            case 'bold':
                return html`<strong>${children}</strong>`;
            case 'code':
                return html`<code>${children}</code>`;
            case 'highlight':
                return html`<mark>${children}</mark>`;
            case 'italic':
                return html`<em>${children}</em>`;
            case 'link':
                return html`<a href='${tree.href}'>${children}</a>`;
            default:
                return html`<s>${children}</s>`;
        }
    });
}

function lines(value: string) {
    let out: Renderable<unknown>[] = [],
        parts = value.split('\n');

    for (let i = 0, n = parts.length; i < n; i++) {
        if (i > 0) {
            out.push(html`<br>`);
        }

        if (parts[i]) {
            out.push(parts[i]);
        }
    }

    return out;
}

function partition(doc: Doc) {
    let out: { blocks: Block[], kind: Section['kind'] }[] = [];

    for (let i = 0, n = doc.length; i < n; i++) {
        let kind = (list(doc[i].kind) ? doc[i].kind : 'block') as Section['kind'],
            last = out[out.length - 1];

        if (last && last.kind === kind) {
            last.blocks.push(doc[i]);
        }
        else {
            out.push({ blocks: [doc[i]], kind });
        }
    }

    return out;
}

// Where 'pos' lands once 'span' is deleted; 'pos' is outside it.
function shift(pos: Pos, { end, start }: Span): Pos {
    if (pos.block < end.block || (pos.block === end.block && pos.offset <= end.offset)) {
        return pos;
    }

    if (pos.block === end.block) {
        return { block: start.block, offset: start.offset + pos.offset - end.offset };
    }

    return { block: pos.block - (end.block - start.block), offset: pos.offset };
}

function spans(a: Span | null, b: Span) {
    return !!a
        && a.start.block === b.start.block
        && a.start.offset === b.start.offset
        && a.end.block === b.end.block
        && a.end.offset === b.end.offset;
}

function view(block: Block): View {
    return { block, checked: signal(block.checked) };
}


export default component(
    function(
        this: { attributes?: Pick<A, typeof INLINE_EDIT_RICH_EDITOR | typeof INLINE_EDIT_RICH_TOOLBAR | typeof INLINE_EDIT_STATUS> } | void,
        {
            features: whitelist = BASE,
            label,
            multiline = false,
            onsave,
            placeholder = '',
            status: indicator = false,
            value = '',
            state = reactive({ editing: false, saved: false, value }),
            ...attributes
        }: A
    ) {
        let features = new Set(multiline ? whitelist : whitelist.filter((feature) => !KINDS.some((k) => k.feature === feature))),
            actions = ACTIONS.filter(({ action }) => features.has(action)),
            block = reactive({ active: false, error: '', value: 'paragraph' }),
            doc = signal<Doc>(parse(state.value, features, multiline)),
            hyperlink = reactive({ existing: false, invalid: false, url: '' }),
            // Declared so page-wide shortcuts (a command palette on Mod+K) leave these to the text.
            keyshortcuts = actions
                .flatMap(({ shortcut }) => shortcut ? ['Control', 'Meta'].map((mod) => `${mod}+${shortcut}`) : [])
                .concat(multiline ? ['Control+Enter', 'Meta+Enter'] : [])
                .join(' '),
            kinds = KINDS.filter((k) => !k.feature || features.has(k.feature)),
            // 'focus' is the format control the arrow keys rove to, the toolbar's one tab stop.
            local = reactive({ copied: 'idle' as 'error' | 'idle' | 'success', focus: 0, live: '' }),
            marks = actions.filter(({ action }) => action !== 'clear' && action !== 'copy'),
            // The toolbar: 'link' swaps its buttons for the link field, 'instant' holds its moves still, 'origin' and
            // 'x'/'y' place it over the selection.
            panel = reactive({ instant: false, link: false, open: false, origin: '', x: 0, y: 0 }),
            // Mark buttons by their mark, pressed while the selection carries it.
            pressed = reactive(Object.fromEntries(marks.map(({ action }) => [action, false])) as Record<string, boolean>),
            // The saved value as this field writes it, which a value from outside may not be: what an edit differs from.
            pristine = signal(serialize(read(doc), features, multiline)),
            saving = indicator ? (indicator === true ? reactive<Status>({ phase: 'saved', savedAt: null }) : indicator) : null,
            report = saving ? status.track(saving, () => state.editing && serialize(read(doc), features, multiline) !== read(pristine)) : null,
            sections = new ReactiveArray<Section>(partition(read(doc)).map(section)),
            slot = html.reactive(sections, group),
            steps = history(),
            tip = tooltip.shared({ delay: { open: TOOLTIP_DELAY } });

        let composing: { block: number, element: HTMLElement } | null = null,
            copyTimer: ReturnType<typeof setTimeout> | undefined,
            dismissed = false,
            // A drag from inside the text: what it moves, until the drop lands it.
            dragged: Span | null = null,
            editor: HTMLElement | undefined,
            frame = 0,
            items: HTMLElement[] = [],
            keys: AbortController | undefined,
            observer: ResizeObserver | undefined,
            pressing = false,
            root: HTMLElement | undefined,
            saved: Span | null = null,
            savedTimer: ReturnType<typeof setTimeout> | undefined,
            selection: Selection | null = null,
            settling: ReturnType<typeof setTimeout> | undefined,
            shown: Kind = 'paragraph',
            toolbar: HTMLElement | undefined,
            url: HTMLInputElement | undefined;

        // The select only reports a value; one that differs from the block under the selection is a choice.
        effect(() => {
            let next = block.value as Kind;

            if (next !== shown) {
                untrack(() => turn(next));
            }
        });

        // A value set from outside while the field rests shows at once.
        effect(() => state.value, (next, previous) => {
            if (previous !== undefined && !state.editing && next !== read(pristine)) {
                load(next);
            }
        });

        function apply(href: string | null) {
            let span = current();

            if (!editor || !span) {
                return;
            }

            if (href !== null) {
                href = address(href);

                if (!href) {
                    hyperlink.invalid = true;
                    return;
                }
            }

            back();
            change(link(read(doc), span, href), 'other');
            local.live = href ? 'Link set' : 'Link removed';
        }

        // Leaves the link field for the buttons, handing focus and the selection back to the text.
        function back() {
            panel.link = false;
            editor?.focus({ preventScroll: true });

            let span = current();

            if (span) {
                select({ anchor: span.start, focus: span.end });

                let range = live();

                if (range) {
                    place(range);
                }
            }
        }

        // Records the change for undo, renders it and puts the selection where it leaves off.
        function change(edit: Edit, kind: Step) {
            steps.push({ doc: read(doc), selection }, edit.selection, kind);
            commit(edit.doc);
            select(edit.selection);
        }

        // Copies carry markdown, so a paste back in keeps the formatting.
        function clip(e: ClipboardEvent, cut: boolean) {
            let range = live(),
                now = editor ? capture(editor) : null;

            if (!range || range.collapsed || !now || !e.clipboardData) {
                return;
            }

            let holder = document.createElement('div'),
                span = order(now);

            holder.append(range.cloneContents());
            e.preventDefault();
            e.clipboardData.setData('text/html', holder.innerHTML);
            e.clipboardData.setData('text/plain', serialize(excerpt(span), features, multiline));

            if (cut) {
                change(remove(read(doc), span), 'other');
            }
        }

        // The DOM follows the model: each section's items are patched by block identity, so only blocks that changed
        // render again, and the slots land it before the selection is placed.
        function commit(next: Doc) {
            write(doc, next);

            let parts = partition(next),
                end = 0,
                m = parts.length,
                n = sections.length,
                start = 0;

            while (start < n && start < m && sections[start].kind === parts[start].kind) {
                patch(sections[start].items, parts[start].blocks);
                start++;
            }

            while (end < n - start && end < m - start && sections[n - 1 - end].kind === parts[m - 1 - end].kind) {
                patch(sections[n - 1 - end].items, parts[m - 1 - end].blocks);
                end++;
            }

            if (start + end < n || start + end < m) {
                sections.splice(start, n - start - end, ...parts.slice(start, m - end).map(section));
            }

            slot.flush();

            for (let i = 0, o = sections.length; i < o; i++) {
                sections[i].slot?.flush();
            }

            flush();
        }

        async function copy() {
            let span = current();

            if (!span) {
                return;
            }

            // Confirms on press; waiting for the write makes the click feel ignored.
            clearTimeout(copyTimer);
            local.copied = 'success';
            local.live = 'Copied';
            copyTimer = setTimeout(() => {
                local.copied = 'idle';
            }, COPIED_FOR);

            if (!(await clipboard(serialize(excerpt(span), features, multiline)))) {
                local.copied = 'error';
                local.live = 'Couldn\'t copy';
            }
        }

        function current() {
            let blocks = read(doc);

            if (!saved || (saved.start.block === saved.end.block && saved.start.offset === saved.end.offset) || !blocks[saved.end.block]) {
                return null;
            }

            return saved;
        }

        function dismiss() {
            dismissed = true;
            show(false);
        }

        // A drop from inside the text moves what was dragged; one from elsewhere pastes.
        function drop(e: InputEvent, at: Span) {
            let from = dragged;

            dragged = null;

            if (!from) {
                land(at, e.dataTransfer?.getData('text/plain') ?? '');
                return;
            }

            let pos = at.start,
                inside = (pos.block > from.start.block || (pos.block === from.start.block && pos.offset >= from.start.offset))
                    && (pos.block < from.end.block || (pos.block === from.end.block && pos.offset <= from.end.offset));

            if (inside) {
                return;
            }

            let moved = excerpt(from),
                rest = remove(read(doc), from).doc,
                to = shift(pos, from);

            change(paste(rest, { end: to, start: to }, moved), 'other');
        }

        // Turns each kind of input into a change to the model. The browser never edits the DOM itself; an input
        // method does, and composition ends by reading back what it wrote.
        function edit(e: InputEvent) {
            let type = e.inputType;

            if (e.isComposing || type === 'insertCompositionText' || type === 'deleteCompositionText' || type === 'insertFromComposition') {
                return;
            }

            e.preventDefault();
            resolve();

            if (!editor) {
                return;
            }

            let now = capture(editor),
                range = e.getTargetRanges()[0],
                span = (range && target(editor, range)) || (now && order(now));

            if (!span) {
                return;
            }

            let format = FORMATS[type];

            if (format) {
                if (features.has(format) && !collapsed(span)) {
                    change(toggle(read(doc), span, format), 'other');
                }

                return;
            }

            switch (type) {
                case 'deleteByDrag':
                    dragged = span;
                    return;
                case 'formatRemove':
                    if (features.has('clear') && !collapsed(span)) {
                        change(clear(read(doc), span), 'other');
                    }

                    return;
                case 'historyRedo':
                    redo();
                    return;
                case 'historyUndo':
                    undo();
                    return;
                case 'insertFromDrop':
                    drop(e, span);
                    return;
                case 'insertFromPaste':
                    land(span, e.dataTransfer?.getData('text/plain') ?? '');
                    return;
                case 'insertLineBreak':
                case 'insertParagraph':
                    if (!multiline) {
                        finish(true, true);
                    }
                    else if (type === 'insertParagraph') {
                        change(split(read(doc), span), 'other');
                    }
                    else {
                        typed(span, '\n');
                    }

                    return;
                case 'insertOrderedList':
                case 'insertUnorderedList': {
                    let kind: Kind = type === 'insertOrderedList' ? 'ordered' : 'bullet';

                    if (features.has(kind as Group)) {
                        change(setKind(read(doc), span, kind), 'other');
                    }

                    return;
                }
            }

            if (type.startsWith('insert')) {
                typed(span, e.data ?? e.dataTransfer?.getData('text/plain') ?? '');
            }
            else if (type.startsWith('delete')) {
                erase(type, span, now);
            }
        }

        function erase(type: string, span: Span, now: Selection | null) {
            let blocks = read(doc),
                at = now && now.anchor.block === now.focus.block && now.anchor.offset === now.focus.offset ? now.focus : null;

            if (type === 'deleteContentBackward' && at?.offset === 0) {
                let next = unformat(blocks, at.block);

                if (next) {
                    change(next, 'other');
                    return;
                }
            }

            let reach = collapsed(span) && at ? around(blocks, at, type) : span;

            if (reach && !collapsed(reach)) {
                change(remove(blocks, reach), type === 'deleteByCut' ? 'other' : 'delete');
            }
        }

        // What a copy takes: within one block just its text, across several the blocks as they are.
        function excerpt(span: Span) {
            let part = slice(read(doc), span);

            if (part.length === 1) {
                part[0] = { ...part[0], checked: false, kind: 'paragraph' };
            }

            return part;
        }

        function finish(commit: boolean, keyboard: boolean) {
            if (!editor || !state.editing) {
                return;
            }

            resolve();
            state.editing = false;
            panel.link = false;
            show(false);

            if (commit) {
                save();
            }

            // Rebuilt from the markdown either way: a save drops anything outside the whitelist, a cancel reverts.
            load(state.value);

            if (keyboard) {
                editor.blur();
            }
        }

        function focus(index: number) {
            local.focus = (index + items.length) % items.length;
            items[local.focus]?.focus();
        }

        function group(section: Section) {
            let slot = html.reactive(section.items, item);

            section.slot = slot;

            switch (section.kind) {
                case 'bullet':
                    return html`<ul>${slot}</ul>`;
                case 'ordered':
                    return html`<ol>${slot}</ol>`;
                case 'task':
                    return html`<ul data-task>${slot}</ul>`;
                default:
                    return html`${slot}`;
            }
        }

        // Inspects the selection for the toolbar: which marks it carries, and the kind of block it starts in.
        function inspect(span: Span) {
            let blocks = read(doc);

            for (let i = 0, n = marks.length; i < n; i++) {
                let mark = marks[i].action as Mark;

                pressed[mark] = active(blocks, span, mark);
            }

            shown = kindAt(blocks, span);
            block.value = shown;
        }

        function item(view: View) {
            let { kind, runs } = view.block,
                characters = text(runs),
                body = [inline(nest(runs)), (!characters || characters.endsWith('\n')) && html`<br data-filler>`];

            switch (kind) {
                case 'bullet':
                case 'ordered':
                    return html`<li data-block>${body}</li>`;
                case 'codeblock':
                    return html`<pre data-block>${body}</pre>`;
                case 'h1':
                    return html`<h1 data-block>${body}</h1>`;
                case 'h2':
                    return html`<h2 data-block>${body}</h2>`;
                case 'h3':
                    return html`<h3 data-block>${body}</h3>`;
                case 'quote':
                    return html`<blockquote data-block>${body}</blockquote>`;
                case 'task':
                    return html`
                        <li data-block ${{ 'data-checked': () => read(view.checked) ? 'true' : 'false' }}>
                            <span class='inline-edit-task' contenteditable='false'>
                                ${checkbox({
                                    [checkbox.input]: {
                                        'aria-label': 'Done',
                                        checked: () => read(view.checked),
                                        onchange: (e: Event) => tick(view, (e.currentTarget as HTMLInputElement).checked)
                                    }
                                })}
                            </span>
                            ${body}
                        </li>
                    `;
                default:
                    return html`<p data-block>${body}</p>`;
            }
        }

        // Markdown lands as formatting, taking on the style at the caret; inside code it stays as typed.
        function land(span: Span, value: string) {
            if (!value) {
                return;
            }

            let blocks = read(doc),
                host = blocks[span.start.block],
                style = styleAt(host.runs, span.start.offset);

            if (host.kind === 'codeblock' || style.marks.includes('code')) {
                change(insert(blocks, span, [{ ...style, text: host.kind === 'codeblock' ? value : value.replace(INLINE_LINE_BREAKS, ' ') }]), 'other');
                return;
            }

            let pasted = parse(value, features, multiline && value.includes('\n'));

            if (pasted.length === 1 && pasted[0].kind === 'paragraph') {
                if (!pasted[0].runs.length) {
                    return;
                }

                pasted[0] = {
                    ...pasted[0],
                    runs: pasted[0].runs.map((run) => ({ href: run.href || style.href, marks: sort([...style.marks, ...run.marks]), text: run.text }))
                };
            }

            change(paste(blocks, span, pasted), 'other');
        }

        function leave(e: FocusEvent) {
            // Focus moving between the text and the toolbar stays in the edit.
            if (!root?.contains(e.relatedTarget as Node | null)) {
                finish(true, false);
            }
        }

        // Swaps the buttons for the link field, prefilled when the selection sits in a link.
        function linker() {
            let span = current();

            if (!editor || !span || !toolbar || !url) {
                return;
            }

            let found = extent(read(doc), span);

            if (found) {
                saved = found.span;
                select({ anchor: found.span.start, focus: found.span.end });
            }

            panel.link = true;
            hyperlink.existing = !!found;
            hyperlink.invalid = false;
            hyperlink.url = found?.href ?? '';

            let range = live();

            if (range) {
                place(range);
            }

            // The field shows, and takes its value, once the link mode lands.
            flush();
            url.focus({ preventScroll: true });
            url.select();
        }

        function live() {
            let native = window.getSelection();

            return native && native.rangeCount > 0 ? native.getRangeAt(0) : null;
        }

        // A fresh document from markdown, with nothing to undo.
        function load(markdown: string) {
            let next = parse(markdown, features, multiline);

            steps.clear();
            write(pristine, serialize(next, features, multiline));
            commit(next);
        }

        function navigate(e: KeyboardEvent) {
            if (e.target === url) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    apply(url.value);
                }
                else if (e.key === 'Escape') {
                    e.preventDefault();
                    back();
                }

                return;
            }

            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                focus(local.focus + (e.key === 'ArrowRight' ? 1 : -1));
            }
            else if (e.key === 'Home' || e.key === 'End') {
                e.preventDefault();
                focus(e.key === 'Home' ? 0 : -1);
            }
            else if (e.key === 'Escape' && !block.active) {
                e.preventDefault();
                dismiss();
                editor?.focus({ preventScroll: true });

                let span = current();

                if (span) {
                    select({ anchor: span.start, focus: span.end });
                }
            }
        }

        // Only the blocks that differ from what is rendered render again; a box ticked or unticked just follows.
        function patch(items: ReactiveArray<View>, next: Block[]) {
            let end = 0,
                m = next.length,
                n = items.length,
                start = 0;

            while (start < n && start < m && follows(items[start], next[start])) {
                start++;
            }

            while (end < n - start && end < m - start && follows(items[n - 1 - end], next[m - 1 - end])) {
                end++;
            }

            if (start + end < n || start + end < m) {
                items.splice(start, n - start - end, ...next.slice(start, m - end).map(view));
            }
        }

        function place(range: Range) {
            if (!root || !toolbar) {
                return;
            }

            let bounds = range.getBoundingClientRect(),
                box = root.getBoundingClientRect(),
                h = toolbar.offsetHeight,
                lines = [...range.getClientRects()].filter((rect) => rect.width > 0),
                w = toolbar.offsetWidth;

            let first = lines[0] ?? bounds,
                last = lines[lines.length - 1] ?? bounds;

            // Floats outside the field, so only the viewport limits it: flips below when there's no room above.
            let below = first.top < h + GAP,
                center = bounds.left + bounds.width / 2,
                x = Math.min(Math.max(center - w / 2, GAP), document.documentElement.clientWidth - w - GAP);

            // Scales out of the selection itself, even when clamped to the edge.
            panel.origin = `${center - x}px ${below ? 0 : h}px`;
            panel.x = x - box.left;
            panel.y = below ? last.bottom - box.top + GAP : first.top - box.top - h - GAP;

            // Shown afresh it jumps there, committed before its moves glide again; once open it glides along.
            if (!panel.open) {
                panel.instant = true;
                flush();
                void toolbar.offsetWidth;
                panel.instant = false;
            }
        }

        function redo() {
            let entry = steps.redo({ doc: read(doc), selection });

            if (entry) {
                revert(entry);
            }
        }

        // Ends a composition: the text the input method wrote replaces the model's, and the block renders again so
        // none of the nodes it made stay behind.
        function resolve() {
            clearTimeout(settling);

            if (!composing || !editor) {
                return;
            }

            let { block: i, element } = composing,
                blocks = read(doc);

            composing = null;

            if (!blocks[i] || !element.isConnected) {
                sections.splice(0, sections.length, ...partition(blocks).map(section));
                commit(blocks);
                return;
            }

            let after = written(element),
                before = text(blocks[i].runs),
                end = 0,
                now = capture(editor),
                start = 0;

            while (start < before.length && start < after.length && before[start] === after[start]) {
                start++;
            }

            while (end < before.length - start && end < after.length - start && before[before.length - 1 - end] === after[after.length - 1 - end]) {
                end++;
            }

            let next = insert(
                    blocks,
                    { end: { block: i, offset: before.length - end }, start: { block: i, offset: start } },
                    [{ ...styleAt(blocks[i].runs, start), text: after.slice(start, after.length - end) }]
                ),
                at = now && now.focus.block === i ? now.focus : next.selection.focus;

            next.doc[i] = { ...next.doc[i], runs: next.doc[i].runs.slice() };

            if (before === after) {
                commit(next.doc);
                select(caret(at));
                return;
            }

            change({ doc: next.doc, selection: caret(at) }, 'type');
        }

        function revert(entry: Entry) {
            commit(entry.doc);

            if (entry.selection) {
                select(entry.selection);
            }
        }

        function save() {
            let next = serialize(read(doc), features, multiline);

            if (next === read(pristine)) {
                return;
            }

            write(pristine, next);
            state.value = next;
            state.saved = true;

            let result = onsave?.(next);

            report?.(result);
            clearTimeout(savedTimer);
            savedTimer = setTimeout(() => {
                state.saved = false;
            }, SAVED_FOR);
        }

        function section({ blocks, kind }: { blocks: Block[], kind: Section['kind'] }): Section {
            return { items: new ReactiveArray<View>(blocks.map(view)), kind };
        }

        function select(next: Selection) {
            selection = next;

            if (editor && document.activeElement === editor) {
                restore(editor, next);
            }
        }

        // The selection finalises after pointerup, so it is read a frame later.
        function settle() {
            if (!pressing) {
                return;
            }

            pressing = false;
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(sync);
        }

        function show(next: boolean, instant = false) {
            panel.open = next;

            if (instant) {
                panel.instant = true;
            }
        }

        function sync() {
            if (!editor || !toolbar) {
                return;
            }

            let now = capture(editor);

            if (now) {
                selection = now;
            }

            if (composing || (!actions.length && kinds.length < 2)) {
                return;
            }

            let range = live();

            // Focus in the toolbar (its buttons, the select, the link field) keeps it where it is.
            if (toolbar.contains(document.activeElement) || panel.link) {
                return;
            }

            if (!now || !range || range.collapsed || !editor.contains(range.commonAncestorContainer)) {
                if (panel.open) {
                    show(false);
                }

                return;
            }

            // A drag in progress settles on release, so the toolbar doesn't chase every pixel.
            if (pressing) {
                return;
            }

            let span = order(now);

            if (dismissed) {
                if (spans(saved, span)) {
                    return;
                }

                dismissed = false;
            }

            saved = span;
            place(range);
            inspect(span);

            if (!panel.open) {
                local.focus = 0;
                show(true);
            }
        }

        // Ticked without editing, it saves at once; mid-edit it goes with the rest.
        function tick(view: View, value: boolean) {
            let blocks = read(doc),
                index = blocks.findIndex((b) => b.key === view.block.key);

            if (index < 0) {
                return;
            }

            change({ doc: check(blocks, index, value), selection: selection ?? caret({ block: index, offset: 0 }) }, 'other');

            if (!state.editing) {
                save();
            }
        }

        function trigger(action: Action) {
            let span = current();

            if (!span) {
                return;
            }

            switch (action) {
                case 'clear':
                    change(clear(read(doc), span), 'other');
                    local.live = 'Formatting cleared';
                    break;
                case 'copy':
                    void copy();
                    return;
                case 'link':
                    linker();
                    return;
                default:
                    change(toggle(read(doc), span, action), 'other');
            }

            inspect(span);
        }

        function turn(kind: Kind) {
            let span = current();

            if (!editor || !span) {
                return;
            }

            shown = kind;
            editor.focus({ preventScroll: true });
            change(setKind(read(doc), span, kind), 'other');
        }

        // Typing takes on the style of the text it follows; a one line field has no line breaks to take.
        function typed(span: Span, value: string) {
            if (!multiline) {
                value = value.replace(INLINE_LINE_BREAKS, ' ');
            }

            if (!value) {
                return;
            }

            let blocks = read(doc),
                style = styleAt(blocks[span.start.block].runs, span.start.offset + (collapsed(span) ? 0 : 1));

            change(insert(blocks, span, [{ ...style, text: value }]), 'type');
        }

        function undo() {
            let entry = steps.undo({ doc: read(doc), selection });

            if (entry) {
                revert(entry);
            }
        }

        // 'index' is the button's place among the format controls the arrow keys rove.
        let button = ({ action, label, shortcut }: (typeof ACTIONS)[number], content: Renderable<unknown>, index: number) => html`
            <button
                aria-label='${label}'
                class='button button--feedback inline-edit-toolbar-button'
                tabindex='${() => local.focus === index ? '0' : '-1'}'
                type='button'
                ${action === 'clear' || action === 'copy' ? {} : { 'aria-pressed': () => pressed[action] ? 'true' : 'false' }}
                ${{
                    onclick: () => trigger(action),
                    onconnect: (element: Tool) => {
                        element[HINT] = action === 'copy' ? () => local.copied === 'success' ? 'Copied' : label : hint(label, shortcut);
                        items[index] = element;
                    }
                }}
            >
                ${content}
            </button>
        `;

        // The text style select leads the format controls when there is one.
        let lead = kinds.length > 1 ? 1 : 0,
            tools = actions.filter(({ action }) => action === 'clear' || action === 'copy');

        return html`
            <div
                class='inline-edit'
                ${this?.attributes}
                ${attributes}
                ${{
                    class: [
                        multiline && 'inline-edit--multiline',
                        () => state.editing && '--active',
                        () => state.saved && 'inline-edit--saved',
                        () => empty(read(doc)) && 'inline-edit--empty'
                    ],
                    onconnect: (element: HTMLElement) => {
                        root = element;
                        observer = new ResizeObserver(sync);
                        observer.observe(element);
                    },
                    ondisconnect: () => {
                        cancelAnimationFrame(frame);
                        clearTimeout(copyTimer);
                        clearTimeout(savedTimer);
                        clearTimeout(settling);
                        keys?.abort();
                        observer?.disconnect();
                    },
                    ondocumentselectionchange: sync,
                    onfocusout: leave,
                    onwindowpointercancel: settle,
                    onwindowpointerup: settle
                }}
            >
                <div
                    aria-label='${label}'
                    aria-multiline='${multiline ? 'true' : 'false'}'
                    aria-keyshortcuts='${keyshortcuts}'
                    aria-placeholder='${placeholder}'
                    class='inline-edit-editor'
                    contenteditable='true'
                    data-placeholder='${placeholder}'
                    role='textbox'
                    ${this?.attributes?.[INLINE_EDIT_RICH_EDITOR]}
                    ${attributes[INLINE_EDIT_RICH_EDITOR]}
                    ${{
                        onbeforeinput: edit,
                        oncompositionend: () => {
                            clearTimeout(settling);
                            // Some engines write the composed text after this event, so it is read once they have.
                            settling = setTimeout(resolve, 0);
                        },
                        oncompositionstart: () => {
                            resolve();

                            let now = editor ? capture(editor) : null;

                            if (!editor || !now) {
                                return;
                            }

                            let span = order(now);

                            // The input method replaces a selection within one block itself; across blocks it would
                            // merge elements, so that part is deleted first.
                            if (span.start.block !== span.end.block) {
                                change(remove(read(doc), span), 'delete');
                            }

                            composing = { block: span.start.block, element: elements(editor)[span.start.block] };
                            show(false, true);
                        },
                        onconnect: (element: HTMLElement) => {
                            editor = element;
                        },
                        oncopy: (e: ClipboardEvent) => clip(e, false),
                        oncut: (e: ClipboardEvent) => clip(e, true),
                        onfocus: () => {
                            state.editing = true;

                            // Clicking back into the text leaves the link field.
                            panel.link = false;
                        },
                        onkeydown: (e: KeyboardEvent) => {
                            if (e.isComposing) {
                                return;
                            }

                            resolve();

                            let key = e.key.toLowerCase(),
                                mod = e.metaKey || e.ctrlKey;

                            if (mod && !e.altKey && (key === 'y' || key === 'z')) {
                                e.preventDefault();

                                if (key === 'y' || e.shiftKey) {
                                    redo();
                                }
                                else {
                                    undo();
                                }

                                return;
                            }

                            if (mod && !e.altKey && key !== 'enter') {
                                let action = ACTIONS.find(({ shortcut }) => shortcut?.toLowerCase() === (e.shiftKey ? 'shift+' : '') + key)?.action;

                                // Same path as the buttons, so the shortcut updates the toolbar like a click.
                                if (action && features.has(action)) {
                                    e.preventDefault();
                                    trigger(action);
                                }

                                return;
                            }

                            if (e.key === 'Escape') {
                                e.preventDefault();

                                if (panel.open) {
                                    dismiss();
                                }
                                else {
                                    finish(false, true);
                                }

                                return;
                            }

                            // One line saves on Enter; a multiline field keeps Enter for new blocks and saves on Mod+Enter.
                            if (e.key === 'Enter' && (mod || !multiline)) {
                                e.preventDefault();
                                finish(true, true);
                                return;
                            }

                            if (panel.open && !mod && (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Enter')) {
                                show(false, true);
                            }
                        },
                        onpaste: (e: ClipboardEvent) => {
                            e.preventDefault();
                            resolve();

                            let now = editor ? capture(editor) : null;

                            if (now) {
                                land(order(now), e.clipboardData?.getData('text/plain') ?? '');
                            }
                        },
                        onpointerdown: (e: PointerEvent) => {
                            if (e.button === 0) {
                                pressing = true;
                            }
                        }
                    }}
                >
                    ${slot}
                </div>
                <div class='tooltip tooltip--context inline-edit-anchor' ${{ class: () => panel.open && '--active' }}>
                    <div
                        aria-label='Formatting'
                        class='tooltip-content tooltip-content--context inline-edit-toolbar'
                        role='toolbar'
                        ${this?.attributes?.[INLINE_EDIT_RICH_TOOLBAR]}
                        ${attributes[INLINE_EDIT_RICH_TOOLBAR]}
                        ${{
                            'aria-hidden': () => panel.open ? 'false' : 'true',
                            class: [
                                () => panel.instant && 'inline-edit-toolbar--instant',
                                () => panel.link && 'inline-edit-toolbar--link'
                            ],
                            inert: () => !panel.open,
                            onconnect: (element: HTMLElement) => {
                                toolbar = element;
                                // Bound directly: delegation only runs the nearest bound handler, which for the text
                                // style select is its own.
                                keys = new AbortController();
                                element.addEventListener('keydown', navigate, { signal: keys.signal });
                            },
                            // Keeps the text selected and focused when a control is pressed; the link field takes focus.
                            onmousedown: (e: MouseEvent) => {
                                if ((e.target as Element).tagName !== 'INPUT') {
                                    e.preventDefault();
                                }
                            },
                            style: () => `--toolbar-origin: ${panel.origin}; --toolbar-x: ${panel.x}px; --toolbar-y: ${panel.y}px;`
                        }}
                    >
                        <div class='inline-edit-toolbar-format' ${tip.delegate({ content: (trigger) => (trigger as Tool)[HINT], edge: true, selector: '.inline-edit-toolbar-button' })}>
                            ${kinds.length > 1 && html`
                                ${selectMenu({
                                    [selectMenu.trigger]: {
                                        onconnect: (element: HTMLElement) => {
                                            items[0] = element;
                                        },
                                        tabindex: () => local.focus === 0 ? '0' : '-1'
                                    },
                                    class: 'inline-edit-toolbar-block',
                                    label: 'Text style',
                                    options: kinds,
                                    state: block
                                })}
                                ${(marks.length > 0 || tools.length > 0) && html`<span aria-hidden='true' class='inline-edit-toolbar-divider'></span>`}
                            `}
                            ${marks.map((item, i) => button(item, icon(item.action as Exclude<Action, 'copy'>), lead + i))}
                            ${marks.length > 0 && tools.length > 0 && html`<span aria-hidden='true' class='inline-edit-toolbar-divider'></span>`}
                            ${tools.map((item, i) => button(
                                item,
                                item.action === 'copy'
                                    ? faces(() => local.copied, [
                                        { content: '', icon: copied, key: 'idle' },
                                        { content: '', icon: checked, key: 'success', tone: 'success' },
                                        { content: '', icon: cross, key: 'error', tone: 'error' }
                                    ])
                                    : icon(item.action as Exclude<Action, 'copy'>),
                                lead + marks.length + i
                            ))}
                            ${tip.render()}
                        </div>
                        ${features.has('link') && html`
                            <div class='inline-edit-toolbar-link'>
                                ${input({
                                    'aria-invalid': () => hyperlink.invalid && 'true',
                                    'aria-label': 'Link address',
                                    class: 'inline-edit-toolbar-url',
                                    onconnect: (element: HTMLInputElement) => {
                                        url = element;
                                    },
                                    oninput: (e: Event) => {
                                        hyperlink.url = (e.currentTarget as HTMLInputElement).value;
                                    },
                                    placeholder: 'Paste or type a link',
                                    type: 'url',
                                    value: () => hyperlink.url
                                })}
                                <button
                                    aria-label='Apply link'
                                    class='button button--feedback inline-edit-toolbar-button'
                                    type='button'
                                    ${{ onclick: () => apply(hyperlink.url) }}
                                >
                                    ${icon('apply')}
                                </button>
                                <button
                                    aria-label='Open link in a new tab'
                                    class='button button--feedback inline-edit-toolbar-button'
                                    type='button'
                                    ${{
                                        onclick: () => {
                                            let href = address(hyperlink.url);

                                            if (href) {
                                                window.open(href, '_blank', 'noopener');
                                            }
                                        }
                                    }}
                                >
                                    ${icon('open')}
                                </button>
                                <button
                                    aria-label='Remove link'
                                    class='button button--feedback inline-edit-toolbar-button inline-edit-toolbar-unlink'
                                    type='button'
                                    ${{
                                        hidden: () => !hyperlink.existing,
                                        onclick: () => apply(null)
                                    }}
                                >
                                    ${icon('unlink')}
                                </button>
                            </div>
                        `}
                    </div>
                </div>
                <span aria-hidden='true' class='inline-edit-icon'>
                    <svg class='inline-edit-icon-pencil'><use href='#${pencilSvg}' /></svg>
                    <svg class='inline-edit-icon-check'><use href='#${checkSvg}' /></svg>
                </span>
                <span aria-live='polite' class='inline-edit-label'>${() => local.live}</span>
                ${saving && status.render(saving, this?.attributes?.[INLINE_EDIT_STATUS], attributes[INLINE_EDIT_STATUS])}
            </div>
        `;
    },
    { editor: INLINE_EDIT_RICH_EDITOR, status: INLINE_EDIT_STATUS, toolbar: INLINE_EDIT_RICH_TOOLBAR }
);

export type { Feature, Status };
