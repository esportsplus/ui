import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import faces from '~/components/button/faces';
import { check, copy as copyIcon, cross } from '~/components/button/icons';
import write from '~/components/clipboard/write';
import tooltip from '~/components/tooltip';
import { closest, same, sanitize, select, unwrap } from './utilities';
import '~/components/button/scss/index.scss';
import './scss/index.scss';


type A = Attributes & {
    [INLINE_EDIT_RICH_EDITOR]?: Attributes;
    [INLINE_EDIT_RICH_TOOLBAR]?: Attributes;
    href?: string;
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

type Format = 'bold' | 'highlight' | 'italic' | 'link';

type State = {
    editing: boolean;
    saved: boolean;
    value: string;
};


// Long enough to read the check, short enough to copy again right away.
const COPIED_FOR = 1400;

const FORMATS: Format[] = ['bold', 'italic', 'link', 'highlight'];

// Space between the selection and the toolbar, and between the toolbar and the viewport edge.
const GAP = 8;

const INLINE_EDIT_RICH_EDITOR = Symbol.for('@esportsplus/ui/inline-edit.rich.editor');

const INLINE_EDIT_RICH_TOOLBAR = Symbol.for('@esportsplus/ui/inline-edit.rich.toolbar');

const LABELS: Record<Format, string> = {
    bold: 'Bold',
    highlight: 'Highlight',
    italic: 'Italic',
    link: 'Link'
};

// Long enough to notice after the field settles, short enough that the pencil is back before the next edit.
const SAVED_FOR = 1600;

const TAGS: Record<Format, string> = {
    bold: 'strong',
    highlight: 'mark',
    italic: 'em',
    link: 'a'
};


function icon(format: Format) {
    switch (format) {
        case 'bold':
            return html`
                <svg aria-hidden='true' class='inline-edit-toolbar-icon' viewBox='0 0 16 16'>
                    <path d='M4.75 3.25h3.9a2.4 2.4 0 0 1 0 4.8h-3.9Zm0 4.8h4.6a2.35 2.35 0 0 1 0 4.7h-4.6Z' stroke-width='1.75' />
                </svg>
            `;
        case 'highlight':
            return html`
                <svg aria-hidden='true' class='inline-edit-toolbar-icon' viewBox='0 0 16 16'>
                    <path d='m9.75 2.75 3.5 3.5-5.5 5.5h-3.5v-3.5Z' />
                    <path d='M2.75 14.25h10.5' />
                </svg>
            `;
        case 'italic':
            return html`
                <svg aria-hidden='true' class='inline-edit-toolbar-icon' viewBox='0 0 16 16'>
                    <path d='M7 3.25h5M4 12.75h5M9.5 3.25l-3 9.5' />
                </svg>
            `;
        default:
            return html`
                <svg aria-hidden='true' class='inline-edit-toolbar-icon' viewBox='0 0 16 16'>
                    <path d='M7 9a2.5 2.5 0 0 0 3.54 0l2-2A2.5 2.5 0 0 0 9 3.46l-.5.5M9 7a2.5 2.5 0 0 0-3.54 0l-2 2A2.5 2.5 0 0 0 7 12.54l.5-.5' />
                </svg>
            `;
    }
}

function reduced() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
}


export default component(
    function(
        this: { attributes?: Pick<A, typeof INLINE_EDIT_RICH_EDITOR | typeof INLINE_EDIT_RICH_TOOLBAR> } | void,
        {
            href = '#',
            label,
            multiline = false,
            onsave,
            placeholder = '',
            value = '',
            state = reactive({ editing: false, saved: false, value }),
            ...attributes
        }: A
    ) {
        let anchor: HTMLElement | undefined,
            buttons: HTMLButtonElement[] = [],
            copyTimer: ReturnType<typeof setTimeout> | undefined,
            dismissed = false,
            editor: HTMLElement | undefined,
            focusIndex = 0,
            frame = 0,
            local = reactive({ copied: 'idle' as 'error' | 'idle' | 'success', empty: value.trim() === '', live: '' }),
            observer: ResizeObserver | undefined,
            open = false,
            pressing = false,
            release: VoidFunction | undefined,
            root: HTMLElement | undefined,
            saved: Range | null = null,
            savedTimer: ReturnType<typeof setTimeout> | undefined,
            toolbar: HTMLElement | undefined;

        async function copy() {
            let range = current();

            if (!range) {
                return;
            }

            // Confirms on press; waiting for the write makes the click feel ignored.
            clearTimeout(copyTimer);
            local.copied = 'success';
            local.live = 'Copied';
            copyTimer = setTimeout(() => {
                local.copied = 'idle';
            }, COPIED_FOR);

            if (!(await write(range.toString()))) {
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
            show(false);
            empty();
            sanitize(editor);

            let next = local.empty ? '' : editor.innerHTML.trim();

            if (commit && next !== state.value) {
                state.value = next;
                state.saved = true;
                onsave?.(next);

                clearTimeout(savedTimer);
                savedTimer = setTimeout(() => {
                    state.saved = false;
                }, SAVED_FOR);
            }
            else {
                render(state.value);
            }

            if (keyboard) {
                editor.blur();
            }
        }

        function focus(index: number) {
            focusIndex = (index + buttons.length) % buttons.length;
            roving();
            buttons[focusIndex]?.focus();
        }

        // Focus moving between the text and the toolbar stays in the edit.
        function leave(e: FocusEvent) {
            if (!root?.contains(e.relatedTarget as Node | null)) {
                finish(true, false);
            }
        }

        function navigate(e: KeyboardEvent) {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                focus(focusIndex + (e.key === 'ArrowRight' ? 1 : -1));
            }
            else if (e.key === 'Home' || e.key === 'End') {
                e.preventDefault();
                focus(e.key === 'Home' ? 0 : -1);
            }
            else if (e.key === 'Escape') {
                e.preventDefault();
                dismiss();
                editor?.focus({ preventScroll: true });

                let range = current();

                if (range) {
                    select(range);
                }
            }
        }

        function render(markup: string) {
            if (!editor) {
                return;
            }

            let template = document.createElement('template');

            template.innerHTML = markup;
            editor.replaceChildren(sanitize(template.content));
            empty();
        }

        function roving() {
            for (let i = 0, n = buttons.length; i < n; i++) {
                buttons[i].tabIndex = i === focusIndex ? 0 : -1;
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

        // Imperative rather than bound: bound classes land a frame late, after the position has jumped.
        function show(next: boolean, instant = false) {
            open = next;

            if (!anchor || !toolbar) {
                return;
            }

            if (instant) {
                toolbar.style.transition = 'none';
            }

            anchor.classList.toggle('--active', next);
            toolbar.inert = !next;
            toolbar.setAttribute('aria-hidden', next ? 'false' : 'true');
        }

        function sync() {
            if (!editor || !root || !toolbar) {
                return;
            }

            let selection = window.getSelection(),
                range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

            if (!range || range.collapsed || !editor.contains(range.commonAncestorContainer)) {
                // Tabbing into the toolbar can nudge the selection; keep it open.
                if (toolbar.contains(document.activeElement)) {
                    return;
                }

                if (open) {
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
            toolbar.style.transformOrigin = `${center - x}px ${below ? 0 : h}px`;

            if (!open || reduced()) {
                toolbar.style.transition = 'none';
                toolbar.style.translate = `${left}px ${top}px`;
                void toolbar.offsetWidth;
                toolbar.style.removeProperty('transition');
            }
            else {
                toolbar.style.translate = `${left}px ${top}px`;
            }

            for (let i = 0, n = FORMATS.length; i < n; i++) {
                let start = closest(range.startContainer, TAGS[FORMATS[i]], editor);

                buttons[i]?.setAttribute('aria-pressed', start && start === closest(range.endContainer, TAGS[FORMATS[i]], editor) ? 'true' : 'false');
            }

            if (!open) {
                focusIndex = 0;
                roving();
                show(true);
            }
        }

        function toggle(format: Format) {
            let range = current();

            if (!editor || !range) {
                return;
            }

            let end = closest(range.endContainer, TAGS[format], editor),
                next = document.createRange(),
                start = closest(range.startContainer, TAGS[format], editor);

            if (start && start === end) {
                let firstChild = start.firstChild,
                    lastChild = start.lastChild;

                unwrap(start);

                if (!firstChild || !lastChild) {
                    return;
                }

                next.setStartBefore(firstChild);
                next.setEndAfter(lastChild);
                local.live = `${LABELS[format]} off`;
            }
            else {
                let element = document.createElement(TAGS[format]),
                    fragment = range.extractContents();

                // Merges partial marks of the same kind into the new one, so formatting never nests.
                fragment.querySelectorAll(TAGS[format]).forEach(unwrap);

                if (format === 'link') {
                    element.setAttribute('href', href);
                }

                element.appendChild(fragment);
                range.insertNode(element);
                next.selectNodeContents(element);
                local.live = `${LABELS[format]} on`;
            }

            // Splitting a partly selected mark can leave an empty shell behind.
            editor.querySelectorAll(Object.values(TAGS).join(',')).forEach((element) => {
                if (!element.textContent) {
                    element.remove();
                }
            });

            select(next);
        }

        function trigger(i: number, name: string, content: Renderable<unknown>, onclick: VoidFunction) {
            return html`
                <button
                    aria-label='${name}'
                    class='button button--feedback inline-edit-toolbar-button'
                    tabindex='-1'
                    type='button'
                    ${{
                        onclick,
                        onfocus: () => {
                            focusIndex = i;
                            roving();
                        }
                    }}
                >
                    ${content}
                </button>
            `;
        }

        return html`
            <div
                class='inline-edit'
                ${this?.attributes}
                ${attributes}
                ${{
                    class: [
                        multiline && 'inline-edit--multiline',
                        () => state.editing && '--active',
                        () => state.saved && '--saved',
                        () => local.empty && '--empty'
                    ],
                    ondisconnect: () => {
                        cancelAnimationFrame(frame);
                        clearTimeout(copyTimer);
                        clearTimeout(savedTimer);
                        observer?.disconnect();
                        release?.();
                    },
                    ondocumentselectionchange: sync,
                    onwindowpointercancel: settle,
                    onwindowpointerup: settle
                }}
            >
                <div
                    aria-label='${label}'
                    aria-multiline='${multiline ? 'true' : 'false'}'
                    aria-placeholder='${placeholder}'
                    class='inline-edit-editor'
                    contenteditable='true'
                    data-placeholder='${placeholder}'
                    role='textbox'
                    ${this?.attributes?.[INLINE_EDIT_RICH_EDITOR]}
                    ${attributes[INLINE_EDIT_RICH_EDITOR]}
                    ${{
                        onfocus: () => {
                            state.editing = true;
                        },
                        oninput: empty,
                        onkeydown: (e: KeyboardEvent) => {
                            let mod = e.metaKey || e.ctrlKey;

                            if (mod && !e.altKey && (e.key === 'b' || e.key === 'i')) {
                                // Same path as the buttons, so the shortcut updates the toolbar like a click.
                                e.preventDefault();

                                if (current()) {
                                    toggle(e.key === 'b' ? 'bold' : 'italic');
                                }

                                return;
                            }

                            if (e.key === 'Escape') {
                                e.preventDefault();

                                if (open) {
                                    dismiss();
                                }
                                else {
                                    finish(false, true);
                                }

                                return;
                            }

                            // Shift+Enter still adds a line break to a multiline field.
                            if (e.key === 'Enter' && !(multiline && e.shiftKey)) {
                                e.preventDefault();
                                finish(true, true);
                                return;
                            }

                            if (open && !mod && (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Enter')) {
                                show(false, true);
                            }
                        },
                        // Pasted markup would bring its own styles along; only the text comes in.
                        onpaste: (e: ClipboardEvent) => {
                            let selection = window.getSelection();

                            e.preventDefault();

                            if (!selection || selection.rangeCount === 0) {
                                return;
                            }

                            let range = selection.getRangeAt(0),
                                text = document.createTextNode(e.clipboardData?.getData('text/plain') ?? '');

                            if (!multiline) {
                                text.data = text.data.replace(/\s+/g, ' ');
                            }

                            range.deleteContents();
                            range.insertNode(text);
                            range.setStartAfter(text);
                            range.collapse(true);
                            select(range);
                            empty();
                        },
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
                        onconnect: (element: HTMLElement) => {
                            anchor = element;
                            root = element.parentElement ?? undefined;
                            toolbar = element.querySelector<HTMLElement>('.inline-edit-toolbar') ?? undefined;
                            buttons = [...element.querySelectorAll<HTMLButtonElement>('.inline-edit-toolbar-button')];

                            // Bound directly: delegated mousedown listeners are passive, and delegation only runs
                            // the nearest bound handler, which for keys and focus inside the toolbar is the group's.
                            let bar = toolbar,
                                host = root,
                                prevent = (e: MouseEvent) => e.preventDefault();

                            // Keeps the text selected and focused when a button is clicked.
                            bar?.addEventListener('mousedown', prevent);
                            bar?.addEventListener('keydown', navigate);
                            host?.addEventListener('focusout', leave);
                            release = () => {
                                bar?.removeEventListener('keydown', navigate);
                                bar?.removeEventListener('mousedown', prevent);
                                host?.removeEventListener('focusout', leave);
                            };

                            if (root) {
                                observer = new ResizeObserver(sync);
                                observer.observe(root);
                            }

                            roving();
                        }
                    }}
                >
                    <div
                        aria-hidden='true'
                        aria-label='Formatting'
                        class='tooltip-content tooltip-content--context inline-edit-toolbar'
                        inert
                        role='toolbar'
                        ${this?.attributes?.[INLINE_EDIT_RICH_TOOLBAR]}
                        ${attributes[INLINE_EDIT_RICH_TOOLBAR]}
                    >
                        ${tooltip.group({
                            class: 'inline-edit-toolbar-group',
                            items: [
                                ...FORMATS.map((format, i) => ({
                                    content: trigger(i, LABELS[format], icon(format), () => toggle(format)),
                                    tooltip: LABELS[format]
                                })),
                                {
                                    class: 'inline-edit-toolbar-copy',
                                    content: trigger(
                                        FORMATS.length,
                                        'Copy',
                                        faces(() => local.copied, [
                                            { content: '', icon: copyIcon, key: 'idle' },
                                            { content: '', icon: check, key: 'success', tone: 'success' },
                                            { content: '', icon: cross, key: 'error', tone: 'error' }
                                        ]),
                                        () => void copy()
                                    ),
                                    tooltip: () => local.copied === 'success' ? 'Copied' : 'Copy'
                                }
                            ],
                            [tooltip.group.tooltipContent]: { direction: 'n' }
                        })}
                    </div>
                </div>
                <span aria-hidden='true' class='inline-edit-icon'>
                    <svg class='inline-edit-icon-pencil' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 16 16'>
                        <path d='M9.75 3.75 12.25 6.25M3.25 12.75l.6-2.6 6.9-6.9a1.25 1.25 0 0 1 1.77 0l.73.73a1.25 1.25 0 0 1 0 1.77l-6.9 6.9Z' />
                    </svg>
                    <svg class='inline-edit-icon-check' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 16 16'>
                        <path d='m3.5 8.5 3 3 6-7' />
                    </svg>
                </span>
                <span aria-live='polite' class='inline-edit-label'>${() => local.live}</span>
            </div>
        `;
    },
    { editor: INLINE_EDIT_RICH_EDITOR, toolbar: INLINE_EDIT_RICH_TOOLBAR }
);
