import { reactive } from '@esportsplus/reactivity';
import { html, text, type Renderable } from '@esportsplus/template';
import checkbox from '~/components/checkbox';
import icon from '~/components/icon';
import { sanitizeHtml, type SafeNode } from './html';
import { clipInline, type Inline } from './inline';
import type { Unit } from './layout';
import type { MarkdownBlock, Row } from './model';
import chevron from '@esportsplus/ui/svg/chevron-down.svg';


// A run of source text drawn as one text node, 'from' relative to its block so it survives the block shifting.
type Segment = { block: MarkdownBlock; from: number; node: Text };

// Per drawn unit: its segments in order and whether its fold marker shows.
type View = { segments: Segment[]; state: { foldable: boolean } };

type Host = {
    // Turns a block's fold marker.
    fold: (unit: Unit) => void;
    // Whether a unit opens a fold, for its marker.
    foldable: (unit: Unit) => boolean;
    // Inline markup of a block, offsets relative to its start.
    inline: (block: MarkdownBlock) => readonly Inline[];
    readonly: () => boolean;
    // The unit's element connected or left.
    shown: (element: HTMLElement, unit: Unit | null) => void;
    task: (block: MarkdownBlock) => void;
    // Text of the document the unit was drawn from.
    text: () => string;
    unfold: (unit: Unit) => void;
};


const CARRIAGE_RETURN = /\r$/;

// A fence's opening line: everything up to its info string, which shows and edits as the block's label.
const FENCE_OPEN = /^[ \t>]*(?:`{3,}|~{3,})/;

const ORDERED = /^\d/;


let parser: DOMParser | undefined;


// Each non-empty line of [from, to), relative to 'base', as 'Row's.
function lines(text: string, from: number, to: number, base: number) {
    let out: Row[] = [];

    for (let cursor = from; cursor <= to;) {
        let end = cursor;

        while (end < to && text.charCodeAt(end) !== 10 && text.charCodeAt(end) !== 13) {
            end++;
        }

        out.push({ contentFrom: cursor - base, contentTo: end - base, from: cursor - base, to: end - base });

        if (end >= to) {
            break;
        }

        cursor = end + (text.charCodeAt(end) === 13 && text.charCodeAt(end + 1) === 10 ? 2 : 1);
    }

    return out;
}

function prevent(e: Event) {
    e.preventDefault();
}

function safe(nodes: readonly SafeNode[]): Renderable<unknown>[] {
    let out: Renderable<unknown>[] = [];

    for (let i = 0, n = nodes.length; i < n; i++) {
        let node = nodes[i];

        if (typeof node === 'string') {
            out.push(node);
            continue;
        }

        let { attributes, children } = node,
            content = safe(children);

        // Static tags let the template compiler own every node; nothing from the source is markup.
        switch (node.tag) {
            case 'a':
                out.push(html`<a class='markdown-editor-link' rel='noopener noreferrer' ${attributes}>${content}</a>`);
                break;
            case 'blockquote':
                out.push(html`<blockquote class='markdown-editor-quote' ${attributes}>${content}</blockquote>`);
                break;
            case 'br':
                out.push(html`<br>`);
                break;
            case 'code':
                out.push(html`<code class='markdown-editor-code' ${attributes}>${content}</code>`);
                break;
            case 'details':
                out.push(html`<details ${attributes}>${content}</details>`);
                break;
            case 'div':
                out.push(html`<div ${attributes}>${content}</div>`);
                break;
            case 'em':
                out.push(html`<em class='markdown-editor-em' ${attributes}>${content}</em>`);
                break;
            case 'h1':
                out.push(html`<h1 class='markdown-editor-heading markdown-editor-heading--h1' ${attributes}>${content}</h1>`);
                break;
            case 'h2':
                out.push(html`<h2 class='markdown-editor-heading markdown-editor-heading--h2' ${attributes}>${content}</h2>`);
                break;
            case 'h3':
                out.push(html`<h3 class='markdown-editor-heading markdown-editor-heading--h3' ${attributes}>${content}</h3>`);
                break;
            case 'h4':
                out.push(html`<h4 class='markdown-editor-heading markdown-editor-heading--h4' ${attributes}>${content}</h4>`);
                break;
            case 'h5':
                out.push(html`<h5 class='markdown-editor-heading markdown-editor-heading--h5' ${attributes}>${content}</h5>`);
                break;
            case 'h6':
                out.push(html`<h6 class='markdown-editor-heading markdown-editor-heading--h6' ${attributes}>${content}</h6>`);
                break;
            case 'hr':
                out.push(html`<hr class='markdown-editor-rule'>`);
                break;
            case 'img':
                out.push(html`<img class='markdown-editor-image' loading='lazy' ${attributes}>`);
                break;
            case 'li':
                out.push(html`<li ${attributes}>${content}</li>`);
                break;
            case 'ol':
                out.push(html`<ol class='markdown-editor-list' ${attributes}>${content}</ol>`);
                break;
            case 'p':
                out.push(html`<p class='markdown-editor-paragraph' ${attributes}>${content}</p>`);
                break;
            case 'pre':
                out.push(html`<pre class='markdown-editor-pre' ${attributes}>${content}</pre>`);
                break;
            case 's':
                out.push(html`<s class='markdown-editor-strike' ${attributes}>${content}</s>`);
                break;
            case 'span':
                out.push(html`<span ${attributes}>${content}</span>`);
                break;
            case 'strong':
                out.push(html`<strong class='markdown-editor-strong' ${attributes}>${content}</strong>`);
                break;
            case 'sub':
                out.push(html`<sub ${attributes}>${content}</sub>`);
                break;
            case 'summary':
                // A press on the summary toggles its details instead of opening the block's source.
                out.push(html`<summary class='markdown-editor-summary' ${attributes} ${{ onmousedown: prevent }}>${icon({ 'aria-hidden': 'true', class: 'markdown-editor-summary-icon' }, chevron)}${content}</summary>`);
                break;
            case 'sup':
                out.push(html`<sup ${attributes}>${content}</sup>`);
                break;
            case 'table':
                out.push(html`<table class='markdown-editor-table' ${attributes}>${content}</table>`);
                break;
            case 'tbody':
                out.push(html`<tbody ${attributes}>${content}</tbody>`);
                break;
            case 'td':
                out.push(html`<td class='markdown-editor-cell' ${attributes}>${content}</td>`);
                break;
            case 'th':
                out.push(html`<th class='markdown-editor-cell markdown-editor-cell--head' ${attributes}>${content}</th>`);
                break;
            case 'thead':
                out.push(html`<thead ${attributes}>${content}</thead>`);
                break;
            case 'tr':
                out.push(html`<tr ${attributes}>${content}</tr>`);
                break;
            case 'ul':
                out.push(html`<ul class='markdown-editor-list' ${attributes}>${content}</ul>`);
                break;
        }
    }

    return out;
}


// How units draw. Every run of source text is a text node the view knows the offset of, so a point maps back to the
// source without reading anything from the DOM but the node under it.
const renderer = (host: Host) => {
    // A toggled task's state before the toggle, by block start; a toggle never moves the block.
    let flips = new Map<number, boolean>(),
        segments = new WeakMap<Text, Segment>(),
        views = new Map<Unit, View>();

    function body(unit: Unit, view: View): Renderable<unknown> {
        let block = unit.block,
            source = host.text();

        if (unit.raw) {
            return plain(block, unit.rows ?? lines(source, block.from, block.contentTo, block.from), view);
        }

        if (unit.fold) {
            let first = lines(source, block.from, block.contentTo, block.from).slice(0, 1),
                chip = html`
                    <button
                        aria-label='Unfold block'
                        class='markdown-editor-chip'
                        contenteditable='false'
                        type='button'
                        ${{ onclick: () => host.unfold(unit), onmousedown: prevent }}
                    >
                        … ${unit.fold.endLine - unit.fold.line} lines
                    </button>
                `;

            return [block.kind === 'heading' ? marked(block, undefined, view) : plain(block, first, view), chip];
        }

        switch (block.kind) {
            case 'blank':
                return html`<br>`;
            case 'code':
                return html`
                    <pre class='markdown-editor-pre'><code class='markdown-editor-code markdown-editor-code--block'>${plain(block, unit.rows ?? relative(block), view, true)}</code></pre>
                `;
            case 'fence':
                return html`
                    <pre class='markdown-editor-pre'>${unit.continuation ? '' : info(block, view)}<code class='markdown-editor-code markdown-editor-code--block'>${plain(block, unit.rows ?? relative(block), view, true)}</code></pre>
                `;
            case 'frontmatter':
                return html`
                    <pre class='markdown-editor-pre markdown-editor-frontmatter'><code class='markdown-editor-code markdown-editor-code--block'>${plain(block, lines(source, block.contentFrom, block.contentTo, block.from), view, true)}</code></pre>
                `;
            case 'html':
                parser ??= new DOMParser();

                // Rendered HTML has no source to type into; it selects and deletes as a whole.
                return html`<div contenteditable='false'>${safe(sanitizeHtml(source.slice(block.contentFrom, block.contentTo), parser))}</div>`;
            case 'list': {
                let content = marked(block, unit.rows ?? block.lines?.map((row) => relativeRow(block, row)), view);

                if (unit.continuation) {
                    return content;
                }

                if (block.task) {
                    return task(block, block.task.checked, content);
                }

                return [
                    html`<span class='markdown-editor-marker' contenteditable='false'>${ORDERED.test(block.marker ?? '') ? block.marker : '•'}</span>`,
                    content
                ];
            }
            case 'rule':
                return html`<hr class='markdown-editor-rule' contenteditable='false'>`;
            default:
                return marked(block, unit.rows ?? block.lines?.map((row) => relativeRow(block, row)), view);
        }
    }

    function inline(tokens: readonly Inline[], block: MarkdownBlock, view: View): Renderable<unknown>[] {
        let out: Renderable<unknown>[] = [];

        for (let i = 0, n = tokens.length; i < n; i++) {
            let token = tokens[i],
                content = token.children ? inline(token.children, block, view) : piece(token.text, block, token.from, view);

            switch (token.kind) {
                case 'code':
                    out.push(html`<code class='markdown-editor-code'>${content}</code>`);
                    break;
                case 'em':
                    out.push(html`<em class='markdown-editor-em'>${content}</em>`);
                    break;
                case 'link':
                    out.push(
                        token.href
                            ? html`<a class='markdown-editor-link' href='${token.href}' rel='noopener noreferrer'>${content}</a>`
                            : html`<span class='markdown-editor-link'>${content}</span>`
                    );
                    break;
                case 'strike':
                    out.push(html`<s class='markdown-editor-strike'>${content}</s>`);
                    break;
                case 'strong':
                    out.push(html`<strong class='markdown-editor-strong'>${content}</strong>`);
                    break;
                default:
                    out.push(content);
            }
        }

        return out;
    }

    // A fence's info string, the language label over its code.
    function info(block: MarkdownBlock, view: View) {
        let source = host.text(),
            end = source.indexOf('\n', block.from),
            line = source.slice(block.from, end < 0 ? source.length : end).replace(CARRIAGE_RETURN, ''),
            from = FENCE_OPEN.exec(line)?.[0].length ?? line.length;

        return html`<span class='markdown-editor-info'>${piece(line.slice(from), block, from, view)}</span>`;
    }

    // Inline markup of rows, joined by line breaks. Without any, a line break gives the caret a line to sit on.
    function marked(block: MarkdownBlock, rows: readonly Row[] | undefined, view: View) {
        let tokens = host.inline(block);

        if (!tokens.length) {
            return html`<br>`;
        }

        if (!rows) {
            return inline(tokens, block, view);
        }

        let out: Renderable<unknown>[] = [];

        for (let i = 0, n = rows.length; i < n; i++) {
            if (i) {
                out.push('\n');
            }

            out.push(inline(clipInline(tokens, rows[i].contentFrom, rows[i].contentTo), block, view));
        }

        return out;
    }

    function piece(value: string, block: MarkdownBlock, from: number, view: View) {
        let node = text(value),
            segment = { block, from, node };

        segments.set(node, segment);
        view.segments.push(segment);

        return node;
    }

    // Source text of rows, one text node per line.
    function plain(block: MarkdownBlock, rows: readonly Row[], view: View, content = false) {
        let out: Renderable<unknown>[] = [],
            source = host.text();

        for (let i = 0, n = rows.length; i < n; i++) {
            let from = content ? rows[i].contentFrom : rows[i].from,
                to = rows[i].contentTo;

            if (i) {
                out.push('\n');
            }

            out.push(piece(source.slice(block.from + from, block.from + to), block, from, view));
        }

        return out;
    }

    function relative(block: MarkdownBlock) {
        let out: Row[] = [],
            rows = block.lines ?? [];

        for (let i = 0, n = rows.length; i < n; i++) {
            out.push(relativeRow(block, rows[i]));
        }

        return out;
    }

    function relativeRow(block: MarkdownBlock, row: Row): Row {
        let base = block.from;

        return { contentFrom: row.contentFrom - base, contentTo: row.contentTo - base, from: row.from - base, to: row.to - base };
    }

    // A task's checkbox stands in for its bullet, and its label strikes the text through. Toggling redraws the block, so
    // both paint the old state first and then flip, letting their own transitions play.
    function task(block: MarkdownBlock, checked: boolean, content: Renderable<unknown>) {
        let previous = flips.get(block.from),
            animate = previous !== undefined && previous !== checked,
            state = reactive({ done: animate ? !!previous : checked });

        flips.delete(block.from);

        return [
            checkbox({
                class: 'markdown-editor-task',
                contenteditable: 'false',
                onfirstpaint: (element: HTMLElement) => {
                    let input = element.querySelector('input');

                    if (animate && input) {
                        input.checked = checked;
                        state.done = checked;
                    }
                },
                [checkbox.input]: {
                    'aria-label': 'Toggle task',
                    checked: animate ? previous : checked,
                    disabled: () => host.readonly(),
                    onclick: (e: MouseEvent) => {
                        e.preventDefault();
                        flips.set(block.from, checked);
                        host.task(block);
                    },
                    onmousedown: prevent
                }
            }),
            html`<span class='markdown-editor-label' ${{ class: () => state.done && 'markdown-editor-label--done' }}>${content}</span>`
        ];
    }

    return {
        // The text node and the source offset it stands for, under a node and an offset into it from a caret query.
        offset: (node: Node | null, offset: number) => {
            let segment = node && segments.get(node as Text);

            if (!segment) {
                return null;
            }

            return segment.block.from + segment.from + Math.min(offset, segment.node.length);
        },
        // Segments of a drawn unit, in source order.
        segments: (unit: Unit) => views.get(unit)?.segments ?? null,
        state: (unit: Unit) => views.get(unit)?.state ?? null,
        template: (unit: Unit) => {
            let block = unit.block,
                view: View = { segments: [], state: reactive({ foldable: host.foldable(unit) }) },
                content = body(unit, view);

            views.set(unit, view);

            return html`
                <div
                    class='markdown-editor-block markdown-editor-block--${block.kind}'
                    ${{
                        class: [
                            block.level ? `markdown-editor-block--h${block.level}` : '',
                            block.quoteDepth ? 'markdown-editor-block--quoted' : '',
                            unit.continuation ? 'markdown-editor-block--continuation' : '',
                            unit.continues ? 'markdown-editor-block--continues' : '',
                            block.task && !unit.continuation ? 'markdown-editor-block--task' : '',
                            unit.raw || unit.fold ? 'markdown-editor-block--raw' : ''
                        ],
                        onconnect: (element: HTMLElement) => host.shown(element, unit),
                        ondisconnect: (element: HTMLElement) => {
                            if (views.get(unit) === view) {
                                views.delete(unit);
                            }

                            host.shown(element, null);
                        },
                        style: `--depth: ${block.quoteDepth}; --indent: ${unit.raw ? 0 : block.indent};`
                    }}
                >
                    <button
                        aria-label='${unit.fold ? 'Unfold block' : 'Fold block'}'
                        class='markdown-editor-fold'
                        contenteditable='false'
                        tabindex='-1'
                        type='button'
                        ${{
                            class: [() => !view.state.foldable && !unit.fold && 'markdown-editor-fold--none', unit.fold ? '--active' : ''],
                            onclick: () => unit.fold ? host.unfold(unit) : host.fold(unit),
                            onmousedown: prevent
                        }}
                    >
                        ${icon({ 'aria-hidden': 'true', class: 'markdown-editor-fold-icon' }, chevron)}
                    </button>
                    ${content}
                </div>
            `;
        }
    };
};


export { renderer };
export type { Host, Segment };
