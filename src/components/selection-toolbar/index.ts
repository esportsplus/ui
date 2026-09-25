import { component, html, type Attributes } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import { write } from '~/components/clipboard';
import './scss/index.scss';


type A = Attributes & {
    [SELECTION_TOOLBAR_EDITOR]?: Attributes;
    [SELECTION_TOOLBAR_TOOLBAR]?: Attributes;
    href?: string;
    label: string;
    onconnect?: never;
    ondisconnect?: never;
    ondocumentselectionchange?: never;
    onfocusout?: never;
    onwindowpointercancel?: never;
    onwindowpointerup?: never;
    state?: State;
};

type Action = Format | 'copy';

type Format = 'bold' | 'highlight' | 'italic' | 'link';

type State = { copied: boolean, open: boolean };


const ACTIONS: Action[] = ['bold', 'italic', 'link', 'highlight', 'copy'];

// Long enough to read the check, short enough to copy again right away.
const COPIED_FOR = 1400;

const FORMATS: Format[] = ['bold', 'italic', 'link', 'highlight'];

// Space between the selection and the toolbar.
const GAP = 8;

const LABELS: Record<Format, string> = {
    bold: 'Bold',
    highlight: 'Highlight',
    italic: 'Italic',
    link: 'Link'
};

const SELECTION_TOOLBAR_EDITOR = Symbol.for('@esportsplus/ui/selection-toolbar.editor');

const SELECTION_TOOLBAR_TOOLBAR = Symbol.for('@esportsplus/ui/selection-toolbar.toolbar');

const TAGS: Record<Format, string> = {
    bold: 'strong',
    highlight: 'mark',
    italic: 'em',
    link: 'a'
};


function closest(node: Node, tag: string, root: HTMLElement) {
    let element = node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement,
        found = element?.closest(tag);

    return found && found !== root && root.contains(found) ? found : null;
}

function icon(action: Action) {
    switch (action) {
        case 'bold':
            return html`
                <svg aria-hidden='true' class='selection-toolbar-icon' viewBox='0 0 16 16'>
                    <path d='M4.75 3.25h3.9a2.4 2.4 0 0 1 0 4.8h-3.9Zm0 4.8h4.6a2.35 2.35 0 0 1 0 4.7h-4.6Z' stroke-width='1.75' />
                </svg>
            `;
        case 'copy':
            return html`
                <span aria-hidden='true' class='selection-toolbar-swap'>
                    <svg class='selection-toolbar-icon selection-toolbar-icon--copy' viewBox='0 0 16 16'>
                        <rect x='5.25' y='5.25' width='8' height='8' rx='1.75' />
                        <path d='M10.75 5.25V4.5a1.75 1.75 0 0 0-1.75-1.75H4.5A1.75 1.75 0 0 0 2.75 4.5V9a1.75 1.75 0 0 0 1.75 1.75h.75' />
                    </svg>
                    <svg class='selection-toolbar-icon selection-toolbar-icon--check' viewBox='0 0 16 16'>
                        <path d='m3.5 8.5 3 3 6-7' />
                    </svg>
                </span>
            `;
        case 'highlight':
            return html`
                <svg aria-hidden='true' class='selection-toolbar-icon' viewBox='0 0 16 16'>
                    <path d='m9.75 2.75 3.5 3.5-5.5 5.5h-3.5v-3.5Z' />
                    <path d='M2.75 14.25h10.5' />
                </svg>
            `;
        case 'italic':
            return html`
                <svg aria-hidden='true' class='selection-toolbar-icon' viewBox='0 0 16 16'>
                    <path d='M7 3.25h5M4 12.75h5M9.5 3.25l-3 9.5' />
                </svg>
            `;
        default:
            return html`
                <svg aria-hidden='true' class='selection-toolbar-icon' viewBox='0 0 16 16'>
                    <path d='M7 9a2.5 2.5 0 0 0 3.54 0l2-2A2.5 2.5 0 0 0 9 3.46l-.5.5M9 7a2.5 2.5 0 0 0-3.54 0l-2 2A2.5 2.5 0 0 0 7 12.54l.5-.5' />
                </svg>
            `;
    }
}

function reduced() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function same(a: Range | null, b: Range) {
    return !!a
        && a.startContainer === b.startContainer
        && a.startOffset === b.startOffset
        && a.endContainer === b.endContainer
        && a.endOffset === b.endOffset;
}

function select(range: Range) {
    let selection = window.getSelection();

    selection?.removeAllRanges();
    selection?.addRange(range);
}

function unwrap(element: Element) {
    let parent = element.parentNode;

    if (!parent) {
        return;
    }

    while (element.firstChild) {
        parent.insertBefore(element.firstChild, element);
    }

    parent.removeChild(element);
}


export default Object.assign(
    component<A>(function(this, { href = '#', label, state = reactive({ copied: false, open: false }), ...attributes }, content) {
        let buttons: HTMLButtonElement[] = [],
            copyTimer: ReturnType<typeof setTimeout> | undefined,
            dismissed = false,
            editor: HTMLElement | undefined,
            focusIndex = 0,
            frame = 0,
            live = reactive({ text: '' }),
            observer: ResizeObserver | undefined,
            pressing = false,
            release: VoidFunction | undefined,
            root: HTMLElement | undefined,
            saved: Range | null = null,
            toolbar: HTMLElement | undefined;

        async function copy() {
            let range = current();

            if (!range) {
                return;
            }

            // Confirms on press; waiting for the write makes the click feel ignored.
            clearTimeout(copyTimer);
            state.copied = true;
            live.text = 'Copied';
            copyTimer = setTimeout(() => {
                state.copied = false;
            }, COPIED_FOR);

            if (!(await write(range.toString()))) {
                clearTimeout(copyTimer);
                state.copied = false;
                live.text = 'Couldn\'t copy';
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

        function focus(index: number) {
            focusIndex = (index + ACTIONS.length) % ACTIONS.length;
            roving();
            buttons[focusIndex]?.focus();
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

        function show(next: boolean, instant = false) {
            state.open = next;

            if (!toolbar) {
                return;
            }

            toolbar.classList.toggle('--active', next);
            toolbar.classList.toggle('selection-toolbar-toolbar--instant', instant);
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

                if (state.open) {
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

            // Flips below when there's no room above inside the host or on screen.
            let below = first.top - box.top < h + GAP || first.top < h + GAP,
                center = bounds.left + bounds.width / 2 - box.left;

            let left = Math.min(Math.max(center - w / 2, 0), box.width - w),
                top = below ? last.bottom - box.top + GAP : first.top - box.top - h - GAP;

            // Scales out of the selection itself, even when clamped to the edge.
            toolbar.style.transformOrigin = `${center - left}px ${below ? 0 : h}px`;

            if (!state.open || reduced()) {
                toolbar.classList.add('selection-toolbar-toolbar--jump');
                toolbar.style.translate = `${left}px ${top}px`;
                void toolbar.offsetWidth;
                toolbar.classList.remove('selection-toolbar-toolbar--jump');
            }
            else {
                toolbar.style.translate = `${left}px ${top}px`;
            }

            for (let i = 0, n = FORMATS.length; i < n; i++) {
                let start = closest(range.startContainer, TAGS[FORMATS[i]], editor);

                buttons[i]?.setAttribute('aria-pressed', start && start === closest(range.endContainer, TAGS[FORMATS[i]], editor) ? 'true' : 'false');
            }

            if (!state.open) {
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
                live.text = `${LABELS[format]} off`;
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
                live.text = `${LABELS[format]} on`;
            }

            // Splitting a partly selected mark can leave an empty shell behind.
            editor.querySelectorAll(Object.values(TAGS).join(',')).forEach((element) => {
                if (!element.textContent) {
                    element.remove();
                }
            });

            select(next);
        }

        return html`
            <div
                class='selection-toolbar'
                ${this?.attributes}
                ${attributes}
                ${{
                    onconnect: (element: HTMLElement) => {
                        root = element;
                        editor = element.querySelector<HTMLElement>('.selection-toolbar-editor') ?? undefined;
                        toolbar = element.querySelector<HTMLElement>('.selection-toolbar-toolbar') ?? undefined;
                        buttons = [...element.querySelectorAll<HTMLButtonElement>('.selection-toolbar-button')];

                        for (let i = 0, n = FORMATS.length; i < n; i++) {
                            buttons[i]?.setAttribute('aria-pressed', 'false');
                        }

                        // Keeps the text selected and focused when a button is clicked;
                        // delegated mousedown listeners are passive, so this one is bound directly.
                        let bar = toolbar,
                            prevent = (e: MouseEvent) => e.preventDefault();

                        bar?.addEventListener('mousedown', prevent);
                        release = () => bar?.removeEventListener('mousedown', prevent);
                        observer = new ResizeObserver(sync);
                        observer.observe(element);
                        roving();
                    },
                    ondisconnect: () => {
                        cancelAnimationFrame(frame);
                        clearTimeout(copyTimer);
                        observer?.disconnect();
                        release?.();
                    },
                    ondocumentselectionchange: sync,
                    onfocusout: (e: FocusEvent) => {
                        // Focus leaving both the text and the toolbar takes the toolbar along.
                        if (state.open && !root?.contains(e.relatedTarget as Node | null)) {
                            show(false);
                        }
                    },
                    onwindowpointercancel: settle,
                    onwindowpointerup: settle
                }}
            >
                <div
                    aria-label='${label}'
                    aria-multiline='true'
                    class='selection-toolbar-editor'
                    contenteditable='true'
                    role='textbox'
                    spellcheck='false'
                    ${{
                        onkeydown: (e: KeyboardEvent) => {
                            let mod = e.metaKey || e.ctrlKey;

                            if (mod && !e.altKey && (e.key === 'b' || e.key === 'i')) {
                                // Same path as the buttons, so the shortcut animates the toolbar like a click.
                                e.preventDefault();

                                if (current()) {
                                    toggle(e.key === 'b' ? 'bold' : 'italic');
                                }

                                return;
                            }

                            if (e.key === 'Escape' && state.open) {
                                e.preventDefault();
                                dismiss();
                                return;
                            }

                            if (state.open && !mod && (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Enter')) {
                                show(false, true);
                            }
                        },
                        onpointerdown: (e: PointerEvent) => {
                            if (e.button === 0) {
                                pressing = true;
                            }
                        },
                        onscroll: sync
                    }}
                    ${this?.attributes?.[SELECTION_TOOLBAR_EDITOR]}
                    ${attributes[SELECTION_TOOLBAR_EDITOR]}
                >
                    ${content}
                </div>

                <div
                    aria-hidden='true'
                    aria-label='Formatting'
                    class='selection-toolbar-toolbar'
                    inert
                    role='toolbar'
                    ${{
                        onkeydown: (e: KeyboardEvent) => {
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
                    }}
                    ${this?.attributes?.[SELECTION_TOOLBAR_TOOLBAR]}
                    ${attributes[SELECTION_TOOLBAR_TOOLBAR]}
                >
                    ${ACTIONS.map((action, i) => html`
                        ${action === 'copy' ? html`<span aria-hidden='true' class='selection-toolbar-divider'></span>` : ''}
                        <button
                            aria-label='${action === 'copy' ? 'Copy' : LABELS[action]}'
                            class='button selection-toolbar-button ${() => action === 'copy' && state.copied && '--active'}'
                            tabindex='-1'
                            type='button'
                            ${{
                                onclick: () => {
                                    if (action === 'copy') {
                                        void copy();
                                    }
                                    else {
                                        toggle(action);
                                    }
                                },
                                onfocus: () => {
                                    focusIndex = i;
                                    roving();
                                }
                            }}
                        >
                            ${icon(action)}
                        </button>
                    `)}
                </div>

                <span aria-live='polite' class='selection-toolbar-live'>${() => live.text}</span>
            </div>
        `;
    }),
    { editor: SELECTION_TOOLBAR_EDITOR, toolbar: SELECTION_TOOLBAR_TOOLBAR } as const
);
