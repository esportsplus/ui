import { reactive } from '@esportsplus/reactivity';
import type { Change, Edit } from '../document';
import type { Rect } from '../layout';
import type { Mark } from '../rows';
import type { Controller, Options } from '../view';
import { completion } from './completion';
import { diagnostics } from './diagnostics';
import { hover, hoverText } from './hover';
import { applyCompletion, fileUri, identifier, languageIdFor, localWords, mapStops, positionAt, wordStart, type Span, type Stop } from './model';
import type { LanguageTransport, Notification, PublishDiagnostics } from './protocol';


type Host = {
    busy: () => boolean;
    controller: Controller;
    // Content-box caret rectangle of a source offset, as the scrolled layers draw it; null while folded away.
    rect: (offset: number) => Rect | null;
    schedule: VoidFunction;
};

type LanguageServiceOptions = {
    changeDelay?: number;
    completionDelay?: number;
    // Resolves a relative 'fileName' into the document's URI.
    cwd?: string;
    hoverDelay?: number;
    languageId?: string;
    // Without a transport, completes from the document's own words unless this is false.
    localCompletion?: boolean;
    onError?: (error: unknown) => void;
    transport?: LanguageTransport;
    uri?: string;
};

type Session = {
    languageId: string;
    listen: VoidFunction;
    local: boolean;
    onError?: (error: unknown) => void;
    transport?: LanguageTransport;
    unsubscribe?: VoidFunction;
    uri: string;
};


const EMPTY: readonly Mark[] = [];


let uid = 0;


function aborted(error: unknown) {
    return (error as { name?: string } | null)?.name === 'AbortError';
}


// Language services for one editor: document sync, completion, hover and diagnostics over an LSP transport. The view
// owns it, configures it from its options and forwards the input it claims.
const session = (host: Host) => {
    let controller = host.controller,
        doc = controller.document,
        id = ++uid,
        anchors: { completion: string; enabled: boolean; hover: string } = reactive({ completion: '', enabled: false, hover: '' }),
        applying = false,
        // Source offsets the completion list and hover card are anchored at.
        at = { completion: -1, hover: -1 },
        card = hover(),
        // Where completion was requested; accepting anywhere else would apply a stale response.
        caret = { offset: -1, revision: -1 },
        chain: Promise<void> = Promise.resolve(),
        complete = completion(`code-editor-completions-${id}`),
        disposed = false,
        hovered: Span | null = null,
        opened: Session | null = null,
        problems = diagnostics(),
        readonly = false,
        requests: { completion?: AbortController; hover?: AbortController } = {},
        settings: LanguageServiceOptions = {},
        stop = -1,
        stops: Stop[] = [],
        synced = 0,
        timers: { change?: ReturnType<typeof setTimeout>; completion?: ReturnType<typeof setTimeout>; hover?: ReturnType<typeof setTimeout> } = {},
        version = 0;

    function accept(index: number, commit = '') {
        let item = complete.item(index),
            selection = doc.selection;

        if (!item || readonly || host.busy() || doc.revision !== caret.revision || selection.start !== caret.offset || selection.end !== caret.offset) {
            complete.hide();
            return;
        }

        let next: Stop[] | null;

        complete.hide();

        try {
            applying = true;
            next = applyCompletion(doc, item, caret.offset, commit);
        }
        finally {
            applying = false;
        }

        stops = next?.some((entry) => entry.index > 0) ? next : [];
        stop = stops.length ? 0 : -1;
        controller.select(doc.selection, true);
        controller.focus();
    }

    function changed(_: unknown, change: Change) {
        if (!opened) {
            return;
        }

        if (!change.textChanged) {
            if (change.selectionChanged && !applying) {
                let current = stops[stop],
                    selection = doc.selection;

                // The field reporting the same caret back, with only its direction settled, keeps the list.
                if (selection.start !== caret.offset || selection.end !== caret.offset) {
                    complete.hide();
                }

                if (current && (selection.start < current.from || selection.end > current.to)) {
                    end();
                }
            }

            return;
        }

        let batches = change.editBatches;

        version++;
        complete.hide();
        clearTimeout(timers.completion);
        hide();

        if (batches) {
            problems.map(batches);
        }
        else {
            problems.clear();
        }

        if (!applying && stops.length) {
            let mapped = batches && change.source !== 'redo' && change.source !== 'undo' && !host.busy() ? mapStops(stops, stop, batches) : null;

            if (mapped) {
                let revision = doc.revision;

                stops = mapped;
                queueMicrotask(() => {
                    if (!disposed && doc.revision === revision) {
                        mirror();
                    }
                });
            }
            else {
                end();
            }
        }

        clearTimeout(timers.change);
        timers.change = setTimeout(() => void sync(), settings.changeDelay ?? 350);

        let trigger = applying || stops.length ? null : typed(change);

        if (trigger !== null) {
            timers.completion = setTimeout(() => void suggest(trigger), settings.completionDelay ?? 100);
        }
    }

    function close() {
        let current = opened;

        if (!current) {
            return;
        }

        dismiss();
        end();
        void sync();
        void notify('textDocument/didClose', { textDocument: { uri: current.uri } });
        clearTimeout(timers.change);
        current.listen();
        current.unsubscribe?.();
        opened = null;
        anchors.enabled = false;
        problems.clear();
        host.schedule();
    }

    async function describe(span: Span) {
        let current = opened,
            request = (requests.hover = new AbortController()),
            revision = doc.revision;

        if (!current?.transport) {
            return;
        }

        try {
            await sync();

            if (request.signal.aborted || opened !== current) {
                return;
            }

            let value = await current.transport.request(
                'textDocument/hover',
                { position: positionAt(doc, span.from), textDocument: { uri: current.uri } },
                request.signal
            );

            if (request.signal.aborted || opened !== current || doc.revision !== revision || hovered !== span || host.busy() || !value) {
                return;
            }

            show(span.from, hoverText(value));
        }
        catch (error) {
            report(error, current);
        }
    }

    function dismiss() {
        clearTimeout(timers.completion);
        requests.completion?.abort();
        complete.hide();
        hide();
    }

    function end() {
        stop = -1;
        stops = [];
    }

    function hide() {
        clearTimeout(timers.hover);
        requests.hover?.abort();
        at.hover = -1;
        card.hide();
        hovered = null;
    }

    function jump(backward: boolean) {
        let index = stops[stop]?.index;

        do {
            stop += backward ? -1 : 1;
        } while (stops[stop]?.index === index);

        let target = stops[Math.max(0, stop)];

        stop = Math.max(0, stop);

        if (!target) {
            end();
            return;
        }

        controller.select({ end: target.to, start: target.from }, true);

        if (target.index === 0) {
            end();
        }
    }

    // Copies the active placeholder's text into its mirrors, the other stops with its number.
    function mirror() {
        let current = stops[stop];

        if (!current || current.index === 0) {
            return;
        }

        let edits: Edit[] = [],
            value = doc.value.slice(current.from, current.to);

        for (let i = 0, n = stops.length; i < n; i++) {
            let entry = stops[i];

            if (entry !== current && entry.index === current.index && doc.value.slice(entry.from, entry.to) !== value) {
                edits.push({ from: entry.from, insert: value, to: entry.to });
            }
        }

        if (!edits.length) {
            return;
        }

        let shift = (offset: number, own?: Edit) => {
                let total = 0;

                for (let i = 0, n = edits.length; i < n; i++) {
                    if (edits[i] !== own && edits[i].to <= offset) {
                        total += value.length - (edits[i].to - edits[i].from);
                    }
                }

                return offset + total;
            },
            next = stops.map((entry) => {
                let own = edits.find((edit) => edit.from === entry.from && edit.to === entry.to && entry !== current),
                    from = shift(entry.from, own);

                return { from, index: entry.index, to: own ? from + value.length : shift(entry.to, own) };
            }),
            selection = doc.selection,
            result;

        try {
            applying = true;
            result = doc.transact(edits, {
                group: 'insertText',
                selection: { direction: selection.direction, end: shift(selection.end), start: shift(selection.start) },
                source: 'snippet'
            });
        }
        finally {
            applying = false;
        }

        if (result.accepted) {
            stops = next;
        }
    }

    function notify(method: string, params: unknown) {
        let transport = opened?.transport,
            current = opened;

        if (!transport || !current) {
            return chain;
        }

        chain = chain.then(() => transport.notify(method, params)).catch((error) => report(error, current));

        return chain;
    }

    function open(next: Omit<Session, 'listen' | 'unsubscribe'>) {
        opened = { ...next, listen: doc.subscribe(changed) };
        synced = version;
        anchors.enabled = true;

        if (!next.transport) {
            return;
        }

        void notify('textDocument/didOpen', {
            textDocument: { languageId: next.languageId, text: doc.value, uri: next.uri, version }
        });
        opened.unsubscribe = next.transport.subscribe(publish);
    }

    function place(offset: number) {
        let rect = offset < 0 ? null : host.rect(offset);

        return rect ? `height: ${rect.height}px; left: ${rect.left}px; top: ${rect.top}px;` : '';
    }

    function publish(event: Notification) {
        let params = event.params as PublishDiagnostics | null;

        if (
            !opened ||
            event.method !== 'textDocument/publishDiagnostics' ||
            params?.uri !== opened.uri ||
            (params.version !== undefined && params.version !== version) ||
            !Array.isArray(params.diagnostics)
        ) {
            return;
        }

        problems.publish(doc, params.diagnostics);
        host.schedule();
    }

    function report(error: unknown, current: Session) {
        if (!disposed && !aborted(error)) {
            current.onError?.(error);
        }
    }

    function show(offset: number, text: string) {
        let anchor = place(offset);

        if (!anchor || !text) {
            return;
        }

        anchors.hover = anchor;
        at.hover = offset;
        card.show(text);
    }

    async function suggest(character = '') {
        let current = opened,
            selection = doc.selection;

        dismiss();

        if (!current || disposed || readonly || host.busy() || selection.start !== selection.end || doc.selections.length > 1) {
            return;
        }

        let offset = selection.end,
            request = (requests.completion = new AbortController()),
            revision = doc.revision;

        try {
            await sync();

            if (request.signal.aborted || opened !== current) {
                return;
            }

            let result = current.transport
                ? await current.transport.request(
                    'textDocument/completion',
                    {
                        context: character ? { triggerCharacter: character, triggerKind: 2 } : { triggerKind: 1 },
                        position: positionAt(doc, offset),
                        textDocument: { uri: current.uri }
                    },
                    request.signal
                )
                : current.local ? localWords(doc.value, offset) : [];

            if (
                request.signal.aborted ||
                opened !== current ||
                doc.revision !== revision ||
                doc.selection.start !== offset ||
                doc.selection.end !== offset ||
                host.busy()
            ) {
                return;
            }

            let start = wordStart(doc.value, offset),
                anchor = place(start);

            if (!anchor) {
                return;
            }

            anchors.completion = anchor;
            at.completion = start;
            caret.offset = offset;
            caret.revision = revision;
            complete.show(Array.isArray(result) ? result : result?.items ?? []);
        }
        catch (error) {
            report(error, current);
        }
    }

    function sync() {
        clearTimeout(timers.change);

        if (!opened || version === synced) {
            return chain;
        }

        synced = version;

        return notify('textDocument/didChange', {
            contentChanges: [{ text: doc.value }],
            textDocument: { uri: opened.uri, version }
        });
    }

    // The text under a client point, when the point is on it rather than past a line's end.
    function target(x: number, y: number): Span | null {
        let offset = controller.offsetAt(x, y);

        if (offset === null) {
            return null;
        }

        let text = doc.value,
            from = wordStart(text, offset),
            to = offset;

        while (to < text.length && identifier(text.charCodeAt(to))) {
            to++;
        }

        if (from === to) {
            if (offset >= doc.lineEnd(doc.lineAt(offset))) {
                return null;
            }

            to = from + 1;
        }

        let start = controller.rectAt(from),
            end = controller.rectAt(to);

        if (!start || !end || x < start.left || y < start.top || y > end.top + end.height || (end.top === start.top && x > end.left)) {
            return null;
        }

        return { from, to };
    }

    // The character that should open completion after a keystroke: '' within a word, '.' after a member access, null
    // when nothing was typed.
    function typed(change: Change) {
        let batches = change.editBatches,
            last = batches?.[batches.length - 1],
            selection = doc.selection;

        if (
            (change.source !== 'composition' && change.source !== 'input') ||
            !last?.some((edit) => edit.insert.length > 0) ||
            selection.start !== selection.end ||
            doc.selections.length > 1
        ) {
            return null;
        }

        let code = doc.value.charCodeAt(selection.end - 1);

        return code === 46 ? '.' : identifier(code) ? '' : null;
    }

    let api = {
        accept,
        anchors,
        aria: {
            ...complete.aria,
            'aria-autocomplete': () => anchors.enabled && 'list'
        },
        card,
        complete,
        configure: (options: Options) => {
            let next = options.services;

            readonly = !!options.readonly;

            if (readonly) {
                complete.hide();
            }

            if (!next || disposed) {
                close();
                settings = {};
                return;
            }

            let name = options.fileName ?? 'untitled',
                languageId = next.languageId ?? languageIdFor(name),
                local = next.localCompletion !== false,
                uri = next.uri ?? fileUri(next.cwd ?? '', name);

            settings = next;

            if (opened && opened.transport === next.transport && opened.uri === uri && opened.languageId === languageId) {
                opened.local = local;
                opened.onError = next.onError;
                return;
            }

            close();
            open({ languageId, local, onError: next.onError, transport: next.transport, uri });
        },
        diagnostics: problems,
        dismiss,
        dispose: () => {
            if (disposed) {
                return;
            }

            close();
            disposed = true;
            clearTimeout(timers.change);
            clearTimeout(timers.completion);
            clearTimeout(timers.hover);
        },
        id,
        // Claims the keys completion and snippets own before the editor's keymap sees them.
        keydown: (e: KeyboardEvent) => {
            if (!opened || e.isComposing) {
                return false;
            }

            if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.code === 'Space') {
                void suggest();
                return true;
            }

            if (e.key === 'Escape' && (complete.state.open || card.state.open)) {
                dismiss();
                return true;
            }

            let plain = !e.altKey && !e.ctrlKey && !e.metaKey;

            if (complete.state.open) {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    complete.move(e.key === 'ArrowDown' ? 1 : -1);
                    return true;
                }

                if (plain && !e.shiftKey && (e.key === 'Enter' || e.key === 'Tab')) {
                    accept(complete.state.selected);
                    return true;
                }

                if (plain && e.key.length === 1 && complete.item()?.commitCharacters?.includes(e.key)) {
                    accept(complete.state.selected, e.key);
                    return true;
                }

                return false;
            }

            if (e.key === 'Escape') {
                end();
                return false;
            }

            if (e.key === 'Tab' && plain && stops.length && !readonly) {
                jump(e.shiftKey);
                return true;
            }

            return false;
        },
        leave: hide,
        marks: (from: number, to: number) => opened && problems.count ? problems.marks(from, to) : EMPTY,
        // Keeps the anchors on their text through relayouts; a scroll moves them with the layer they sit in.
        paint: () => {
            if (complete.state.open) {
                let anchor = place(at.completion);

                if (!anchor) {
                    complete.hide();
                }
                else if (anchor !== anchors.completion) {
                    anchors.completion = anchor;
                }
            }

            if (card.state.open) {
                let anchor = place(at.hover);

                if (!anchor) {
                    hide();
                }
                else if (anchor !== anchors.hover) {
                    anchors.hover = anchor;
                }
            }
        },
        // Hovers the word, or the character, under the pointer: a diagnostic there shows at once, anything else asks
        // the server after the hover delay. The pointer staying on the same text keeps what's showing.
        pointer: (e: PointerEvent) => {
            if (!opened || e.buttons || host.busy()) {
                return;
            }

            let span = target(e.clientX, e.clientY);

            if (span && hovered && span.from === hovered.from && span.to === hovered.to) {
                return;
            }

            hide();
            hovered = span;

            if (!span) {
                return;
            }

            let hits = problems.hit(span.from, span.to);

            if (hits.length) {
                show(hits[0].from, hits.map((hit) => hit.label).join('\n'));
                return;
            }

            if (opened.transport) {
                timers.hover = setTimeout(() => void describe(span), settings.hoverDelay ?? 300);
            }
        },
        // Selects a diagnostic's source from the problems list.
        reveal: (from: number, to: number) => {
            controller.select({ end: to, start: from }, true);
            controller.focus();
        }
    };

    return api;
};


export { session };
export type { Host, LanguageServiceOptions };
