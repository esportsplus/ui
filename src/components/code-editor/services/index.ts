import { flush, reactive, root } from '@esportsplus/reactivity';
import { html, render } from '@esportsplus/template';
import { lineEnd, type EditorDocument, type Edit } from '../document';
import {
    applyCompletion,
    editRange,
    fileUri,
    languageIdFor,
    localWords,
    positionAt,
    remapSnippet,
    type SnippetStop
} from './model';
import type { CompletionItem, Diagnostic, Hover, LanguageTransport, PublishDiagnostics } from './protocol';
export type ServiceController = {
    readonly document: EditorDocument;
    readonly textarea: HTMLTextAreaElement;
    focus(): void;
    select(selection: { start: number; end?: number }, reveal?: boolean): void;
    rectAt(offset: number): { left: number; top: number; width: number; height: number } | null;
    offsetAt(clientX: number, clientY: number): number | null;
    refresh(): void;
};
export type LanguageServiceOptions = {
    fileName: string;
    cwd?: string;
    uri?: string;
    languageId?: string;
    transport?: LanguageTransport;
    changeDelay?: number;
    completionDelay?: number;
    hoverDelay?: number;
    /** Real document words only, and only when no server provider was supplied. */
    localCompletion?: boolean;
    onError?: (error: unknown) => void;
};
export type LanguageServices = {
    dispose(): void;
    requestCompletion(): Promise<void>;
    requestHover(offset: number): Promise<void>;
};
type Squiggle = { style: string; severity: string; message: string };
let uid = 0;

export function mountLanguageServices(
    host: HTMLElement,
    controller: ServiceController,
    options: LanguageServiceOptions
): LanguageServices {
    return root((disposeScope) => {
        let doc = controller.document,
            win = host.ownerDocument.defaultView!,
            transport = options.transport,
            uri = options.uri ?? fileUri(options.cwd ?? '', options.fileName),
            languageId = options.languageId ?? languageIdFor(options.fileName),
            version = 0,
            synced = 0,
            disposed = false,
            composing = false,
            applying = false,
            chain = Promise.resolve(),
            completionAbort: AbortController | undefined,
            hoverAbort: AbortController | undefined,
            changeTimer: number | undefined,
            completeTimer: number | undefined,
            hoverTimer: number | undefined,
            frame = 0,
            completionRevision = -1,
            completionOffset = -1,
            hoverOffset = -1,
            stops: SnippetStop[] = [],
            stopIndex = -1,
            previousText = doc.value,
            diagnostics: Diagnostic[] = [],
            rows = reactive([] as { item: CompletionItem; index: number }[]),
            marks = reactive([] as Squiggle[]),
            messages = reactive([] as Diagnostic[]),
            ui = reactive({ selected: 0, completion: false, hover: '', completionStyle: '', hoverStyle: '' }),
            listId = `code-editor-completions-${++uid}`,
            removers: VoidFunction[] = [],
            layer = host.ownerDocument.createElement('div');
        layer.className = 'code-editor-services';
        host.append(layer);
        let unrender = render(
            layer,
            {},
            () => html`
            <div class='code-editor-diagnostics' aria-hidden='true'>${html.reactive(
                marks,
                (mark) => html`
                <span ${{ class: () => `code-editor-squiggle code-editor-squiggle--${mark.severity}`, style: () => mark.style, title: mark.message }}></span>
            `
            )}</div>
            <div class='code-editor-completions' role='listbox' ${{ id: listId, hidden: () => !ui.completion, style: () => ui.completionStyle, 'aria-label': 'Completions' }}>
                ${html.reactive(
                    rows,
                    ({ item, index }) => html`
                    <button type='button' role='option' ${{
                        id: `${listId}-${index}`,
                        'aria-selected': () => String(ui.selected === index),
                        onmousedown: (event: MouseEvent) => event.preventDefault(),
                        onmouseenter: () => {
                            ui.selected = index;
                        },
                        onclick: () => accept(index)
                    }}><span>${item.label}</span><small>${item.detail ?? ''}</small></button>
                `
                )}
            </div>
            <div class='code-editor-service-tooltip' role='tooltip' ${{ hidden: () => !ui.hover, style: () => ui.hoverStyle }}>${() => ui.hover}</div>
            <div class='code-editor-diagnostic-messages' aria-label='Diagnostics' aria-live='polite'>
                ${html.reactive(
                    messages,
                    (diagnostic) => html`
                    <button type='button' ${{
                        onclick: () => {
                            let range = editRange(doc, diagnostic.range);
                            if (range) {
                                controller.select({ start: range.from, end: range.to }, true);
                                controller.focus();
                            }
                        }
                    }}>${diagnostic.source ? `${diagnostic.source}: ` : ''}${diagnostic.message}</button>
                `
                )}
            </div>
        `
        );
        const report = (error: unknown) => {
            if (!disposed && !(error instanceof Error && error.name === 'AbortError')) options.onError?.(error);
        };
        function notify(method: string, params: unknown) {
            if (!transport) return chain;
            chain = chain.then(() => transport.notify(method, params)).catch(report);
            return chain;
        }
        if (transport)
            void notify('textDocument/didOpen', { textDocument: { uri, languageId, version, text: doc.value } });
        function sync() {
            win.clearTimeout(changeTimer);
            changeTimer = undefined;
            if (version === synced) return chain;
            synced = version;
            return notify('textDocument/didChange', {
                textDocument: { uri, version },
                contentChanges: [{ text: doc.value }]
            });
        }
        function hideCompletion() {
            ui.completion = false;
            rows.splice(0);
            completionAbort?.abort();
            controller.textarea.removeAttribute('aria-activedescendant');
            controller.textarea.removeAttribute('aria-controls');
            controller.textarea.removeAttribute('aria-expanded');
        }
        function clearHover() {
            win.clearTimeout(hoverTimer);
            hoverAbort?.abort();
            ui.hover = '';
            hoverOffset = -1;
        }
        function anchor(offset: number) {
            let rect = controller.rectAt(offset);
            if (!rect) return '';
            let box = controller.textarea.getBoundingClientRect();
            if (
                box.height &&
                (rect.top + rect.height < box.top ||
                    rect.top > box.bottom ||
                    rect.left < box.left ||
                    rect.left > box.right)
            )
                return '';
            return `left:${Math.max(0, rect.left)}px;top:${Math.max(0, rect.top + rect.height)}px;max-width:${Math.max(120, win.innerWidth - rect.left - 12)}px;`;
        }
        function ariaSelection() {
            if (!ui.completion) return;
            controller.textarea.setAttribute('aria-controls', listId);
            controller.textarea.setAttribute('aria-expanded', 'true');
            controller.textarea.setAttribute('aria-activedescendant', `${listId}-${ui.selected}`);
            flush();
            layer.querySelector(`[id='${listId}-${ui.selected}']`)?.scrollIntoView?.({ block: 'nearest' });
        }
        async function requestCompletion() {
            hideCompletion();
            if (disposed || composing || controller.textarea.readOnly || doc.selection.start !== doc.selection.end)
                return;
            let abort = (completionAbort = new AbortController()),
                revision = doc.state.revision,
                offset = doc.selection.end;
            try {
                await sync();
                if (abort.signal.aborted || disposed) return;
                let result = transport
                    ? await transport.request(
                          'textDocument/completion',
                          {
                              textDocument: { uri },
                              position: positionAt(doc, offset),
                              context: { triggerKind: 1 }
                          },
                          abort.signal
                      )
                    : options.localCompletion !== false
                      ? localWords(doc.value, offset)
                      : [];
                if (
                    disposed ||
                    abort.signal.aborted ||
                    revision !== doc.state.revision ||
                    offset !== doc.selection.end ||
                    composing
                )
                    return;
                let items = Array.isArray(result) ? result : (result?.items ?? []);
                items = items
                    .filter((item) => typeof item.label === 'string')
                    .sort((a, b) => (a.sortText ?? a.label).localeCompare(b.sortText ?? b.label));
                rows.splice(0, rows.length, ...items.slice(0, 200).map((item, index) => ({ item, index })));
                ui.selected = 0;
                completionRevision = revision;
                completionOffset = offset;
                ui.completionStyle = anchor(offset);
                ui.completion = !!rows.length && !!ui.completionStyle;
                ariaSelection();
            } catch (error) {
                report(error);
            }
        }
        function hoverText(hover: Hover) {
            const text = (value: unknown): string =>
                typeof value === 'string'
                    ? value
                    : value && typeof value === 'object' && 'value' in value
                      ? String(value.value)
                      : '';
            return Array.isArray(hover.contents)
                ? hover.contents.map(text).filter(Boolean).join('\n\n')
                : text(hover.contents);
        }
        async function requestHover(offset: number) {
            clearHover();
            if (!transport || disposed || composing) return;
            let abort = (hoverAbort = new AbortController()),
                revision = doc.state.revision;
            hoverOffset = offset;
            try {
                await sync();
                if (disposed || abort.signal.aborted) return;
                let hover = await transport.request(
                    'textDocument/hover',
                    { textDocument: { uri }, position: positionAt(doc, offset) },
                    abort.signal
                );
                if (disposed || abort.signal.aborted || revision !== doc.state.revision || composing) return;
                ui.hoverStyle = anchor(offset);
                ui.hover = hover && ui.hoverStyle ? hoverText(hover) : '';
            } catch (error) {
                report(error);
            }
        }
        function accept(index: number, commit = '') {
            if (
                disposed ||
                composing ||
                controller.textarea.readOnly ||
                completionRevision !== doc.state.revision ||
                completionOffset !== doc.selection.end
            )
                return;
            let item = rows[index]?.item;
            if (!item) return;
            applying = true;
            let nextStops = applyCompletion(doc, item, completionOffset, commit);
            applying = false;
            hideCompletion();
            stops = nextStops ?? [];
            stopIndex = stops.length ? 0 : -1;
            controller.focus();
            controller.refresh();
        }
        function paintDiagnostics() {
            frame = 0;
            if (disposed) return;
            let next: Squiggle[] = [],
                box = controller.textarea.getBoundingClientRect(),
                visibleFrom = box.height ? (controller.offsetAt(box.left, box.top) ?? 0) : 0,
                visibleTo = box.height
                    ? (controller.offsetAt(box.right, box.bottom) ?? doc.value.length)
                    : doc.value.length;
            for (let diagnostic of diagnostics) {
                let range = editRange(doc, diagnostic.range);
                if (!range) continue;
                if (range.to < visibleFrom || range.from > visibleTo) continue;
                range.from = Math.max(range.from, visibleFrom);
                range.to = Math.min(range.to, visibleTo);
                let p = positionAt(doc, range.from),
                    end = positionAt(doc, range.to);
                for (let line = p.line; line <= end.line && next.length < 1000; line++) {
                    let from = line === p.line ? range.from : doc.starts[line]!,
                        to = line === end.line ? range.to : lineEnd(doc.value, doc.starts, line),
                        left = controller.rectAt(from);
                    if (!left) continue;
                    // Scan geometry runs so wrapped lines get independent squiggles.
                    let run = left,
                        right = left.left + Math.max(2, left.width);
                    for (let offset = from + 1; offset <= to; offset++) {
                        let rect = controller.rectAt(offset);
                        if (!rect) break;
                        if (Math.abs(rect.top - run.top) > 1) {
                            next.push(mark(run, right, diagnostic));
                            run = rect;
                            right = rect.left;
                        }
                        right = Math.max(right, rect.left);
                    }
                    next.push(mark(run, right, diagnostic));
                }
            }
            marks.splice(0, marks.length, ...next.filter((item) => item.style));
            if (ui.completion) {
                ui.completionStyle = anchor(completionOffset);
                if (!ui.completionStyle) hideCompletion();
            }
            if (ui.hover && hoverOffset >= 0) ui.hoverStyle = anchor(hoverOffset);
        }
        function mark(
            rect: { left: number; top: number; height: number },
            right: number,
            diagnostic: Diagnostic
        ): Squiggle {
            let box = controller.textarea.getBoundingClientRect(),
                left = box.width ? Math.max(rect.left, box.left) : rect.left;
            if (box.width) right = Math.min(right, box.right);
            let visible = !box.height || (rect.top >= box.top && rect.top + rect.height <= box.bottom && right >= left);
            return {
                style: visible
                    ? `left:${left}px;top:${rect.top + rect.height - 3}px;width:${Math.max(3, right - left)}px;`
                    : '',
                severity: diagnostic.severity === 1 ? 'error' : diagnostic.severity === 2 ? 'warning' : 'info',
                message: diagnostic.message
            };
        }
        function schedulePaint() {
            if (!frame && !disposed) frame = win.requestAnimationFrame(paintDiagnostics);
        }
        if (transport)
            removers.push(
                transport.subscribe((event) => {
                    if (disposed || event.method !== 'textDocument/publishDiagnostics') return;
                    let params = event.params as PublishDiagnostics;
                    if (
                        params.uri !== uri ||
                        (params.version !== undefined && params.version !== version) ||
                        !Array.isArray(params.diagnostics)
                    )
                        return;
                    diagnostics = params.diagnostics.filter(
                        (d) => typeof d.message === 'string' && editRange(doc, d.range)
                    );
                    messages.splice(0, messages.length, ...diagnostics);
                    schedulePaint();
                })
            );
        function mirrorSnippet() {
            let current = stops[stopIndex];
            if (!current || current.index === 0) return;
            let value = doc.value.slice(current.from, current.to),
                edits: Edit[] = [];
            for (let stop of stops)
                if (stop !== current && stop.index === current.index && doc.value.slice(stop.from, stop.to) !== value)
                    edits.push({ from: stop.from, to: stop.to, insert: value });
            if (!edits.length) return;
            function map(offset: number, leftBias = false) {
                return (
                    offset +
                    edits
                        .filter((e) => e.to < offset || (e.to === offset && (!leftBias || e.from < e.to)))
                        .reduce((sum, e) => sum + e.insert.length - (e.to - e.from), 0)
                );
            }
            let next = stops.map((stop) => {
                    let edit = edits.find((e) => e.from === stop.from && e.to === stop.to),
                        from = map(stop.from, true);
                    return edit ? { ...stop, from, to: from + value.length } : { ...stop, from, to: map(stop.to) };
                }),
                selection = doc.selection;
            applying = true;
            let result = doc.tryTransact(edits, {
                source: 'snippet-mirror',
                group: 'insertText',
                selection: { start: map(selection.start), end: map(selection.end), direction: selection.direction }
            });
            applying = false;
            if (result.accepted) stops = next;
        }
        removers.push(
            doc.subscribe((_state, change) => {
                if (change.textChanged) {
                    let before = previousText;
                    previousText = doc.value;
                    version++;
                    clearHover();
                    hideCompletion();
                    diagnostics = [];
                    marks.splice(0);
                    messages.splice(0);
                    if (!applying) {
                        let mapped = remapSnippet(stops, stopIndex, before, doc.value);
                        if (!mapped || change.source === 'undo' || change.source === 'redo' || composing) {
                            stops = [];
                            stopIndex = -1;
                        } else {
                            stops = mapped;
                            let revision = doc.state.revision;
                            queueMicrotask(() => {
                                if (!disposed && doc.state.revision === revision) mirrorSnippet();
                            });
                        }
                    }
                    win.clearTimeout(changeTimer);
                    changeTimer = win.setTimeout(() => {
                        void sync();
                    }, options.changeDelay ?? 350);
                    win.clearTimeout(completeTimer);
                    if (
                        !applying &&
                        !composing &&
                        !stops.length &&
                        /[\w$.]$/.test(doc.value.slice(0, doc.selection.end))
                    )
                        completeTimer = win.setTimeout(() => {
                            void requestCompletion();
                        }, options.completionDelay ?? 100);
                } else if (change.selectionChanged && !applying) {
                    hideCompletion();
                    let current = stops[stopIndex];
                    if (current && (doc.selection.start < current.from || doc.selection.end > current.to)) {
                        stops = [];
                        stopIndex = -1;
                    }
                }
            })
        );
        function listen(target: EventTarget, type: string, listener: EventListener, capture = false) {
            target.addEventListener(type, listener, capture);
            removers.push(() => target.removeEventListener(type, listener, capture));
        }
        listen(
            host,
            'keydown',
            (event) => {
                let e = event as KeyboardEvent;
                if (e.isComposing || composing || e.target !== controller.textarea) return;
                if ((e.ctrlKey || e.metaKey) && e.key === ' ') {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    void requestCompletion();
                    return;
                }
                if (e.key === 'Escape' && (ui.completion || ui.hover)) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    win.clearTimeout(completeTimer);
                    hideCompletion();
                    clearHover();
                    return;
                }
                if (ui.completion) {
                    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        ui.selected = (ui.selected + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length;
                        ariaSelection();
                    } else if (e.key === 'Enter' || e.key === 'Tab') {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        accept(ui.selected);
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        hideCompletion();
                    } else if (
                        !e.ctrlKey &&
                        !e.metaKey &&
                        e.key.length === 1 &&
                        rows[ui.selected]?.item.commitCharacters?.includes(e.key)
                    ) {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        accept(ui.selected, e.key);
                    }
                } else if (e.key === 'Tab' && stops.length && !controller.textarea.readOnly) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    let index = stops[stopIndex]?.index;
                    do {
                        stopIndex += e.shiftKey ? -1 : 1;
                    } while (stops[stopIndex]?.index === index);
                    if (stopIndex < 0) stopIndex = 0;
                    let stop = stops[stopIndex];
                    if (stop) {
                        controller.select({ start: stop.from, end: stop.to }, true);
                        if (stop.index === 0) {
                            stops = [];
                            stopIndex = -1;
                        }
                    } else {
                        stops = [];
                        stopIndex = -1;
                    }
                } else if (e.key === 'Escape') clearHover();
            },
            true
        );
        listen(controller.textarea, 'compositionstart', () => {
            composing = true;
            hideCompletion();
            clearHover();
        });
        listen(controller.textarea, 'compositionend', () => {
            composing = false;
        });
        listen(controller.textarea, 'blur', () => {
            hideCompletion();
            clearHover();
        });
        listen(controller.textarea, 'mousemove', (event) => {
            let e = event as MouseEvent,
                offset = controller.offsetAt(e.clientX, e.clientY);
            win.clearTimeout(hoverTimer);
            clearHover();
            if (offset === null) return;
            let hit = diagnostics.filter((d) => {
                let range = editRange(doc, d.range);
                return range && offset >= range.from && offset <= range.to;
            });
            if (hit.length) {
                hoverOffset = offset;
                ui.hoverStyle = anchor(offset);
                ui.hover = hit.map((d) => d.message).join('\n');
                return;
            }
            hoverTimer = win.setTimeout(() => {
                void requestHover(offset);
            }, options.hoverDelay ?? 300);
        });
        listen(controller.textarea, 'mouseleave', () => {
            win.clearTimeout(hoverTimer);
            clearHover();
        });
        // Client-coordinate overlays must follow every scrolling ancestor, including the page.
        listen(win, 'scroll', schedulePaint, true);
        listen(win, 'resize', schedulePaint);
        const api: LanguageServices = {
            requestCompletion,
            requestHover,
            dispose() {
                if (disposed) return;
                void sync();
                disposed = true;
                hideCompletion();
                clearHover();
                win.clearTimeout(changeTimer);
                win.clearTimeout(completeTimer);
                win.clearTimeout(hoverTimer);
                win.cancelAnimationFrame(frame);
                for (let remove of removers) remove();
                void notify('textDocument/didClose', { textDocument: { uri } });
                unrender();
                layer.remove();
                disposeScope();
            }
        };
        return api;
    });
}

export { referenceRpcTransport } from './transport';
export { fileUri, languageIdFor } from './model';
export type {
    CompletionItem,
    Diagnostic,
    Hover,
    LanguageTransport,
    Notification,
    Position,
    Range,
    TextEdit
} from './protocol';
