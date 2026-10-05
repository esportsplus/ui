import { flush, reactive, root } from '@esportsplus/reactivity';
import { html, render, type Renderable } from '@esportsplus/template';
import { EditorDocument, preferredEol, type Change, type Selection, type Snapshot } from '../document';
import { NativeText } from '../projection';
import {
    blocksAt,
    markdownBackspace,
    markdownEnter,
    markdownReferences,
    parseInline,
    parseMarkdown,
    toggleTask,
    type Inline,
    type MarkdownBlock
} from './model';
import { headingScale, MarkdownLayout, viewportBlocks } from './layout';
import { renderSafeHtml } from './html';
import { clipInline } from './inline';
import { addNextOccurrence, deleteCharacter, indent, insertText, lineCommand, toggleComment } from '../commands';
import { stepCharacter } from '../selection';
import { mapFolds, outerFolds, type FoldRange } from '../folding';
import { markdownFolds, foldedMarkdown } from './structure';
import { mountMarkdownControls } from './controls';
import type { Controller, Options } from '../view';
import { markdownCommand } from './editing';
import { EditorLayout } from '../layout';

export type MarkdownOptions = Options & { spellcheck?: boolean };
export type MarkdownCallbacks = {
    onChange?: (value: string, change: Change, state: Snapshot) => void;
    onSave?: (value: string, state: Snapshot) => void;
    onSelection?: (selection: Selection, position: { line: number; column: number }) => void;
};
export type MarkdownController = Omit<Controller, 'setOptions'> & {
    setOptions(options: MarkdownOptions, replace?: boolean): void;
    bold(): boolean;
    italic(): boolean;
};

export function mountMarkdownEditor(
    host: HTMLElement,
    doc = new EditorDocument(),
    initial: MarkdownOptions = {},
    callbacks: MarkdownCallbacks = {}
): MarkdownController {
    return root((disposeScope) => {
        let dom = host.ownerDocument,
            win = dom.defaultView!,
            disposed = false,
            disposing = false,
            focused = false,
            composing = false,
            compositionPending = false,
            compositionTimer: number | undefined,
            compositionConflict = false,
            pendingValue: string | undefined,
            options: MarkdownOptions = { wrap: true, ...initial },
            active = { from: 0, to: 0 },
            folds: FoldRange[] = [],
            availableFolds: FoldRange[] = [],
            controls: ReturnType<typeof mountMarkdownControls> | undefined,
            state = reactive({
                ...doc.state,
                selection: { ...doc.selection },
                selections: doc.selections.map((range) => ({ ...range }))
            }),
            beforeSelections: readonly Selection[] | undefined,
            source = '',
            projection = new NativeText(''),
            activeGeometry: EditorLayout | undefined,
            activeGeometryKey = '',
            beforeInput: Selection | undefined,
            inputType = '',
            parsedSource = doc.value,
            parsedBlocks = parseMarkdown(doc),
            renderBlocks = viewportBlocks(parsedBlocks, doc.value),
            references = markdownReferences(doc.value),
            inlineCache = new Map<MarkdownBlock, Inline[]>(),
            activeBlock: MarkdownBlock | undefined,
            layout = new MarkdownLayout(renderBlocks, doc.value),
            layoutWidth = 600,
            layoutFont = 13,
            layoutLine = 20,
            measured = new Map<string, number>(),
            modeKey = '',
            frame = 0,
            pendingReveal = false,
            activeStart = 0,
            activeEnd = 0,
            activeHeight = 0,
            textarea: HTMLTextAreaElement,
            surface: HTMLElement,
            mirror: HTMLElement,
            caret: HTMLElement,
            before = reactive([] as MarkdownBlock[]),
            after = reactive([] as MarkdownBlock[]),
            ui = reactive({
                readonly: !!initial.readonly,
                label: initial.label ?? 'Markdown editor',
                spellcheck: initial.spellcheck ?? true,
                placeholder: initial.placeholder ?? '',
                active: false,
                activeClass: 'markdown-input',
                activeStyle: '',
                inputHeight: 20,
                top: 0,
                between: 0,
                next: 0,
                bottom: 0,
                mirrorBefore: '',
                mirrorAfter: '',
                mirrorWidth: 600,
                mixed: false,
                mirrorClass: 'markdown-input',
                mirrorStyle: '',
                composingText: '',
                paintingComposition: false,
                activeFold: false,
                activeFolded: false,
                activeFoldTop: 0,
                activeFoldLine: 1,
                crosshair: false
            }),
            removers: VoidFunction[] = [];
        let addedClass = !host.classList.contains('markdown-editor');
        host.classList.add('markdown-editor');
        availableFolds = markdownFolds(doc, parsedBlocks);
        function inline(tokens: Inline[]): Renderable<unknown> {
            return tokens.map((token): Renderable<unknown> => {
                let attrs = { 'data-md-offset': token.from, 'data-md-end': token.to },
                    children = token.children ? inline(token.children) : token.text;
                switch (token.kind) {
                    case 'strong':
                        return html`<strong ${attrs}>${children}</strong>`;
                    case 'em':
                        return html`<em ${attrs}>${children}</em>`;
                    case 'strike':
                        return html`<s ${attrs}>${children}</s>`;
                    case 'code':
                        return html`<code ${attrs}>${children}</code>`;
                    case 'link':
                        return html`<a ${{
                            ...attrs,
                            href: token.href,
                            rel: 'noopener noreferrer',
                            onclick: (e: MouseEvent) => {
                                if (e.ctrlKey || e.metaKey) return;
                                e.preventDefault();
                                e.stopPropagation();
                                let block = renderBlocks[layout.index(token.from)];
                                if (block) activate(block, e);
                            }
                        }}>${children}</a>`;
                    default:
                        return html`<span ${attrs}>${token.text}</span>`;
                }
            });
        }
        function inlineAt(block: MarkdownBlock, from: number, to: number) {
            let lo = 0,
                hi = parsedBlocks.length;
            while (lo < hi) {
                let mid = (lo + hi) >>> 1;
                if (parsedBlocks[mid]!.from <= block.from) lo = mid + 1;
                else hi = mid;
            }
            let owner = parsedBlocks[Math.max(0, lo - 1)]!,
                tokens = inlineCache.get(owner);
            if (!tokens) {
                let text = doc.value.slice(owner.contentFrom, owner.contentTo);
                tokens = parseInline(
                    text,
                    owner.contentFrom,
                    0,
                    /^ {0,3}\[[^\]]+\]:/.test(text) ? new Map() : references
                );
                inlineCache.set(owner, tokens);
            }
            return inline(clipInline(tokens, from, to));
        }
        function blockContent(block: MarkdownBlock): Renderable<unknown> {
            if (rawBlock(block)) {
                if (doc.selections.length > 1) {
                    let end = doc.value.slice(block.from, block.to).replace(/(?:\r\n|\r|\n)$/, '').length + block.from,
                        cursor = block.from,
                        output: Renderable<unknown>[] = [];
                    for (let range of [...doc.selections].sort((a, b) => a.start - b.start)) {
                        let start = Math.max(block.from, range.start),
                            to = Math.min(end, range.end);
                        if (start > end || to < cursor) continue;
                        output.push(
                            html`<span ${{ 'data-md-offset': cursor, 'data-md-end': start }}>${doc.value.slice(cursor, start)}</span>`
                        );
                        output.push(
                            html`<span class='markdown-selection' ${{ 'data-md-offset': start, 'data-md-end': to }}>${doc.value.slice(start, to)}</span>`
                        );
                        cursor = to;
                    }
                    output.push(
                        html`<span ${{ 'data-md-offset': cursor, 'data-md-end': end }}>${doc.value.slice(cursor, end)}</span>`
                    );
                    return output;
                }
                let start = Math.max(block.from, doc.selection.start),
                    end = Math.min(block.to, doc.selection.end),
                    terminal = block.to < doc.value.length && /[\r\n]$/.test(doc.value.slice(block.from, block.to)),
                    displayEnd = terminal
                        ? doc.value.slice(block.from, block.to).replace(/(?:\r\n|\r|\n)$/, '').length + block.from
                        : block.to;
                start = Math.min(start, displayEnd);
                end = Math.min(end, displayEnd);
                return html`
                    <span ${{ 'data-md-offset': block.from, 'data-md-end': start }}>${doc.value.slice(block.from, start)}</span>
                    <span class='markdown-selection' ${{ 'data-md-offset': start, 'data-md-end': end }}>${() => (ui.paintingComposition ? (doc.selection.start >= block.from && doc.selection.start < block.to ? ui.composingText : '') : doc.value.slice(start, end))}</span>
                    <span ${{ 'data-md-offset': end, 'data-md-end': displayEnd }}>${doc.value.slice(end, displayEnd)}</span>
                `;
            }
            let collapsed = folds.find((fold) => fold.open === block.from);
            if (collapsed && parsedBlocks.find((original) => original.from === block.from)!.to > collapsed.from)
                return html`<span ${{ 'data-md-offset': block.from, 'data-md-end': block.contentTo }}>${doc.value.slice(block.from, block.contentTo)}</span>`;
            let text = doc.value.slice(block.contentFrom, block.contentTo);
            if (block.kind === 'html') return renderSafeHtml(text, dom);
            if (block.kind === 'frontmatter')
                return html`<span class='markdown-frontmatter'>🔑 frontmatter · ${text.split(/\r\n|\r|\n/).length} lines</span>`;
            if (block.kind === 'fence' || block.kind === 'code')
                return html`<pre ${{ 'data-language': block.language }}><code>${block.lines ? block.lines.map((row, index) => html`<span ${{ 'data-md-offset': row.contentFrom, 'data-md-end': row.contentTo }}>${doc.value.slice(row.contentFrom, row.contentTo)}</span>${index < block.lines!.length - 1 ? '\n' : ''}`) : text.replace(/(?:\r\n|\r|\n)$/, '')}</code></pre>`;
            if (block.kind === 'rule') return html`<hr>`;
            if (block.kind === 'blank') return html`<br>`;
            if (block.kind === 'quote') {
                return (
                    block.lines?.map((row, index) => [
                        inlineAt(block, row.contentFrom, row.contentTo),
                        index < block.lines!.length - 1 ? '\n' : ''
                    ]) ?? inlineAt(block, block.contentFrom, block.contentTo)
                );
            }
            let content = block.lines
                ? block.lines.map((row, index) => [
                      inlineAt(block, row.contentFrom, row.contentTo),
                      index < block.lines!.length - 1 ? '\n' : ''
                  ])
                : inlineAt(block, block.contentFrom, block.contentTo);
            if (block.kind === 'list')
                return html`
                ${block.continuation ? '' : html`<span class='markdown-list-marker'>${/^\d/.test(block.marker ?? '') ? block.marker : '•'}</span>`}
                ${
                    block.task
                        ? html`<input type='checkbox' class='markdown-task' aria-label='Toggle task' ${{
                              checked: block.task.checked,
                              disabled: () => ui.readonly,
                              onmousedown: (e: MouseEvent) => e.preventDefault(),
                              onclick: (e: MouseEvent) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  if (!ui.readonly && !composing) toggleTask(doc, block.task!);
                              }
                          }}>`
                        : ''
                }${content}
            `;
            return content;
        }
        function blockTemplate(block: MarkdownBlock) {
            let candidate = availableFolds.find((fold) => fold.open === block.from),
                collapsed = folds.find((fold) => fold.open === block.from);
            return html`<div ${{
                class: `markdown-block ${blockClass(block)}${rawBlock(block) ? ' markdown-active' : ''}`,
                style: blockStyle(block, rawBlock(block)),
                'data-md-index': layout.index(block.from),
                'data-md-from': block.from,
                'data-md-to': block.to,
                tabindex: 0,
                role: 'group',
                'aria-label': `${block.kind} block`,
                onclick: (event: MouseEvent) => activate(block, event),
                onkeydown: (event: KeyboardEvent) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        activate(block);
                    }
                }
            }}>${() =>
                options.fold && candidate
                    ? html`<button type='button' class='markdown-fold-toggle' ${{
                          'aria-label': collapsed ? 'Unfold block' : 'Fold block',
                          'aria-expanded': String(!collapsed),
                          onmousedown: (e: MouseEvent) => e.preventDefault(),
                          onclick: (e: MouseEvent) => {
                              e.stopPropagation();
                              collapsed ? api.unfold(candidate.line) : api.fold(candidate.line);
                          }
                      }}>${collapsed ? '▸' : '▾'}</button>`
                    : ''}${blockContent(block)}${
                collapsed
                    ? html`<button type='button' class='markdown-fold-chip' ${{
                          'aria-label': 'Unfold block',
                          onclick: (e: MouseEvent) => {
                              e.stopPropagation();
                              api.unfold(collapsed.line);
                          }
                      }}>… ${collapsed.endLine - collapsed.line} lines</button>`
                    : ''
            }</div>`;
        }
        let unrender = render(
            host,
            {},
            () => html`
            <div class='markdown-surface' ${{ 'aria-label': () => ui.label, 'data-readonly': () => String(ui.readonly), 'data-wrap': () => String(options.wrap !== false), 'data-crosshair': () => String(ui.crosshair) }}>
                <div class='markdown-spacer' aria-hidden='true' ${{ style: () => `height:${ui.top}px;`, hidden: () => !ui.top }}></div>
                ${html.reactive(before, blockTemplate)}
                <div class='markdown-spacer' aria-hidden='true' ${{ style: () => `height:${ui.between}px;`, hidden: () => !ui.between }}></div>
                <button type='button' class='markdown-active-fold' ${{ hidden: () => !ui.activeFold, 'aria-label': () => (ui.activeFolded ? 'Unfold block' : 'Fold block'), 'aria-expanded': () => String(!ui.activeFolded), style: () => `top:${ui.activeFoldTop + 12}px`, onmousedown: (e: MouseEvent) => e.preventDefault(), onclick: () => (ui.activeFolded ? api.unfold(ui.activeFoldLine) : api.fold(ui.activeFoldLine)) }}>${() => (ui.activeFolded ? '▸' : '▾')}</button>
                <textarea class='markdown-input' ${{
                    class: () => `${ui.activeClass}${ui.mixed ? ' markdown-input--selection' : ''}`,
                    style: () => `${ui.activeStyle}height:${ui.mixed ? 1 : ui.inputHeight}px;`,
                    hidden: () => !ui.active,
                    readOnly: () => ui.readonly,
                    spellcheck: () => ui.spellcheck,
                    'aria-label': () => ui.label,
                    placeholder: () => ui.placeholder
                }}></textarea>
                <div class='markdown-spacer' aria-hidden='true' ${{ style: () => `height:${ui.next}px;`, hidden: () => !ui.next }}></div>
                ${html.reactive(after, blockTemplate)}
                <div class='markdown-spacer' aria-hidden='true' ${{ style: () => `height:${ui.bottom}px;`, hidden: () => !ui.bottom }}></div>
                <div class='markdown-measure' aria-hidden='true' ${{ class: () => ui.mirrorClass, style: () => `${ui.mirrorStyle}width:${ui.mirrorWidth}px;` }}>${() => ui.mirrorBefore}<span class='markdown-caret'>\u200b</span>${() => ui.mirrorAfter}</div>
            </div>
        `
        );
        textarea = host.querySelector('textarea')!;
        surface = host.querySelector('.markdown-surface')!;
        mirror = host.querySelector('.markdown-measure')!;
        caret = mirror.querySelector('.markdown-caret')!;
        function blockClass(block: MarkdownBlock) {
            return `markdown-block--${block.kind}${block.level ? ` markdown-h${block.level}` : ''}${block.quoteDepth ? ' markdown-quoted' : ''}${block.continuation ? ' markdown-continuation' : ''}${block.continues ? ' markdown-continues' : ''}`;
        }
        function blockStyle(block: MarkdownBlock, raw = false) {
            return `--markdown-quote-depth:${block.quoteDepth ?? 0};--markdown-indent:${raw ? 0 : (block.indent ?? 0)};`;
        }
        function rawBlock(block: MarkdownBlock) {
            return (
                focused &&
                ((ui.mixed && block.from < active.to && block.to > active.from) ||
                    doc.selections.slice(1).some((range) => range.start < block.to && range.end >= block.from))
            );
        }
        function metrics() {
            // Use the same declared block metrics even before queued class bindings flush.
            let style = win.getComputedStyle(host),
                base = parseFloat(style.fontSize) || 13,
                parsed = parseFloat(style.lineHeight),
                baseLine = parsed > 0 ? (parsed < 4 ? parsed * base : parsed) : 20,
                level = activeBlock?.level,
                font = base * headingScale(level),
                line = level && level <= 2 ? font * 1.3 : baseLine;
            return { font, line };
        }
        function cacheKey(block: MarkdownBlock) {
            return `${rawBlock(block)}:${layoutWidth}:${layoutFont}:${layoutLine}:${block.kind}:${doc.value.slice(block.from, block.to)}`;
        }
        function rebuildLayout() {
            let geometry = renderBlocks.map((block): MarkdownBlock =>
                rawBlock(block)
                    ? {
                          ...block,
                          kind: block.kind === 'frontmatter' ? 'paragraph' : block.kind,
                          indent: 0,
                          contentFrom: block.from,
                          contentTo:
                              doc.value.slice(block.from, block.to).replace(/(?:\r\n|\r|\n)$/, '').length + block.from,
                          lines: undefined
                      }
                    : block
            );
            layout = new MarkdownLayout(
                geometry,
                doc.value,
                options.wrap === false ? 1e9 : layoutWidth,
                layoutFont,
                layoutLine
            );
            for (let index = 0; index < renderBlocks.length; index++) {
                let cached = measured.get(cacheKey(renderBlocks[index]!));
                if (cached !== undefined) layout.measure(index, cached);
            }
        }
        function height() {
            let { font, line } = metrics(),
                columns =
                    options.wrap === false
                        ? 1e9
                        : Math.max(8, Math.floor((textarea.clientWidth || layoutWidth) / (font * 0.6))),
                lines = textarea.value.split('\n'),
                terminal = textarea.value.endsWith('\n') && activeEnd < renderBlocks.length;
            if (terminal) lines.pop();
            let rows = lines.reduce(
                (sum, text) => sum + (options.wrap === false ? 1 : Math.max(1, Math.ceil(text.length / columns))),
                0
            );
            textarea.style.height = '0px';
            activeHeight = Math.max(
                activeGeometry ? activeGeometry.height - (terminal ? line : 0) : rows * line,
                textarea.scrollHeight - (terminal ? line : 0)
            );
            ui.inputHeight = activeHeight;
            textarea.style.height = `${activeHeight}px`;
        }
        function adjustedY(y: number) {
            if (!focused || ui.mixed) return y;
            let top = layout.prefix(activeStart),
                inactiveHeight = layout.prefix(activeEnd) - top;
            return y <= top ? y : y >= top + activeHeight ? y - activeHeight + inactiveHeight : top;
        }
        function showWindow() {
            let window = layout.window(adjustedY(surface.scrollTop), surface.clientHeight || 320),
                blocks = renderBlocks;
            function assign(target: MarkdownBlock[], next: MarkdownBlock[]) {
                if (target.length !== next.length || target.some((block, index) => block !== next[index]))
                    target.splice(0, target.length, ...next);
            }
            if (focused && !ui.mixed) {
                let start = Math.min(window.start, activeStart),
                    end = Math.min(window.end, activeStart),
                    nextStart = Math.max(window.start, activeEnd),
                    nextEnd = Math.max(window.end, activeEnd);
                ui.top = layout.prefix(start);
                ui.between = layout.prefix(activeStart) - layout.prefix(end);
                ui.next = layout.prefix(nextStart) - layout.prefix(activeEnd);
                ui.bottom = layout.total - layout.prefix(nextEnd);
                assign(before, blocks.slice(start, end));
                assign(after, blocks.slice(nextStart, nextEnd));
            } else {
                ui.top = layout.prefix(window.start);
                ui.between = ui.next = 0;
                ui.bottom = layout.total - layout.prefix(window.end);
                assign(before, blocks.slice(window.start, window.end));
                if (after.length) after.splice(0);
            }
        }
        function scheduleMeasure() {
            if (!frame && !disposed) frame = win.requestAnimationFrame(measure);
        }
        function measure() {
            frame = 0;
            if (disposed || composing || compositionPending) return;
            flush();
            let anchor = layout.at(adjustedY(surface.scrollTop)),
                delta = adjustedY(surface.scrollTop) - layout.prefix(anchor),
                changed = false;
            for (let element of surface.querySelectorAll<HTMLElement>('.markdown-block[data-md-index]')) {
                let index = Number(element.dataset.mdIndex),
                    height = element.getBoundingClientRect().height;
                if (height > 0) {
                    measured.set(cacheKey(renderBlocks[index]!), height);
                    if (measured.size > 10000) measured.delete(measured.keys().next().value!);
                }
                changed = layout.measure(index, height) || changed;
            }
            if (changed) {
                let y = layout.prefix(anchor) + delta;
                if (focused && !ui.mixed && anchor >= activeEnd)
                    y += activeHeight - (layout.prefix(activeEnd) - layout.prefix(activeStart));
                surface.scrollTop = Math.max(0, y);
                showWindow();
                flush();
            }
            if (pendingReveal) {
                reveal(true);
                flush();
            }
        }
        function update(measuring = true) {
            if (disposed || composing || compositionPending) return;
            surface.dataset.wrap = String(options.wrap !== false);
            surface.dataset.minimap = String(!!options.minimap);
            if (parsedSource !== doc.value) {
                let previous = new Map(parsedBlocks.map((block) => [`${block.from}:${block.to}:${block.kind}`, block]));
                parsedBlocks = parseMarkdown(doc).map((block) => {
                    let old = previous.get(`${block.from}:${block.to}:${block.kind}`);
                    return old && parsedSource.slice(old.from, old.to) === doc.value.slice(block.from, block.to)
                        ? old
                        : block;
                });
                references = markdownReferences(doc.value);
                inlineCache.clear();
                parsedSource = doc.value;
                availableFolds = markdownFolds(doc, parsedBlocks);
                renderBlocks = viewportBlocks(foldedMarkdown(doc, parsedBlocks, folds), doc.value);
                rebuildLayout();
            }
            let blocks = parsedBlocks;
            let surfaceStyle = win.getComputedStyle(surface),
                width = surface.clientWidth
                    ? Math.max(
                          40,
                          surface.clientWidth -
                              (parseFloat(surfaceStyle.paddingLeft) || 0) -
                              (parseFloat(surfaceStyle.paddingRight) || 0)
                      )
                    : 600,
                computed = win.getComputedStyle(host),
                font = parseFloat(computed.fontSize) || 13,
                parsedLine = parseFloat(computed.lineHeight),
                line = parsedLine > 0 ? (parsedLine < 4 ? parsedLine * font : parsedLine) : 20;
            if (width !== layoutWidth || font !== layoutFont || line !== layoutLine) {
                layoutWidth = width;
                layoutFont = font;
                layoutLine = line;
                rebuildLayout();
            }
            ui.active = focused;
            if (focused) {
                active = blocksAt(blocks, doc.selection);
                activeStart = layout.index(active.from);
                activeEnd = layout.index(Math.max(active.from, active.to - 1)) + 1;
                if (active.to === doc.value.length && doc.selection.end === doc.value.length)
                    activeEnd = renderBlocks.length;
                activeBlock = blocks.find((block) => block.from === active.from && block.to === active.to);
                let collapsed = folds.find((fold) => fold.open === active.from);
                if (collapsed && activeBlock) {
                    active = { from: active.from, to: Math.min(active.to, collapsed.from) };
                    activeBlock = { ...activeBlock, to: active.to };
                    activeEnd = layout.index(Math.max(active.from, active.to - 1)) + 1;
                }
                ui.mixed = !activeBlock;
                let mode =
                    ui.mixed || doc.selections.length > 1
                        ? `${active.from}:${active.to}:${doc.selections.map((range) => `${range.start}-${range.end}`).join(',')}`
                        : 'single';
                if (mode !== modeKey) {
                    modeKey = mode;
                    rebuildLayout();
                    before.splice(0);
                    after.splice(0);
                    activeStart = layout.index(active.from);
                    activeEnd = layout.index(Math.max(active.from, active.to - 1)) + 1;
                    if (active.to === doc.value.length && doc.selection.end === doc.value.length)
                        activeEnd = renderBlocks.length;
                }
                ui.activeClass = `markdown-input${activeBlock ? ` ${blockClass(activeBlock)}` : ''}`;
                ui.activeStyle = activeBlock ? blockStyle(activeBlock, true) : '';
                let foldCandidate = availableFolds.find((fold) => fold.open === active.from);
                ui.activeFold = !!options.fold && !!foldCandidate && !ui.mixed;
                ui.activeFolded = !!collapsed;
                ui.activeFoldLine = foldCandidate?.line ?? 1;
                ui.activeFoldTop = layout.prefix(activeStart);
                source = doc.value.slice(active.from, active.to);
                projection = new NativeText(source);
                if (textarea.value !== projection.value) textarea.value = projection.value;
                textarea.setSelectionRange(
                    projection.toNative(doc.selection.start - active.from),
                    projection.toNative(doc.selection.end - active.from),
                    doc.selection.direction
                );
                let head = doc.selection.direction === 'backward' ? doc.selection.start : doc.selection.end,
                    offset = projection.toNative(head - active.from);
                let headBlock = renderBlocks[layout.index(head)]!,
                    headProjection = ui.mixed
                        ? new NativeText(doc.value.slice(headBlock.from, headBlock.to))
                        : projection,
                    mirrorOffset = ui.mixed ? headProjection.toNative(head - headBlock.from) : offset;
                ui.mirrorClass = ui.mixed ? `markdown-input ${blockClass(headBlock)}` : ui.activeClass;
                ui.mirrorStyle = ui.mixed ? blockStyle(headBlock, true) : ui.activeStyle;
                ui.mirrorWidth = textarea.clientWidth || layoutWidth;
                ui.mirrorBefore = headProjection.value.slice(0, mirrorOffset);
                ui.mirrorAfter = headProjection.value.slice(mirrorOffset);
                let { font: activeFont, line: activeLine } = metrics(),
                    geometryKey = `${active.from}:${active.to}:${layoutWidth}:${activeFont}:${activeLine}:${options.wrap}:${options.tabSize}:${source}`;
                if (geometryKey !== activeGeometryKey) {
                    activeGeometryKey = geometryKey;
                    activeGeometry = new EditorLayout(
                        projection,
                        source,
                        Math.max(40, (textarea.clientWidth || layoutWidth) - (activeBlock?.quoteDepth ?? 0) * 10),
                        activeLine,
                        activeFont * 0.6,
                        options.tabSize ?? 4,
                        options.wrap !== false
                    );
                }
                flush();
                height();
            } else {
                ui.mirrorBefore = ui.mirrorAfter = '';
                ui.mixed = false;
                ui.activeFold = false;
                if (modeKey !== 'single') {
                    modeKey = 'single';
                    rebuildLayout();
                    before.splice(0);
                    after.splice(0);
                }
            }
            textarea.wrap = options.wrap === false ? 'off' : 'soft';
            textarea.name = options.name ?? '';
            textarea.style.tabSize = mirror.style.tabSize = String(Math.max(1, Math.min(16, options.tabSize ?? 4)));
            surface.dataset.wrap = String(options.wrap !== false);
            surface.dataset.minimap = String(!!options.minimap);
            showWindow();
            controls?.refresh();
            if (measuring) scheduleMeasure();
        }
        function reveal(deferred = false) {
            if (!focused) return;
            pendingReveal = !deferred;
            let head = doc.selection.direction === 'backward' ? doc.selection.start : doc.selection.end,
                index = ui.mixed ? layout.index(head) : activeStart,
                origin = ui.mixed ? renderBlocks[index]!.from : active.from,
                text = ui.mixed
                    ? new NativeText(doc.value.slice(origin, renderBlocks[index]!.to)).value
                    : projection.value,
                native = ui.mixed
                    ? new NativeText(doc.value.slice(origin, renderBlocks[index]!.to)).toNative(head - origin)
                    : projection.toNative(head - active.from),
                { font, line } = metrics(),
                columns =
                    options.wrap === false
                        ? 1e9
                        : Math.max(8, Math.floor((textarea.clientWidth || layoutWidth) / (font * 0.6))),
                rows = text.slice(0, native).split('\n'),
                row =
                    rows.slice(0, -1).reduce((sum, text) => sum + Math.max(1, Math.ceil(text.length / columns)), 0) +
                    Math.floor((rows.at(-1)?.length ?? 0) / columns),
                geometry = caret.getBoundingClientRect(),
                mirrorBox = mirror.getBoundingClientRect(),
                y = layout.prefix(index) + (geometry.height ? geometry.top - mirrorBox.top : row * line),
                height = surface.clientHeight || 320;
            if (y < surface.scrollTop) surface.scrollTop = y;
            else if (y + line > surface.scrollTop + height) surface.scrollTop = y + line - height;
            if (options.wrap === false && !ui.mixed) {
                let x = geometry.height ? geometry.left - mirrorBox.left : (rows.at(-1)?.length ?? 0) * font * 0.6,
                    width = textarea.clientWidth || layoutWidth;
                if (x < textarea.scrollLeft) textarea.scrollLeft = x;
                else if (x + font * 0.6 > textarea.scrollLeft + width) textarea.scrollLeft = x + font * 0.6 - width;
            }
            showWindow();
        }
        function activate(block: MarkdownBlock, event?: MouseEvent) {
            if (disposed || composing || compositionPending) return;
            // Modified link clicks retain ordinary navigation; ordinary clicks edit in place.
            if (event && (event.ctrlKey || event.metaKey) && (event.target as Element).closest('a[href]')) return;
            let offset = block.contentFrom;
            if (event) {
                let element = (event.target as Element).closest<HTMLElement>('[data-md-offset]');
                if (element) {
                    offset = Number(element.dataset.mdOffset);
                    let caretDoc = dom as Document & {
                        caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
                        caretRangeFromPoint?: (x: number, y: number) => Range | null;
                    };
                    let point = caretDoc.caretPositionFromPoint?.(event.clientX, event.clientY),
                        range = caretDoc.caretRangeFromPoint?.(event.clientX, event.clientY),
                        node = point?.offsetNode ?? range?.startContainer,
                        count = point?.offset ?? range?.startOffset;
                    if (node && element.contains(node) && count !== undefined) offset += count;
                    offset = Math.min(offset, Number(element.dataset.mdEnd));
                }
            }
            focused = true;
            doc.select({ start: offset });
            update();
            reveal();
            flush();
            textarea.focus({ preventScroll: true });
        }
        function readSelection() {
            if (!focused || composing || compositionPending || disposed) return;
            let next = {
                start: active.from + projection.toSource(textarea.selectionStart),
                end: active.from + projection.toSource(textarea.selectionEnd),
                direction: textarea.selectionDirection
            };
            if (
                next.start !== doc.selection.start ||
                next.end !== doc.selection.end ||
                (next.direction !== doc.selection.direction && doc.selections.length === 1)
            )
                doc.select(next);
        }
        function commit(sourceName = 'input') {
            if (disposed || ui.readonly || compositionConflict) {
                update();
                return;
            }
            let edit = projection.edit(
                    source,
                    textarea.value,
                    beforeInput
                        ? { start: beforeInput.start - active.from, end: beforeInput.end - active.from }
                        : undefined,
                    inputType
                ),
                insert = edit.insert.replace(/\r\n|\r|\n/g, preferredEol(doc.value)),
                next = source.slice(0, edit.from) + insert + source.slice(edit.to),
                nextProjection = new NativeText(next),
                selection = {
                    start: active.from + nextProjection.toSource(textarea.selectionStart),
                    end: active.from + nextProjection.toSource(textarea.selectionEnd),
                    direction: textarea.selectionDirection
                };
            if ((beforeSelections?.length ?? doc.selections.length) > 1) insertText(doc, insert, sourceName);
            else
                doc.transact([{ from: active.from + edit.from, to: active.from + edit.to, insert }], {
                    source: sourceName,
                    selection,
                    group:
                        sourceName === 'input' &&
                        /^(insertText|deleteContentBackward|deleteContentForward)$/.test(inputType)
                            ? inputType
                            : undefined
                });
            beforeInput = undefined;
            beforeSelections = undefined;
            inputType = '';
            update();
        }
        function listen(target: EventTarget, type: string, listener: EventListener, capture = false) {
            target.addEventListener(type, listener, capture);
            removers.push(() => target.removeEventListener(type, listener, capture));
        }
        listen(surface, 'scroll', () => {
            if (!composing && !compositionPending) {
                showWindow();
                scheduleMeasure();
            }
        });
        listen(win, 'resize', () => update());
        listen(surface, 'load', scheduleMeasure, true);
        if (dom.fonts)
            listen(dom.fonts, 'loadingdone', () => {
                measured.clear();
                layoutWidth = 0;
                update();
            });
        let Observer = (win as Window & typeof globalThis).ResizeObserver,
            observer = Observer ? new Observer(() => update()) : undefined;
        observer?.observe(surface);
        removers.push(() => observer?.disconnect());
        listen(textarea, 'focus', () => {
            focused = true;
            update();
        });
        listen(textarea, 'blur', () => {
            if (composing || compositionPending) finishComposition();
            focused = false;
            update();
        });
        listen(textarea, 'beforeinput', (event) => {
            let e = event as InputEvent;
            if (ui.readonly) {
                e.preventDefault();
                return;
            }
            if (!composing && !compositionPending) {
                readSelection();
                beforeInput = doc.selection;
                beforeSelections = doc.selections;
                inputType = e.inputType;
            }
            if (!composing && !compositionPending && (e.inputType === 'historyUndo' || e.inputType === 'historyRedo')) {
                e.preventDefault();
                e.inputType === 'historyUndo' ? api.undo() : api.redo();
            } else if (
                !composing &&
                !compositionPending &&
                doc.selections.length > 1 &&
                /^delete(?:Content|Word)(?:Backward|Forward)$/.test(e.inputType)
            ) {
                e.preventDefault();
                e.inputType === 'deleteContentBackward'
                    ? markdownCommand(doc, 'backspace')
                    : deleteCharacter(doc, e.inputType.endsWith('Backward'), e.inputType.startsWith('deleteWord'));
            } else if (
                !composing &&
                !compositionPending &&
                doc.selections.length > 1 &&
                (e.inputType === 'insertParagraph' || e.inputType === 'insertLineBreak')
            ) {
                e.preventDefault();
                api.newline();
            } else if (
                !composing &&
                !compositionPending &&
                (e.inputType === 'insertParagraph' || e.inputType === 'insertLineBreak') &&
                markdownEnter(doc)
            )
                e.preventDefault();
            else if (
                !composing &&
                !compositionPending &&
                e.inputType === 'deleteContentBackward' &&
                markdownBackspace(doc)
            )
                e.preventDefault();
        });
        listen(textarea, 'input', (event) => {
            if (composing || (event as InputEvent).isComposing) {
                if (ui.mixed) {
                    ui.paintingComposition = true;
                    ui.composingText = projection.edit(
                        source,
                        textarea.value,
                        beforeInput
                            ? { start: beforeInput.start - active.from, end: beforeInput.end - active.from }
                            : undefined
                    ).insert;
                } else height();
            } else if (compositionPending) finishComposition();
            else commit();
        });
        for (let type of ['select', 'keyup', 'pointerup']) listen(textarea, type, readSelection);
        listen(textarea, 'compositionstart', () => {
            if (ui.readonly) return;
            if (compositionPending) finishComposition();
            readSelection();
            beforeInput = doc.selection;
            beforeSelections = doc.selections;
            composing = true;
            compositionConflict = false;
            if (ui.mixed) {
                surface.scrollTop = layout.prefix(layout.index(doc.selection.start));
                showWindow();
            }
        });
        function finishComposition() {
            if (!composing && !compositionPending) return;
            win.clearTimeout(compositionTimer);
            composing = false;
            compositionPending = false;
            ui.paintingComposition = false;
            ui.composingText = '';
            if (!compositionConflict) commit('composition');
            else {
                compositionConflict = false;
                update();
            }
            if (pendingValue !== undefined) {
                let value = pendingValue;
                pendingValue = undefined;
                api.setValue(value);
            }
        }
        listen(textarea, 'compositionend', () => {
            composing = false;
            compositionPending = true;
            compositionTimer = win.setTimeout(finishComposition, 0);
        });
        for (let type of ['copy', 'cut'])
            listen(textarea, type, (event) => {
                let e = event as ClipboardEvent;
                if (composing || compositionPending || !e.clipboardData) return;
                readSelection();
                let selected = doc.selections;
                if (selected.every((range) => range.start === range.end))
                    selected = selected.map((range) => {
                        let position = doc.position(range.start);
                        return {
                            start: doc.offset(position.line),
                            end: doc.starts[position.line] ?? doc.value.length,
                            direction: 'none'
                        };
                    });
                let chunks = selected.map((range) => doc.value.slice(range.start, range.end));
                e.clipboardData.setData('text/plain', chunks.join(preferredEol(doc.value)));
                e.clipboardData.setData('application/x-esportsplus-code-editor', JSON.stringify(chunks));
                e.preventDefault();
                if (type === 'cut' && !ui.readonly) {
                    doc.selectMany(selected);
                    insertText(doc, '', 'markdown-cut');
                }
            });
        listen(textarea, 'paste', (event) => {
            let e = event as ClipboardEvent;
            if (composing || compositionPending || ui.readonly || !e.clipboardData) return;
            readSelection();
            let insert = e.clipboardData.getData('text/plain');
            e.preventDefault();
            let rows = insert.split(/\r\n|\r|\n/),
                encoded = e.clipboardData.getData('application/x-esportsplus-code-editor');
            if (encoded) {
                let decoded: unknown;
                try {
                    decoded = JSON.parse(encoded);
                } catch {
                    decoded = null;
                }
                if (
                    Array.isArray(decoded) &&
                    decoded.length === doc.selections.length &&
                    decoded.every((value) => typeof value === 'string') &&
                    ['\n', '\r', '\r\n'].some((eol) => decoded.join(eol) === insert)
                )
                    rows = decoded;
            }
            insertText(
                doc,
                doc.selections.length > 1 && rows.length === doc.selections.length ? rows : insert,
                'markdown-paste'
            );
        });
        function sourcePoint(node: Node | null, offset: number): number | undefined {
            let element = node?.nodeType === 1 ? (node as HTMLElement) : node?.parentElement;
            if (!element || !host.contains(element) || element === textarea) return;
            let token = element.closest<HTMLElement>('[data-md-offset]'),
                block = element.closest<HTMLElement>('[data-md-from]');
            if (token && node) {
                let range = dom.createRange();
                range.setStart(token, 0);
                range.setEnd(node, offset);
                return Math.min(Number(token.dataset.mdEnd), Number(token.dataset.mdOffset) + range.toString().length);
            }
            if (block) return Number(block.dataset.mdFrom);
        }
        function blockY(offset: number) {
            let index = layout.index(offset),
                block = renderBlocks[index];
            if (!block) return 0;
            let y = layout.prefix(index);
            if (focused && !ui.mixed && index >= activeEnd)
                y += activeHeight - (layout.prefix(activeEnd) - layout.prefix(activeStart));
            return y;
        }
        function sourceY(offset: number) {
            let hidden = folds.find((fold) => offset >= fold.from && offset < fold.to);
            if (hidden) return blockY(hidden.open ?? hidden.from);
            let block = renderBlocks[layout.index(offset)];
            if (!block) return 0;
            if (focused && !ui.mixed && offset >= active.from && offset <= active.to && activeGeometry)
                return blockY(active.from) + activeGeometry.rect(projection.toNative(offset - active.from)).top;
            let inInput = focused && !ui.mixed && offset >= active.from && offset <= active.to,
                origin = inInput ? active.from : block.contentFrom,
                font = layoutFont * headingScale(block.level),
                line = block.level && block.level <= 2 ? font * 1.3 : layoutLine,
                columns =
                    options.wrap === false || (!inInput && (block.kind === 'fence' || block.kind === 'code'))
                        ? 1e9
                        : Math.max(8, Math.floor(layoutWidth / (font * 0.6))),
                rows = new NativeText(doc.value.slice(origin, Math.max(origin, offset))).value.split('\n'),
                row =
                    rows.slice(0, -1).reduce((sum, value) => sum + Math.max(1, Math.ceil(value.length / columns)), 0) +
                    Math.floor((rows.at(-1)?.length ?? 0) / columns);
            return (
                blockY(origin) +
                (inInput && activeGeometry
                    ? activeGeometry.rect(projection.toNative(offset - active.from)).top
                    : row * line)
            );
        }
        function textRect(element: HTMLElement, offset: number) {
            let walker = dom.createTreeWalker(element, 4),
                node: Node | null;
            while ((node = walker.nextNode())) {
                if (node.parentElement?.closest('.markdown-caret,.markdown-fold-toggle,.markdown-fold-chip')) continue;
                let length = node.textContent?.length ?? 0;
                if (offset <= length) {
                    let range = dom.createRange();
                    range.setStart(node, Math.min(offset, length));
                    range.setEnd(node, Math.min(offset + 1, length));
                    return typeof range.getBoundingClientRect === 'function' ? range.getBoundingClientRect() : null;
                }
                offset -= length;
            }
            return null;
        }
        function rectAt(offset: number) {
            if (
                disposed ||
                offset < 0 ||
                offset > doc.value.length ||
                folds.some((fold) => offset >= fold.from && offset < fold.to)
            )
                return null;
            let box = surface.getBoundingClientRect(),
                index = layout.index(offset),
                block = renderBlocks[index];
            if (!block) return null;
            let font = layoutFont * headingScale(block.level),
                line = block.level && block.level <= 2 ? font * 1.3 : layoutLine,
                char = font * 0.6;
            if (focused && !ui.mixed && offset >= active.from && offset <= active.to) {
                let native = projection.toNative(offset - active.from),
                    real = textRect(mirror, native),
                    mirrorBox = mirror.getBoundingClientRect(),
                    inputBox = textarea.getBoundingClientRect();
                if (real?.height)
                    return {
                        left: inputBox.left + real.left - mirrorBox.left - textarea.scrollLeft,
                        top: inputBox.top + real.top - mirrorBox.top,
                        width: real.width || char,
                        height: real.height
                    };
                if (activeGeometry) {
                    let rect = activeGeometry.rect(native);
                    return {
                        left:
                            box.left +
                            12 +
                            (activeBlock?.quoteDepth ?? 0) * 10 +
                            rect.left -
                            textarea.scrollLeft -
                            surface.scrollLeft,
                        top: box.top + 12 + blockY(active.from) + rect.top - surface.scrollTop,
                        width: char,
                        height: rect.height
                    };
                }
            } else {
                let element = [...surface.querySelectorAll<HTMLElement>('[data-md-from]')].find(
                    (element) => Number(element.dataset.mdFrom) === block.from
                );
                if (element) {
                    let tokens = [...element.querySelectorAll<HTMLElement>('[data-md-offset]')],
                        token = tokens
                            .filter(
                                (token) =>
                                    Number(token.dataset.mdOffset) <= offset && Number(token.dataset.mdEnd) >= offset
                            )
                            .at(-1);
                    if (!token)
                        token = tokens.reduce<HTMLElement | undefined>(
                            (best, token) =>
                                !best ||
                                Math.abs(Number(token.dataset.mdOffset) - offset) <
                                    Math.abs(Number(best.dataset.mdOffset) - offset)
                                    ? token
                                    : best,
                            undefined
                        );
                    let real = token
                        ? textRect(
                              token,
                              Math.max(
                                  0,
                                  Math.min((token.textContent ?? '').length, offset - Number(token.dataset.mdOffset))
                              )
                          )
                        : null;
                    if (real?.height)
                        return { left: real.left, top: real.top, width: real.width || char, height: real.height };
                }
            }
            let origin =
                    focused && !ui.mixed && offset >= active.from && offset <= active.to
                        ? active.from
                        : block.contentFrom,
                text = new NativeText(doc.value.slice(origin, Math.max(origin, offset))).value,
                rows = text.split('\n'),
                columns =
                    options.wrap === false ||
                    (!(focused && !ui.mixed && origin === active.from) &&
                        (block.kind === 'fence' || block.kind === 'code'))
                        ? 1e9
                        : Math.max(8, Math.floor(layoutWidth / char)),
                row =
                    rows.slice(0, -1).reduce((sum, value) => sum + Math.max(1, Math.ceil(value.length / columns)), 0) +
                    Math.floor((rows.at(-1)?.length ?? 0) / columns),
                column = (rows.at(-1)?.length ?? 0) % columns;
            return {
                left: box.left + 12 + (block.quoteDepth ?? 0) * 10 + column * char - surface.scrollLeft,
                top: box.top + 12 + blockY(origin) + row * line - surface.scrollTop,
                width: char,
                height: line
            };
        }
        function offsetAt(clientX: number, clientY: number) {
            if (disposed) return null;
            let box = surface.getBoundingClientRect();
            if (box.width && (clientX < box.left || clientX > box.right || clientY < box.top || clientY > box.bottom))
                return null;
            let caretDoc = dom as Document & {
                    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
                    caretRangeFromPoint?: (x: number, y: number) => Range | null;
                },
                point = caretDoc.caretPositionFromPoint?.(clientX, clientY),
                range = caretDoc.caretRangeFromPoint?.(clientX, clientY),
                exact = sourcePoint(
                    point?.offsetNode ?? range?.startContainer ?? null,
                    point?.offset ?? range?.startOffset ?? 0
                );
            if (exact !== undefined) return exact;
            if (focused && !ui.mixed) {
                let inputBox = textarea.getBoundingClientRect(),
                    mirrorBox = mirror.getBoundingClientRect();
                if (
                    inputBox.height &&
                    clientY >= inputBox.top &&
                    clientY <= inputBox.bottom &&
                    textRect(mirror, 0)?.height
                ) {
                    let x = clientX - inputBox.left + textarea.scrollLeft + mirrorBox.left,
                        y = clientY - inputBox.top + mirrorBox.top,
                        lo = 0,
                        hi = projection.value.length;
                    while (lo < hi) {
                        let mid = (lo + hi) >>> 1,
                            rect = textRect(mirror, mid);
                        if (!rect?.height) break;
                        if (rect.top + rect.height < y || (rect.top <= y && rect.left + rect.width / 2 < x))
                            lo = mid + 1;
                        else hi = mid;
                    }
                    let rect = textRect(mirror, lo);
                    if (rect?.height) return active.from + projection.toSource(lo);
                }
            }
            let y = clientY - box.top - 12 + surface.scrollTop,
                index = layout.at(adjustedY(y)),
                block = renderBlocks[index];
            if (!block) return null;
            let nativeActive =
                    focused &&
                    !ui.mixed &&
                    y >= layout.prefix(activeStart) &&
                    y <= layout.prefix(activeStart) + activeHeight,
                from = nativeActive ? active.from : block.contentFrom,
                to = nativeActive ? active.to : block.contentTo,
                projected = new NativeText(doc.value.slice(from, to)),
                font = layoutFont * headingScale(block.level),
                char = font * 0.6,
                line = block.level && block.level <= 2 ? font * 1.3 : layoutLine,
                columns =
                    options.wrap === false || (!nativeActive && (block.kind === 'fence' || block.kind === 'code'))
                        ? 1e9
                        : Math.max(8, Math.floor(layoutWidth / char)),
                row = Math.max(0, Math.floor((y - blockY(from)) / line)),
                column = Math.max(
                    0,
                    Math.round((clientX - box.left - 12 - (block.quoteDepth ?? 0) * 10 + surface.scrollLeft) / char)
                ),
                native = 0,
                remaining = row;
            if (nativeActive && activeGeometry)
                return (
                    active.from +
                    projection.toSource(
                        activeGeometry.offset(
                            clientX -
                                box.left -
                                12 -
                                (activeBlock?.quoteDepth ?? 0) * 10 +
                                textarea.scrollLeft +
                                surface.scrollLeft,
                            y - blockY(active.from)
                        )
                    )
                );
            for (let text of projected.value.split('\n')) {
                let count = Math.max(1, Math.ceil(text.length / columns));
                if (remaining < count)
                    return from + projected.toSource(native + Math.min(text.length, remaining * columns + column));
                remaining -= count;
                native += text.length + 1;
            }
            return to;
        }
        function rebuildFolds() {
            renderBlocks = viewportBlocks(
                foldedMarkdown(doc, parsedBlocks, options.fold ? outerFolds(folds) : []),
                doc.value
            );
            measured.clear();
            modeKey = '';
            before.splice(0);
            after.splice(0);
            rebuildLayout();
            update();
        }
        function revealFolds(ranges: readonly Partial<Selection>[]) {
            let previous = folds.length;
            folds = folds.filter(
                (fold) =>
                    !ranges.some(
                        (range) =>
                            ((range.start ?? 0) >= fold.from && (range.start ?? 0) < fold.to) ||
                            ((range.end ?? range.start ?? 0) > fold.from && (range.end ?? range.start ?? 0) <= fold.to)
                    )
            );
            if (previous !== folds.length) rebuildFolds();
        }
        let rectangle: { offset: number; x: number } | undefined,
            modifiedPointer = false;
        listen(surface, 'pointerdown', (event) => {
            let e = event as PointerEvent;
            if (
                !(e.altKey || e.ctrlKey || e.metaKey) ||
                composing ||
                compositionPending ||
                (e.target as Element).closest('button,a[href],input')
            )
                return;
            let offset = offsetAt(e.clientX, e.clientY);
            if (offset === null) return;
            e.preventDefault();
            modifiedPointer = true;
            if (e.altKey) {
                rectangle = { offset, x: e.clientX };
                ui.crosshair = true;
                api.select({ start: offset });
            } else api.selectMany([...doc.selections, { start: offset }]);
        });
        listen(
            surface,
            'click',
            (event) => {
                if (modifiedPointer) {
                    modifiedPointer = false;
                    event.preventDefault();
                    event.stopPropagation();
                }
            },
            true
        );
        listen(win, 'pointermove', (event) => {
            let e = event as PointerEvent;
            if (!rectangle) return;
            let end = offsetAt(e.clientX, e.clientY);
            if (end === null) return;
            let first = doc.position(rectangle.offset).line,
                last = doc.position(end).line,
                ranges: Partial<Selection>[] = [];
            for (let line = Math.min(first, last); line <= Math.max(first, last) && ranges.length < 1000; line++) {
                let rect = rectAt(doc.offset(line, 1));
                if (!rect) continue;
                let a = offsetAt(rectangle.x, rect.top + rect.height / 2),
                    b = offsetAt(e.clientX, rect.top + rect.height / 2);
                if (a !== null && b !== null)
                    ranges.push({
                        start: Math.min(a, b),
                        end: Math.max(a, b),
                        direction: b < a ? 'backward' : 'forward'
                    });
            }
            if (ranges.length) api.selectMany(ranges, false);
        });
        listen(win, 'pointerup', () => {
            rectangle = undefined;
            ui.crosshair = false;
        });
        listen(win, 'keyup', (event) => {
            if (!(event as KeyboardEvent).altKey) ui.crosshair = false;
        });
        listen(win, 'blur', () => {
            rectangle = undefined;
            ui.crosshair = false;
        });
        listen(host, 'pointerup', (event) => {
            if (composing || compositionPending || event.target === textarea || (event as PointerEvent).altKey) return;
            let selection = dom.getSelection();
            if (!selection || selection.isCollapsed) return;
            let anchor = sourcePoint(selection.anchorNode, selection.anchorOffset),
                head = sourcePoint(selection.focusNode, selection.focusOffset);
            if (anchor === undefined || head === undefined) return;
            selection.removeAllRanges();
            api.select({
                start: Math.min(anchor, head),
                end: Math.max(anchor, head),
                direction: head < anchor ? 'backward' : 'forward'
            });
        });
        listen(
            host,
            'keydown',
            (event) => {
                let e = event as KeyboardEvent;
                if (e.isComposing || composing || compositionPending) return;
                if (e.key === 'Alt') ui.crosshair = true;
                let mod = e.ctrlKey || e.metaKey,
                    key = e.key.toLowerCase(),
                    handled = true;
                if (
                    (e.target as Element).closest('.markdown-controls') &&
                    !((mod && ['f', 'h', 'g'].includes(key)) || e.key === 'F3')
                )
                    return;
                if (event.target === textarea) readSelection();
                if (mod && e.altKey && key === 'g') api.openGoToLine();
                else if (mod && e.altKey && key === '[') e.shiftKey ? api.foldAll() : api.fold();
                else if (mod && e.altKey && key === ']') e.shiftKey ? api.unfoldAll() : api.unfold();
                else if (mod && !e.altKey && key === 'f') api.openFind();
                else if (mod && !e.altKey && key === 'h') api.openFind(true);
                else if (mod && !e.altKey && key === 'g') e.shiftKey ? api.findPrevious() : api.findNext();
                else if (e.key === 'F3') e.shiftKey ? api.findPrevious() : api.findNext();
                else if (mod && key === 'd') api.addNextOccurrence();
                else if (mod && e.shiftKey && (key === 'l' || key === 'a')) api.addNextOccurrence(true);
                else if (mod && key === 'u') e.shiftKey ? api.redoSelection() : api.undoSelection();
                else handled = false;
                if (handled) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            },
            true
        );
        listen(textarea, 'keydown', (event) => {
            let e = event as KeyboardEvent;
            if (e.isComposing || composing || compositionPending) return;
            if (options.onCompletionKey?.(e, api as Controller)) {
                e.preventDefault();
                return;
            }
            readSelection();
            let mod = e.ctrlKey || e.metaKey,
                key = e.key.toLowerCase();
            if (mod && e.key === ' ') {
                e.preventDefault();
                options.onAutocomplete?.(api as Controller, true);
                return;
            }
            if (
                doc.selections.length > 1 &&
                /^(ArrowLeft|ArrowRight|ArrowUp|ArrowDown|Home|End|PageUp|PageDown)$/.test(e.key)
            ) {
                e.preventDefault();
                api.selectMany(
                    doc.selections.map((range) => {
                        let head = range.direction === 'backward' ? range.start : range.end,
                            anchor = range.direction === 'backward' ? range.end : range.start,
                            position = doc.position(head),
                            next =
                                e.key === 'ArrowLeft' || e.key === 'ArrowRight'
                                    ? stepCharacter(doc.value, head, e.key === 'ArrowLeft')
                                    : e.key === 'Home'
                                      ? doc.offset(position.line, 1)
                                      : e.key === 'End'
                                        ? doc.offset(position.line, 1e9)
                                        : doc.offset(
                                              position.line +
                                                  (e.key.endsWith('Up') ? -1 : 1) *
                                                      (e.key.startsWith('Page')
                                                          ? Math.max(
                                                                1,
                                                                Math.floor((surface.clientHeight || 320) / layoutLine)
                                                            )
                                                          : 1),
                                              position.column
                                          );
                        return e.shiftKey
                            ? {
                                  start: Math.min(anchor, next),
                                  end: Math.max(anchor, next),
                                  direction: next < anchor ? 'backward' : 'forward'
                              }
                            : { start: next };
                    })
                );
                return;
            }
            if (!ui.readonly && doc.selections.length > 1 && (e.key === 'Backspace' || e.key === 'Delete')) {
                e.preventDefault();
                e.key === 'Backspace' && !mod && !e.altKey
                    ? markdownCommand(doc, 'backspace')
                    : deleteCharacter(doc, e.key === 'Backspace', mod || e.altKey);
                return;
            }
            if (!ui.readonly && e.key === 'Tab' && options.captureTab !== false) {
                e.preventDefault();
                e.shiftKey ? api.outdent() : api.indent();
                return;
            }
            if (!ui.readonly && mod && (key === '[' || key === ']' || key === '/' || key === 'enter')) {
                e.preventDefault();
                key === '['
                    ? api.outdent()
                    : key === ']'
                      ? api.indent()
                      : key === '/'
                        ? api.toggleComment()
                        : api.lineCommand('blank');
                return;
            }
            if (mod && key === 's') {
                e.preventDefault();
                api.save();
            }
            if (mod && key === 'a') {
                e.preventDefault();
                api.select({ start: 0, end: doc.value.length });
                return;
            }
            if (
                (mod && (e.key === 'Home' || e.key === 'End')) ||
                (e.metaKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) ||
                e.key === 'PageUp' ||
                e.key === 'PageDown'
            ) {
                let selection = doc.selection,
                    backward = selection.direction === 'backward',
                    anchor = backward ? selection.end : selection.start,
                    head = backward ? selection.start : selection.end,
                    position = doc.position(head),
                    next =
                        e.key === 'Home' || e.key === 'ArrowUp'
                            ? 0
                            : e.key === 'End' || e.key === 'ArrowDown'
                              ? doc.value.length
                              : doc.offset(
                                    position.line +
                                        Math.max(1, Math.floor((surface.clientHeight || 320) / metrics().line)) *
                                            (e.key === 'PageUp' ? -1 : 1),
                                    position.column
                                );
                e.preventDefault();
                api.select(
                    e.shiftKey
                        ? {
                              start: Math.min(anchor, next),
                              end: Math.max(anchor, next),
                              direction: next < anchor ? 'backward' : 'forward'
                          }
                        : { start: next }
                );
                return;
            }
            if (e.shiftKey && /^Arrow(?:Left|Right|Up|Down)$/.test(e.key)) {
                let selection = doc.selection,
                    backward = selection.direction === 'backward',
                    head = backward ? selection.start : selection.end,
                    anchor = backward ? selection.end : selection.start,
                    nativeHead = backward ? textarea.selectionStart : textarea.selectionEnd,
                    atEdge =
                        e.key === 'ArrowLeft'
                            ? nativeHead === 0
                            : e.key === 'ArrowRight'
                              ? nativeHead === textarea.value.length
                              : e.key === 'ArrowUp'
                                ? !textarea.value.slice(0, nativeHead).includes('\n')
                                : !textarea.value.slice(nativeHead).includes('\n');
                if (atEdge) {
                    let whole = new NativeText(doc.value),
                        position = doc.position(head),
                        next =
                            e.key === 'ArrowLeft'
                                ? whole.toSource(whole.toNative(head) - 1)
                                : e.key === 'ArrowRight'
                                  ? whole.toSource(whole.toNative(head) + 1)
                                  : doc.offset(position.line + (e.key === 'ArrowUp' ? -1 : 1), position.column);
                    e.preventDefault();
                    api.select({
                        start: Math.min(anchor, next),
                        end: Math.max(anchor, next),
                        direction: next < anchor ? 'backward' : 'forward'
                    });
                    return;
                }
            }
            if (!e.shiftKey && doc.selection.start === doc.selection.end && e.key.startsWith('Arrow')) {
                let caret = textarea.selectionStart,
                    move: number | undefined;
                if (e.key === 'ArrowLeft' && caret === 0 && active.from > 0) {
                    let whole = new NativeText(doc.value);
                    move = whole.toSource(whole.toNative(active.from) - 1);
                }
                if (e.key === 'ArrowRight' && caret === textarea.value.length && active.to < doc.value.length)
                    move = active.to;
                let position = doc.position();
                if (e.key === 'ArrowUp' && !textarea.value.slice(0, caret).includes('\n') && active.from > 0)
                    move = doc.offset(position.line - 1, position.column);
                if (
                    e.key === 'ArrowDown' &&
                    !textarea.value.slice(caret).includes('\n') &&
                    active.to < doc.value.length
                )
                    move = doc.offset(position.line + 1, position.column);
                if (move !== undefined) {
                    e.preventDefault();
                    api.select({ start: move });
                    return;
                }
            }
            if (ui.readonly) return;
            if (mod && (key === 'b' || key === 'i')) {
                e.preventDefault();
                key === 'b' ? api.bold() : api.italic();
            } else if (mod && key === 'z') {
                e.preventDefault();
                e.shiftKey ? api.redo() : api.undo();
            } else if (mod && key === 'y') {
                e.preventDefault();
                api.redo();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                api.newline();
            } else if (e.key === 'Backspace' && markdownBackspace(doc)) e.preventDefault();
        });
        removers.push(
            doc.subscribe((state, change) => {
                let { selections, ...single } = state;
                (api.state.selections as Selection[]).splice(
                    0,
                    api.state.selections.length,
                    ...selections.map((range) => ({ ...range }))
                );
                Object.assign(api.state, single, { selection: { ...state.selection } });
                if (change.textChanged && folds.length) {
                    folds = mapFolds(folds, change.editBatches ?? [], doc.value);
                    parsedSource = '\u0000' + doc.value;
                }
                if (change.selectionChanged) revealFolds(doc.selections);
                if ((composing || compositionPending) && change.textChanged) compositionConflict = true;
                update();
                if (change.selectionChanged) reveal();
                if (change.textChanged) callbacks.onChange?.(state.value, change, state);
                if (change.textChanged && focused && !ui.readonly) options.onAutocomplete?.(api as Controller, false);
                if (change.selectionChanged) callbacks.onSelection?.(state.selection, doc.position());
            })
        );
        const mutable = () => !disposed && !composing && !compositionPending && !ui.readonly;
        const api: MarkdownController = {
            document: doc,
            state,
            textarea,
            rectAt,
            offsetAt,
            refresh() {
                if (!disposed) {
                    measured.clear();
                    layoutWidth = 0;
                    update();
                }
            },
            focus() {
                if (!disposed) {
                    focused = true;
                    update();
                    reveal();
                    flush();
                    textarea.focus({ preventScroll: true });
                }
            },
            select(selection, shouldReveal = true) {
                api.selectMany([selection], shouldReveal);
            },
            selectMany(selections, shouldReveal = true) {
                if (!disposed && !composing && !compositionPending) {
                    revealFolds(selections);
                    focused = true;
                    doc.selectMany(selections);
                    update();
                    if (shouldReveal) reveal();
                    flush();
                    textarea.focus({ preventScroll: true });
                }
            },
            addNextOccurrence(all = false) {
                if (disposed || composing || compositionPending) return false;
                readSelection();
                let changed = addNextOccurrence(doc, all);
                api.focus();
                return changed;
            },
            insert(text) {
                return mutable() && insertText(doc, text);
            },
            undoSelection() {
                return !disposed && !composing && !compositionPending && doc.undoSelection();
            },
            redoSelection() {
                return !disposed && !composing && !compositionPending && doc.redoSelection();
            },
            indent() {
                return mutable() && indent(doc, options.indent);
            },
            outdent() {
                return mutable() && indent(doc, options.indent, true);
            },
            newline() {
                return mutable() && markdownCommand(doc, 'enter');
            },
            lineCommand(command) {
                return mutable() && lineCommand(doc, command);
            },
            toggleComment() {
                return (
                    mutable() &&
                    toggleComment(doc, options.lineComment ?? false, options.blockComment ?? ['<!--', '-->'])
                );
            },
            fold(line = doc.position().line) {
                if (disposed || composing || compositionPending || !options.fold) return false;
                let candidate = availableFolds.find((fold) => fold.line === line);
                if (!candidate || folds.some((fold) => fold.from === candidate.from && fold.to === candidate.to))
                    return false;
                if (
                    doc.selections.some(
                        (range) =>
                            (range.start >= candidate.from && range.start < candidate.to) ||
                            (range.end > candidate.from && range.end <= candidate.to)
                    )
                )
                    doc.select({ start: candidate.open });
                folds.push(candidate);
                focused = false;
                textarea.blur();
                rebuildFolds();
                return true;
            },
            unfold(line = doc.position().line) {
                if (disposed || composing || compositionPending) return false;
                let previous = folds.length;
                folds = folds.filter((fold) => fold.line !== line);
                if (folds.length === previous) return false;
                rebuildFolds();
                return true;
            },
            foldAll() {
                if (disposed || composing || compositionPending || !options.fold) return;
                doc.select({ start: 0 });
                folds = [...availableFolds];
                focused = false;
                textarea.blur();
                rebuildFolds();
            },
            unfoldAll() {
                if (disposed || composing || compositionPending) return;
                folds = [];
                rebuildFolds();
            },
            goToLine(line, column = 1) {
                api.select({ start: doc.offset(line, column) });
            },
            find(query, searchOptions) {
                return controls!.find(query, searchOptions);
            },
            findNext() {
                return controls!.findNext();
            },
            findPrevious() {
                return controls!.findPrevious();
            },
            replace(replacement) {
                return controls!.replace(replacement);
            },
            replaceAll(replacement) {
                return controls!.replaceAll(replacement);
            },
            openFind(replace) {
                if (!disposed && !composing && !compositionPending) controls!.openFind(replace);
            },
            closeFind() {
                if (!disposed) controls!.closeFind();
            },
            openGoToLine() {
                if (!disposed && !composing && !compositionPending) controls!.openGoToLine();
            },
            setValue(value) {
                if (disposed) return false;
                if (composing || compositionPending) {
                    pendingValue = value;
                    return false;
                }
                return doc.setValue(value, { source: 'external' });
            },
            setOptions(next, replace = false) {
                if (disposed) return;
                options = replace ? { wrap: true, ...next } : { ...options, ...next };
                ui.readonly = !!options.readonly;
                ui.label = options.label ?? 'Markdown editor';
                ui.spellcheck = options.spellcheck ?? true;
                ui.placeholder = options.placeholder ?? '';
                if (!options.fold) folds = [];
                textarea.wrap = options.wrap === false ? 'off' : 'soft';
                controls?.setOptions(options);
                rebuildFolds();
            },
            bold() {
                return mutable() && markdownCommand(doc, 'bold');
            },
            italic() {
                return mutable() && markdownCommand(doc, 'italic');
            },
            undo() {
                return mutable() && doc.undo();
            },
            redo() {
                return mutable() && doc.redo();
            },
            save() {
                if (!disposed) callbacks.onSave?.(doc.value, doc.state);
            },
            dispose() {
                if (disposed || disposing) return;
                disposing = true;
                finishComposition();
                disposed = true;
                win.cancelAnimationFrame(frame);
                controls?.dispose();
                for (let remove of removers) remove();
                unrender();
                if (addedClass) host.classList.remove('markdown-editor');
                disposeScope();
                disposing = false;
            }
        };
        controls = mountMarkdownControls(
            host,
            api as Controller,
            () => {
                let visible = layout.window(adjustedY(surface.scrollTop), surface.clientHeight || 320, 0);
                return {
                    total:
                        layout.total +
                        (focused && !ui.mixed
                            ? activeHeight - (layout.prefix(activeEnd) - layout.prefix(activeStart))
                            : 0),
                    top: surface.scrollTop,
                    height: surface.clientHeight || 320,
                    from: renderBlocks[visible.start]?.from ?? 0,
                    to: renderBlocks[visible.end - 1]?.to ?? doc.value.length,
                    y: sourceY,
                    scroll(y) {
                        surface.scrollTop = Math.max(0, y);
                        showWindow();
                        scheduleMeasure();
                    }
                };
            },
            mutable,
            options
        );
        update();
        return api;
    });
}
