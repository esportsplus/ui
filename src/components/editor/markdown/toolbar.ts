import { effect, flush, reactive, untrack } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import faces from '~/components/button/faces';
import clipboard from '~/components/clipboard/write';
import icon from '~/components/icon';
import input from '~/components/input';
import selectInput from '~/components/select';
import toolbar, { type Entry } from '~/components/toolbar';
import { finished } from '~/shared/animation';
import { clamp } from '~/shared/clamp';
import { mac } from '~/shared/platform';
import { viewport } from '~/shared/viewport';
import { safeUrl } from './inline';
import type { BlockKind, Formats, Mark } from './format';
import boldSvg from '@esportsplus/ui/svg/bold.svg';
import checkSvg from '@esportsplus/ui/svg/check.svg';
import clearSvg from '@esportsplus/ui/svg/clear-format.svg';
import closeSvg from '@esportsplus/ui/svg/close.svg';
import codeSvg from '@esportsplus/ui/svg/code.svg';
import copySvg from '@esportsplus/ui/svg/copy.svg';
import highlightSvg from '@esportsplus/ui/svg/highlight.svg';
import italicSvg from '@esportsplus/ui/svg/italic.svg';
import linkSvg from '@esportsplus/ui/svg/link.svg';
import openSvg from '@esportsplus/ui/svg/external-link.svg';
import strikeSvg from '@esportsplus/ui/svg/strikethrough.svg';
import unlinkSvg from '@esportsplus/ui/svg/unlink.svg';
import '~/components/button/scss/index.scss';
import '~/components/select/scss/index.scss';


type Action = Mark | 'clear' | 'copy' | 'link';

// What the toolbar asks of the editor it formats.
type Host = {
    block: (kind: BlockKind) => boolean;
    clear: () => boolean;
    // The selection's markdown.
    copy: () => string;
    // Back to the text, with its selection.
    focus: () => void;
    formats: () => Formats;
    link: (href: string | null) => boolean;
    mark: (mark: Mark) => boolean;
    // The drawn selection, while the text holds focus and something is selected.
    range: () => Range | null;
    // Whether the text holds focus with something selected, drawn or about to be.
    selected: () => boolean;
    selection: () => { end: number; start: number };
};

// The tools a toolbar may offer: its marks, the link, clearing and copying, and the kinds of block it can turn lines into.
type Tool = Action | 'bullet' | 'codeblock' | 'heading' | 'ordered' | 'quote' | 'task';


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

// Long enough to read the check, short enough to copy again right away.
const COPIED_FOR = 1400;

const EMAIL = /^[^\s/@]+@[^\s/@]+\.[^\s/@]+$/;

// Space between the selection and the toolbar, and between the toolbar and the viewport's edge.
const GAP = 8;

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

const KINDS: { label: string, tool?: Tool, value: BlockKind }[] = [
    { label: 'Text', value: 'paragraph' },
    { label: 'Heading 1', tool: 'heading', value: 'h1' },
    { label: 'Heading 2', tool: 'heading', value: 'h2' },
    { label: 'Heading 3', tool: 'heading', value: 'h3' },
    { label: 'Quote', tool: 'quote', value: 'quote' },
    { label: 'Code block', tool: 'codeblock', value: 'codeblock' },
    { label: 'Bulleted list', tool: 'bullet', value: 'bullet' },
    { label: 'Numbered list', tool: 'ordered', value: 'ordered' },
    { label: 'Checklist', tool: 'task', value: 'task' }
];

const MAC_SHORTCUT = /(⇧?)(\w)$/;

const RELATIVE_URL = /^[/#?]/;

// Long enough that labels only show once the pointer rests, so passing across the toolbar stays quiet.
const TOOLTIP_DELAY = 700;

const URL_SCHEME = /^[a-z][a-z\d+.-]*:/i;


// What was typed into the link field, as an address: a bare domain gets https, a bare email mailto.
function address(value: string) {
    let href = value.trim();

    if (href && !URL_SCHEME.test(href) && !RELATIVE_URL.test(href)) {
        href = (EMAIL.test(href) ? 'mailto:' : 'https://') + href;
    }

    return (href && safeUrl(href)) || '';
}

function glyph(name: Exclude<Action, 'copy'> | 'apply' | 'open' | 'unlink') {
    return icon({ 'aria-hidden': 'true', class: 'markdown-editor-toolbar-icon' }, ICONS[name]);
}

// A shortcut as 'aria-keyshortcuts' names it.
function chord(shortcut: string) {
    return `${mac() ? 'Meta' : 'Control'}+${shortcut}`;
}

function hint(label: string, shortcut?: string) {
    if (!shortcut) {
        return label;
    }

    return mac()
        ? `${label} ${shortcut.replace('Shift+', '⇧')}`.replace(MAC_SHORTCUT, '$1⌘$2')
        : `${label} Ctrl+${shortcut}`;
}


// The formatting toolbar: it floats over the selection in the top layer, so nothing around the editor clips or covers
// it, and offers the tools it was given as a 'toolbar', which roves the arrow keys between them. Shown once a selection
// settles, never while a press is still dragging one out.
const formatting = (host: Host) => {
    let apple = mac(),
        block = reactive({ active: false, error: '', selected: 'paragraph' }),
        hyperlink = reactive({ existing: false, invalid: false, url: '' }),
        local = reactive({ copied: 'idle' as 'error' | 'idle' | 'success', live: '' }),
        // 'link' swaps the buttons for the link field, 'instant' holds the toolbar still, 'origin' and 'x'/'y' place it.
        panel = reactive({ instant: false, link: false, open: false, origin: '', x: 0, y: 0 }),
        pressed = reactive({ bold: false, code: false, highlight: false, italic: false, strike: false } as Record<Mark, boolean>);

    let bar: HTMLElement | undefined,
        copyTimer: ReturnType<typeof setTimeout> | undefined,
        // The selection a dismissal closed the toolbar on; it stays closed until the selection changes.
        dismissed: { end: number; start: number } | null = null,
        enabled = new Set<Tool>(),
        hiding = 0,
        layer: HTMLElement | undefined,
        pressing = false,
        shown: BlockKind = 'paragraph',
        url: HTMLInputElement | undefined;

    // The select only reports a value; one that differs from the block under the selection is a choice.
    effect(() => {
        let next = block.selected as BlockKind;

        if (next !== shown) {
            untrack(() => {
                shown = next;
                host.focus();
                host.block(next);
            });
        }
    });

    function apply(value: string | null) {
        let href = value === null ? null : address(value);

        if (href === '') {
            hyperlink.invalid = true;
            return;
        }

        back();
        host.link(href);
        local.live = href ? 'Link set' : 'Link removed';
    }

    // Leaves the link field for the buttons, handing focus back to the text.
    function back() {
        panel.link = false;
        host.focus();
    }

    async function copy() {
        // Confirms on press; waiting for the write makes the click feel ignored.
        clearTimeout(copyTimer);
        local.copied = 'success';
        local.live = 'Copied';
        copyTimer = setTimeout(() => {
            local.copied = 'idle';
        }, COPIED_FOR);

        if (!(await clipboard(host.copy()))) {
            local.copied = 'error';
            local.live = 'Couldn\'t copy';
        }
    }

    function dismiss() {
        dismissed = host.selection();
        show(false);
    }

    function inspect() {
        let formats = host.formats();

        for (let mark in pressed) {
            pressed[mark as Mark] = formats.marks[mark as Mark];
        }

        shown = formats.block ?? 'paragraph';
        block.selected = shown;
        hyperlink.existing = formats.link !== null;
        hyperlink.url = formats.link ?? '';
    }

    function linker() {
        let formats = host.formats();

        panel.link = true;
        hyperlink.existing = formats.link !== null;
        hyperlink.invalid = false;
        hyperlink.url = formats.link ?? '';

        // The field shows, and takes its value, once the link mode lands.
        flush();
        url?.focus({ preventScroll: true });
        url?.select();
    }

    // Out of the top layer once the close has played out, unless it opened again meanwhile.
    function lower() {
        let current = ++hiding;

        if (!layer) {
            return;
        }

        void finished(layer, { subtree: true }).then(() => {
            if (current === hiding && !panel.open && layer?.matches(':popover-open')) {
                layer.hidePopover();
            }
        });
    }

    // The arrow keys are the toolbar's; Enter and Escape in the link field, and Escape elsewhere, are the editor's.
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

        if (e.key === 'Escape' && !block.active) {
            e.preventDefault();
            dismiss();
            host.focus();
        }
    }

    // Floats over the selection, flipping below it when there's no room above; only the viewport bounds it.
    function place(range: Range) {
        if (!bar) {
            return;
        }

        let bounds = range.getBoundingClientRect(),
            h = bar.offsetHeight,
            lines = [...range.getClientRects()].filter((rect) => rect.width > 0),
            w = bar.offsetWidth;

        let first = lines[0] ?? bounds,
            last = lines[lines.length - 1] ?? bounds,
            below = first.top < h + GAP,
            center = bounds.left + bounds.width / 2,
            x = clamp(center - w / 2, GAP, Math.max(GAP, viewport().width - w - GAP));

        // Scales out of the selection itself, even when held off the edge.
        panel.origin = `${center - x}px ${below ? 0 : h}px`;
        panel.x = x;
        panel.y = below ? last.bottom + GAP : first.top - h - GAP;

        // Shown afresh it jumps there, committed before its moves glide again; once open it glides along.
        if (!panel.open) {
            panel.instant = true;
            flush();
            void bar.offsetWidth;
            panel.instant = false;
        }
    }

    // Into the top layer before anything measures it, since it lays out only once it shows.
    function raise() {
        hiding++;

        if (layer && !layer.matches(':popover-open')) {
            layer.showPopover();
        }
    }

    // Follows the selection: shown over one that settled, closed once it collapses or the text loses focus. Focus in
    // the toolbar itself (its buttons, the select, the link field) holds it where it is.
    function refresh() {
        if (!bar || !enabled.size || bar.contains(bar.ownerDocument.activeElement)) {
            return;
        }

        if (!host.selected()) {
            dismissed = null;

            if (panel.open) {
                show(false);
            }

            return;
        }

        // A block drawn afresh takes the selection a frame later; the toolbar stays put until it has.
        let range = host.range();

        if (!range) {
            return;
        }

        if (pressing) {
            return;
        }

        let { end, start } = host.selection();

        if (dismissed) {
            if (dismissed.start === start && dismissed.end === end) {
                return;
            }

            dismissed = null;
        }

        raise();
        place(range);
        inspect();

        if (!panel.open) {
            show(true);
        }
    }

    function show(next: boolean) {
        panel.open = next;

        if (!next) {
            panel.link = false;
            lower();
        }
    }

    // Runs a tool's shortcut, when it is one of this toolbar's.
    function shortcut(e: KeyboardEvent) {
        if (!(apple ? e.metaKey : e.ctrlKey) || e.altKey) {
            return false;
        }

        let chord = (e.shiftKey ? 'shift+' : '') + e.key.toLowerCase(),
            found = ACTIONS.find(({ shortcut }) => shortcut?.toLowerCase() === chord);

        if (!found || !enabled.has(found.action)) {
            return false;
        }

        trigger(found.action);

        return true;
    }

    function trigger(action: Action) {
        switch (action) {
            case 'clear':
                if (host.clear()) {
                    local.live = 'Formatting cleared';
                }

                break;
            case 'copy':
                void copy();
                return;
            case 'link':
                if (host.range()) {
                    linker();
                }

                return;
            default:
                host.mark(action);
        }

        inspect();
    }

    let template = (tools: readonly Tool[]) => {
        enabled = new Set(tools);

        let actions = ACTIONS.filter(({ action }) => enabled.has(action)),
            kinds = KINDS.filter(({ tool }) => !tool || enabled.has(tool)),
            marks = actions.filter(({ action }) => action !== 'clear' && action !== 'copy'),
            rest = actions.filter(({ action }) => action === 'clear' || action === 'copy');

        if (!actions.length && kinds.length < 2) {
            enabled.clear();
            return '';
        }

        // Marks show whether they're on; copy confirms on its face and in its hint.
        let control = ({ action, label, shortcut }: (typeof ACTIONS)[number]) => toolbar.button({
            ...(action === 'clear' || action === 'copy' || action === 'link' ? {} : { 'aria-pressed': () => pressed[action] ? 'true' : 'false' }),
            'aria-keyshortcuts': shortcut && chord(shortcut),
            hint: action === 'copy' ? () => local.copied === 'success' ? 'Copied' : label : hint(label, shortcut),
            icon: action === 'copy'
                ? () => faces(() => local.copied, [
                    { content: icon({ 'aria-hidden': 'true', class: 'button-icon' }, copySvg), key: 'idle' },
                    { content: icon({ 'aria-hidden': 'true', class: 'button-icon button-icon--draw' }, checkSvg), key: 'success', tone: 'success' },
                    { content: icon({ 'aria-hidden': 'true', class: 'button-icon button-icon--draw' }, closeSvg), key: 'error', tone: 'error' }
                ])
                : () => glyph(action as Exclude<Action, 'copy'>),
            label,
            onclick: () => trigger(action)
        });

        let format: Entry[] = [];

        if (kinds.length > 1) {
            format.push(toolbar.item(() => selectInput({
                class: 'markdown-editor-toolbar-block',
                label: 'Text style',
                options: kinds.map(({ label, value }) => ({ label, value })),
                state: block
            })));

            if (actions.length) {
                format.push(toolbar.divider());
            }
        }

        format.push(...marks.map(control));

        if (marks.length && rest.length) {
            format.push(toolbar.divider());
        }

        format.push(...rest.map(control));

        return html`
            <div
                class='tooltip tooltip--context markdown-editor-toolbar-layer'
                popover='manual'
                ${{
                    class: () => panel.open && '--active',
                    onconnect: (element: HTMLElement) => {
                        layer = element;
                    },
                    ondisconnect: () => {
                        clearTimeout(copyTimer);
                        layer = undefined;
                    },
                    onwindowpointercancel: () => {
                        pressing = false;
                    },
                    // The selection finalises after the release, so it is read a frame later.
                    onwindowpointerup: () => {
                        if (pressing) {
                            pressing = false;
                            requestAnimationFrame(refresh);
                        }
                    }
                }}
            >
                <div
                    class='tooltip-content tooltip-content--context markdown-editor-toolbar'
                    ${{
                        'aria-hidden': () => panel.open ? 'false' : 'true',
                        class: [
                            () => panel.instant && 'markdown-editor-toolbar--instant',
                            () => panel.link && 'markdown-editor-toolbar--link'
                        ],
                        inert: () => !panel.open,
                        onconnect: (element: HTMLElement, on) => {
                            bar = element;
                            // Direct: delegation only runs the nearest bound handler, which for the select is its own.
                            on(element, 'keydown', navigate, { direct: true });
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
                    ${toolbar({ class: 'markdown-editor-toolbar-format', delay: TOOLTIP_DELAY, items: format, label: 'Formatting' })}
                    ${enabled.has('link') && toolbar({
                        class: 'markdown-editor-toolbar-link',
                        delay: TOOLTIP_DELAY,
                        items: [
                            toolbar.item(() => input({
                                'aria-invalid': () => hyperlink.invalid && 'true',
                                'aria-label': 'Link address',
                                class: 'markdown-editor-toolbar-url',
                                onconnect: (element: HTMLInputElement) => {
                                    url = element;
                                },
                                oninput: (e: Event) => {
                                    hyperlink.invalid = false;
                                    hyperlink.url = (e.currentTarget as HTMLInputElement).value;
                                },
                                placeholder: 'Paste or type a link',
                                type: 'url',
                                value: () => hyperlink.url
                            })),
                            toolbar.button({ icon: () => glyph('apply'), label: 'Apply link', onclick: () => apply(hyperlink.url) }),
                            toolbar.button({
                                icon: () => glyph('open'),
                                label: 'Open link in a new tab',
                                onclick: () => {
                                    let href = address(hyperlink.url);

                                    if (href) {
                                        window.open(href, '_blank', 'noopener');
                                    }
                                }
                            }),
                            toolbar.button({ hidden: () => !hyperlink.existing, icon: () => glyph('unlink'), label: 'Remove link', onclick: () => apply(null) })
                        ],
                        label: 'Link'
                    })}
                    <span aria-live='polite' class='markdown-editor-toolbar-live'>${() => local.live}</span>
                </div>
            </div>
        `;
    };

    return {
        contains: (node: Node | null) => !!node && !!layer?.contains(node),
        dismiss,
        get open() {
            return panel.open;
        },
        // A press in the text drags a selection out; the toolbar waits for its release.
        press: () => {
            pressing = true;
        },
        refresh,
        shortcut,
        template
    };
};


export { formatting as toolbar };
export type { Host, Tool };
