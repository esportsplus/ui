import { component, html, render as mount, type Attributes, type Renderable } from '@esportsplus/template';
import { effect, flush, reactive, untrack } from '@esportsplus/reactivity';
import faces from '~/components/button/faces';
import checkbox from '~/components/checkbox';
import { check, copy as copyIcon, cross } from '~/components/button/icons';
import write from '~/components/clipboard/write';
import input from '~/components/input';
import selectMenu from '~/components/select/menu';
import tooltip from '~/components/tooltip';
import { reduced } from '~/shared/animation';
import { mac } from '~/shared/platform';
import { active, clear, kind, link, normalize, setBlock, toggle, units, type Kind } from './format';
import { parse, serialize, type Block, type Feature, type Mark } from './markdown';
import { closest, safe, same, select } from './utilities';
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
    // The whitelist: only these become formatting, in the toolbar, the shortcuts, pastes and the saved markdown.
    features?: Feature[];
    label: string;
    multiline?: boolean;
    ondisconnect?: never;
    ondocumentselectionchange?: never;
    onfocusout?: never;
    onsave?: (value: string) => void;
    onwindowpointercancel?: never;
    onwindowpointerup?: never;
    placeholder?: string;
    state?: State;
    value?: string;
};

type Action = Exclude<Mark, 'link'> | 'clear' | 'copy' | 'link';

type State = {
    editing: boolean;
    saved: boolean;
    value: string;
};

type Tool = HTMLElement & { [HINT]: Renderable<unknown> };


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

const KINDS: { feature?: Block, label: string, value: Kind }[] = [
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

// Long enough that labels only show once the pointer rests, so passing across the toolbar stays quiet.
const TOOLTIP_DELAY = 700;

// Long enough to notice after the field settles, short enough that the pencil is back before the next edit.
const SAVED_FOR = 1600;


function hint(label: string, shortcut?: string) {
    if (!shortcut) {
        return label;
    }

    return mac()
        ? `${label} ${shortcut.replace('Shift+', '⇧')}`.replace(/(⇧?)(\w)$/, '$1⌘$2')
        : `${label} Ctrl+${shortcut}`;
}

function icon(action: Exclude<Action, 'copy'> | 'apply' | 'open' | 'unlink') {
    return html`<svg aria-hidden='true' class='inline-edit-toolbar-icon'><use href='#${ICONS[action]}' /></svg>`;
}

// What was typed into the link field, as an address: a bare domain gets https, a bare email mailto.
function address(value: string) {
    let href = value.trim();

    if (href && !/^[a-z][a-z\d+.-]*:/i.test(href) && !/^[/#?]/.test(href)) {
        href = (/^[^\s/@]+@[^\s/@]+\.[^\s/@]+$/.test(href) ? 'mailto:' : 'https://') + href;
    }

    return href && safe(href) ? href : '';
}


export default component(
    function(
        this: { attributes?: Pick<A, typeof INLINE_EDIT_RICH_EDITOR | typeof INLINE_EDIT_RICH_TOOLBAR> } | void,
        {
            features: whitelist = BASE,
            label,
            multiline = false,
            onsave,
            placeholder = '',
            value = '',
            state = reactive({ editing: false, saved: false, value }),
            ...attributes
        }: A
    ) {
        let features = new Set(multiline ? whitelist : whitelist.filter((feature) => !KINDS.some((k) => k.feature === feature))),
            actions = ACTIONS.filter(({ action }) => features.has(action)),
            block = reactive({ active: false, error: '', value: 'paragraph' }),
            hyperlink = reactive({ existing: false, invalid: false }),
            // Declared so page-wide shortcuts (a command palette on Mod+K) leave these to the text.
            keyshortcuts = actions
                .flatMap(({ shortcut }) => shortcut ? ['Control', 'Meta'].map((mod) => `${mod}+${shortcut}`) : [])
                .concat(multiline ? ['Control+Enter', 'Meta+Enter'] : [])
                .join(' '),
            kinds = KINDS.filter((k) => !k.feature || features.has(k.feature)),
            // 'focus' is the format control the arrow keys rove to, the toolbar's one tab stop.
            local = reactive({ copied: 'idle' as 'error' | 'idle' | 'success', empty: value.trim() === '', focus: 0, live: '' }),
            marks = actions.filter(({ action }) => action !== 'clear' && action !== 'copy'),
            // The toolbar: 'link' swaps its buttons for the link field, 'instant' holds its moves still, 'origin' and
            // 'x'/'y' place it over the selection.
            panel = reactive({ instant: false, link: false, open: false, origin: '', x: 0, y: 0 }),
            // Mark buttons by their mark, pressed while the selection carries it.
            pressed = reactive(Object.fromEntries(marks.map(({ action }) => [action, false])) as Record<string, boolean>),
            tip = tooltip.shared({ delay: { open: TOOLTIP_DELAY } });

        let copyTimer: ReturnType<typeof setTimeout> | undefined,
            dismissed = false,
            editor: HTMLElement | undefined,
            frame = 0,
            // Checklist boxes mounted into the text, each with the disposer of its component.
            boxes = new Map<HTMLElement, VoidFunction>(),
            items: HTMLElement[] = [],
            observer: ResizeObserver | undefined,
            pressing = false,
            release: VoidFunction | undefined,
            root: HTMLElement | undefined,
            saved: Range | null = null,
            savedTimer: ReturnType<typeof setTimeout> | undefined,
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

        function apply(href: string | null) {
            let range = current();

            if (!editor || !range) {
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
            run(() => link(editor!, range, href));
            local.live = href ? 'Link set' : 'Link removed';
        }

        // Leaves the link field for the buttons, handing focus and the selection back to the text.
        function back() {
            panel.link = false;
            editor?.focus({ preventScroll: true });

            let range = current();

            if (range) {
                select(range);
                place(range);
            }
        }

        // Copies carry markdown, so a paste back in keeps the formatting.
        function clip(e: ClipboardEvent, cut: boolean) {
            let selection = window.getSelection(),
                range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

            if (!range || range.collapsed || !e.clipboardData) {
                return;
            }

            let holder = document.createElement('div');

            holder.append(range.cloneContents());
            e.preventDefault();
            e.clipboardData.setData('text/html', holder.innerHTML);
            e.clipboardData.setData('text/plain', serialize(holder, features, multiline));

            if (cut) {
                range.deleteContents();
                empty();
            }
        }

        async function copy() {
            let range = current();

            if (!range) {
                return;
            }

            let holder = document.createElement('div');

            holder.append(range.cloneContents());

            // Confirms on press; waiting for the write makes the click feel ignored.
            clearTimeout(copyTimer);
            local.copied = 'success';
            local.live = 'Copied';
            copyTimer = setTimeout(() => {
                local.copied = 'idle';
            }, COPIED_FOR);

            if (!(await write(serialize(holder, features, multiline)))) {
                local.copied = 'error';
                local.live = 'Couldn\'t copy';
            }
        }

        function current() {
            if (!editor || !saved || saved.collapsed || !editor.contains(saved.commonAncestorContainer)) {
                return null;
            }

            return saved;
        }

        function dismiss() {
            dismissed = true;
            show(false);
        }

        function empty() {
            local.empty = (editor?.textContent ?? '').trim() === '';
        }

        function finish(commit: boolean, keyboard: boolean) {
            if (!editor || !state.editing) {
                return;
            }

            state.editing = false;
            panel.link = false;
            show(false);

            if (commit) {
                save();
            }

            // Rebuilt from the markdown either way: a save drops anything outside the whitelist, a cancel reverts.
            render(state.value);

            if (keyboard) {
                editor.blur();
            }
        }

        function focus(index: number) {
            local.focus = (index + items.length) % items.length;
            items[local.focus]?.focus();
        }

        function leave(e: FocusEvent) {
            // Focus moving between the text and the toolbar stays in the edit.
            if (!root?.contains(e.relatedTarget as Node | null)) {
                finish(true, false);
            }
        }

        // Swaps the buttons for the link field, prefilled when the selection sits in a link.
        function linker() {
            let range = current();

            if (!editor || !range || !toolbar || !url) {
                return;
            }

            let existing = closest(range.startContainer, 'a', editor);

            if (existing && existing === closest(range.endContainer, 'a', editor)) {
                saved = document.createRange();
                saved.selectNodeContents(existing);
                select(saved);
            }
            else {
                existing = null;
            }

            panel.link = true;
            url.value = existing?.getAttribute('href') ?? '';
            hyperlink.existing = !!existing;
            hyperlink.invalid = false;
            place(saved!);
            // The field shows once the link mode lands.
            flush();
            url.focus({ preventScroll: true });
            url.select();
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

                let range = current();

                if (range) {
                    select(range);
                }
            }
        }

        // Markdown pastes as formatting; several lines split the block at the caret and land between its halves.
        function paste(e: ClipboardEvent) {
            let selection = window.getSelection();

            e.preventDefault();

            if (!editor || !selection || selection.rangeCount === 0) {
                return;
            }

            let range = selection.getRangeAt(0),
                text = e.clipboardData?.getData('text/plain') ?? '';

            range.deleteContents();

            let code = closest(range.startContainer, 'pre, code', editor),
                fragment: DocumentFragment | Text = code ? document.createTextNode(text) : parse(text, features, multiline && text.includes('\n')),
                last = fragment.nodeType === Node.TEXT_NODE ? fragment : fragment.lastChild;

            if (!last) {
                return;
            }

            if (code || !multiline || !text.includes('\n')) {
                range.insertNode(fragment);
            }
            else {
                normalize(editor);

                let top: Node = range.startContainer;

                while (top !== editor && top.parentNode !== editor) {
                    top = top.parentNode!;
                }

                if (top === editor) {
                    editor.append(fragment);
                }
                else {
                    let tail = document.createRange();

                    tail.setStart(range.startContainer, range.startOffset);
                    tail.setEndAfter(top);

                    let rest = tail.extractContents(),
                        after = rest.firstChild;

                    (top as ChildNode).after(fragment, rest);

                    for (let node of [top, after]) {
                        if (node && !node.textContent) {
                            node.parentNode?.removeChild(node);
                        }
                    }
                }
            }

            tasks(false);

            let caret = document.createRange();

            caret.selectNodeContents(last);
            caret.collapse(false);
            select(caret);
            empty();
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

            let left = x - box.left,
                top = below ? last.bottom - box.top + GAP : first.top - box.top - h - GAP;

            // Scales out of the selection itself, even when clamped to the edge.
            panel.origin = `${center - x}px ${below ? 0 : h}px`;
            panel.x = left;
            panel.y = top;

            // Shown afresh it jumps there, committed before its moves glide again; once open it glides along.
            if (!panel.open || reduced()) {
                panel.instant = true;
                flush();
                void toolbar.offsetWidth;
                panel.instant = false;
            }
        }

        function render(markdown: string) {
            if (!editor) {
                return;
            }

            for (let dispose of boxes.values()) {
                dispose();
            }

            boxes.clear();
            editor.replaceChildren(parse(markdown, features, multiline));
            tasks(false);
            empty();
        }

        // Every transform returns the range to leave selected, or nothing when there was no selection to act on.
        function run(transform: () => Range | null) {
            let next = transform();

            tasks(false);

            if (next) {
                select(next);
            }

            empty();
        }

        function save() {
            if (!editor) {
                return;
            }

            let next = serialize(editor, features, multiline);

            if (next === state.value) {
                return;
            }

            state.value = next;
            state.saved = true;
            onsave?.(next);

            clearTimeout(savedTimer);
            savedTimer = setTimeout(() => {
                state.saved = false;
            }, SAVED_FOR);
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
            if (!editor || !toolbar || (!actions.length && kinds.length < 2)) {
                return;
            }

            let selection = window.getSelection(),
                range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

            // Focus in the toolbar (its buttons, the select, the link field) keeps it where it is.
            if (toolbar.contains(document.activeElement) || panel.link) {
                return;
            }

            if (!range || range.collapsed || !editor.contains(range.commonAncestorContainer)) {
                if (panel.open) {
                    show(false);
                }

                return;
            }

            // A drag in progress settles on release, so the toolbar doesn't chase every pixel.
            if (pressing) {
                return;
            }

            if (dismissed) {
                if (same(saved, range)) {
                    return;
                }

                dismissed = false;
            }

            saved = range.cloneRange();
            place(range);

            for (let i = 0, n = marks.length; i < n; i++) {
                let mark = marks[i].action as Mark;

                pressed[mark] = active(editor, range, mark);
            }

            shown = kind(units(editor, range)[0]);
            block.value = shown;

            if (!panel.open) {
                local.focus = 0;
                show(true);
            }
        }

        // Every checklist item leads with one checkbox, a non-editable island the markdown skips; boxes left
        // anywhere else (an item turned into text, one the browser split off) go. 'fresh' marks items the
        // browser just split, which copy the checked state of the item they came from.
        function tasks(fresh: boolean) {
            if (!editor || !features.has('task')) {
                return;
            }

            for (let [box, dispose] of boxes) {
                let item = box.parentElement;

                if (!editor.contains(box) || item?.tagName !== 'LI' || !item.parentElement?.hasAttribute('data-task') || item.firstChild !== box) {
                    dispose();
                    box.remove();
                    boxes.delete(box);
                }
            }

            let selection = window.getSelection(),
                caret = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

            for (let item of editor.querySelectorAll<HTMLElement>('ul[data-task] > li')) {
                let first = item.firstChild as HTMLElement | null;

                if (first && boxes.has(first)) {
                    continue;
                }

                if (fresh) {
                    item.setAttribute('data-checked', 'false');
                }

                let box = document.createElement('span');

                box.className = 'inline-edit-task';
                box.contentEditable = 'false';
                boxes.set(box, mount(box, checkbox({
                    [checkbox.input]: {
                        'aria-label': 'Done',
                        checked: item.getAttribute('data-checked') === 'true',
                        onchange: (e: Event) => {
                            let input = e.currentTarget as HTMLInputElement;

                            input.closest('li')?.setAttribute('data-checked', input.checked ? 'true' : 'false');

                            // Ticked without editing, it saves at once; mid-edit it goes with the rest.
                            if (!state.editing) {
                                save();
                            }
                        }
                    }
                })));
                item.prepend(box);

                // A caret at the very start of the item would type in front of the box.
                if (caret?.collapsed && caret.startContainer === item && caret.startOffset === 0) {
                    caret.setStartAfter(box);
                    caret.collapse(true);
                    select(caret);
                }
            }
        }

        function trigger(action: Action) {
            switch (action) {
                case 'clear':
                    run(() => clear(editor!, current()!));
                    local.live = 'Formatting cleared';
                    return;
                case 'copy':
                    void copy();
                    return;
                case 'link':
                    linker();
                    return;
                default:
                    run(() => toggle(editor!, current()!, action));
            }
        }

        function turn(target: Kind) {
            let range = current();

            if (!editor || !range) {
                return;
            }

            shown = target;
            editor.focus({ preventScroll: true });
            run(() => setBlock(editor!, range, target));
        }

        // Backspace at the very start of a checklist item turns it into text, instead of deleting its box.
        function unlist(e: KeyboardEvent) {
            let selection = window.getSelection(),
                caret = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null,
                item = editor && caret?.collapsed ? closest(caret.startContainer, 'ul[data-task] > li', editor) : null;

            if (!caret || !item) {
                return false;
            }

            let before = document.createRange();

            before.setStart(item, 0);
            before.setEnd(caret.startContainer, caret.startOffset);

            if (before.toString()) {
                return false;
            }

            e.preventDefault();
            run(() => {
                let next = setBlock(editor!, caret, 'paragraph');

                next?.collapse(true);

                return next;
            });

            return true;
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
                    onclick: () => {
                        if (current()) {
                            trigger(action);
                        }
                    },
                    onrender: (element: Tool) => {
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
                        () => local.empty && 'inline-edit--empty'
                    ],
                    ondisconnect: () => {
                        cancelAnimationFrame(frame);
                        clearTimeout(copyTimer);
                        clearTimeout(savedTimer);
                        observer?.disconnect();
                        release?.();
                    },
                    ondocumentselectionchange: sync,
                    onfocusout: leave,
                    onrender: (element: HTMLElement) => {
                        root = element;
                    },
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
                        oncopy: (e: ClipboardEvent) => clip(e, false),
                        oncut: (e: ClipboardEvent) => clip(e, true),
                        onfocus: () => {
                            state.editing = true;

                            // Clicking back into the text leaves the link field.
                            panel.link = false;
                        },
                        oninput: () => {
                            tasks(true);
                            empty();
                        },
                        onkeydown: (e: KeyboardEvent) => {
                            let key = e.key.toLowerCase(),
                                mod = e.metaKey || e.ctrlKey;

                            if (mod && !e.altKey && key !== 'enter') {
                                let action = ACTIONS.find(({ shortcut }) => shortcut?.toLowerCase() === (e.shiftKey ? 'shift+' : '') + key)?.action;

                                // Same path as the buttons, so the shortcut updates the toolbar like a click.
                                if (action && features.has(action)) {
                                    e.preventDefault();

                                    if (current()) {
                                        trigger(action);
                                    }
                                }

                                return;
                            }

                            if (e.key === 'Backspace' && unlist(e)) {
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
                        onpaste: paste,
                        onpointerdown: (e: PointerEvent) => {
                            if (e.button === 0) {
                                pressing = true;
                            }
                        },
                        onrender: (element: HTMLElement) => {
                            editor = element;
                            render(state.value);
                        }
                    }}
                ></div>
                <div
                    class='tooltip tooltip--context inline-edit-anchor'
                    ${{
                        class: () => panel.open && '--active',
                        onconnect: () => {
                            // Bound directly: delegated mousedown listeners are passive, and delegation only runs
                            // the nearest bound handler, which inside the toolbar belongs to the tooltip or select.
                            let bar = toolbar,
                                prevent = (e: MouseEvent) => {
                                    // Keeps the text selected and focused when a button is clicked; the link field takes focus.
                                    if ((e.target as Element).tagName !== 'INPUT') {
                                        e.preventDefault();
                                    }
                                };

                            bar?.addEventListener('keydown', navigate);
                            bar?.addEventListener('mousedown', prevent);
                            release = () => {
                                bar?.removeEventListener('keydown', navigate);
                                bar?.removeEventListener('mousedown', prevent);
                            };

                            if (root) {
                                observer = new ResizeObserver(sync);
                                observer.observe(root);
                            }
                        }
                    }}
                >
                    <div
                        aria-label='Formatting'
                        class='tooltip-content tooltip-content--context inline-edit-toolbar'
                        role='toolbar'
                        ${this?.attributes?.[INLINE_EDIT_RICH_TOOLBAR]}
                        ${attributes[INLINE_EDIT_RICH_TOOLBAR]}
                        ${{
                            'aria-hidden': () => panel.open ? 'false' : 'true',
                            class: () => panel.link && 'inline-edit-toolbar--link',
                            inert: () => !panel.open,
                            onrender: (element: HTMLElement) => {
                                toolbar = element;
                            },
                            style: () => `transform-origin: ${panel.origin}; translate: ${panel.x}px ${panel.y}px;${panel.instant ? ' transition: none;' : ''}`
                        }}
                    >
                        <div class='inline-edit-toolbar-format' ${tip.delegate({ content: (trigger) => (trigger as Tool)[HINT], edge: true, selector: '.inline-edit-toolbar-button' })}>
                            ${kinds.length > 1
                                ? html`
                                    ${selectMenu({
                                        [selectMenu.trigger]: {
                                            onrender: (element: HTMLElement) => {
                                                items[0] = element;
                                            },
                                            tabindex: () => local.focus === 0 ? '0' : '-1'
                                        },
                                        class: 'inline-edit-toolbar-block',
                                        label: 'Text style',
                                        options: kinds,
                                        state: block
                                    })}
                                    ${marks.length || tools.length ? html`<span aria-hidden='true' class='inline-edit-toolbar-divider'></span>` : ''}
                                `
                                : ''}
                            ${marks.map((item, i) => button(item, icon(item.action as Exclude<Action, 'copy'>), lead + i))}
                            ${marks.length && tools.length ? html`<span aria-hidden='true' class='inline-edit-toolbar-divider'></span>` : ''}
                            ${tools.map((item, i) => button(
                                item,
                                item.action === 'copy'
                                    ? faces(() => local.copied, [
                                        { content: '', icon: copyIcon, key: 'idle' },
                                        { content: '', icon: check, key: 'success', tone: 'success' },
                                        { content: '', icon: cross, key: 'error', tone: 'error' }
                                    ])
                                    : icon(item.action as Exclude<Action, 'copy'>),
                                lead + marks.length + i
                            ))}
                            ${tip.render()}
                        </div>
                        ${features.has('link')
                            ? html`
                                <div class='inline-edit-toolbar-link'>
                                    ${input({
                                        'aria-invalid': () => hyperlink.invalid && 'true',
                                        'aria-label': 'Link address',
                                        class: 'inline-edit-toolbar-url',
                                        onrender: (element: HTMLInputElement) => {
                                            url = element;
                                        },
                                        placeholder: 'Paste or type a link',
                                        type: 'url'
                                    })}
                                    <button
                                        aria-label='Apply link'
                                        class='button button--feedback inline-edit-toolbar-button'
                                        type='button'
                                        ${{ onclick: () => apply(url?.value ?? '') }}
                                    >
                                        ${icon('apply')}
                                    </button>
                                    <button
                                        aria-label='Open link in a new tab'
                                        class='button button--feedback inline-edit-toolbar-button'
                                        type='button'
                                        ${{
                                            onclick: () => {
                                                let href = address(url?.value ?? '');

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
                            `
                            : ''}
                    </div>
                </div>
                <span aria-hidden='true' class='inline-edit-icon'>
                    <svg class='inline-edit-icon-pencil'><use href='#${pencilSvg}' /></svg>
                    <svg class='inline-edit-icon-check'><use href='#${checkSvg}' /></svg>
                </span>
                <span aria-live='polite' class='inline-edit-label'>${() => local.live}</span>
            </div>
        `;
    },
    { editor: INLINE_EDIT_RICH_EDITOR, toolbar: INLINE_EDIT_RICH_TOOLBAR }
);

export type { Feature };
