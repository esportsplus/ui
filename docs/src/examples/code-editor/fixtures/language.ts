import type {
    LanguageTransport,
    Notification,
    Position,
    ServiceResults
} from '@esportsplus/ui/components/code-editor/services/protocol';

/** Explicit fixture data only. No synthetic diagnostics or hard-coded intelligence in production. */
export function mockLanguageTransport(
    handlers: {
        completion?: (
            params: unknown,
            signal?: AbortSignal
        ) => ServiceResults['textDocument/completion'] | Promise<ServiceResults['textDocument/completion']>;
        hover?: (
            params: unknown,
            signal?: AbortSignal
        ) => ServiceResults['textDocument/hover'] | Promise<ServiceResults['textDocument/hover']>;
    } = {}
) {
    let listeners = new Set<(event: Notification) => void>();
    let notifications: Notification[] = [],
        requests: Notification[] = [];
    const transport: Omit<LanguageTransport, 'notify'> & { notify(method: string, params: unknown): void } = {
        async request<M extends keyof ServiceResults>(
            method: M,
            params: unknown,
            signal?: AbortSignal
        ): Promise<ServiceResults[M]> {
            requests.push({ method, params });
            signal?.throwIfAborted();
            let result =
                method === 'textDocument/completion'
                    ? await handlers.completion?.(params, signal)
                    : await handlers.hover?.(params, signal);
            signal?.throwIfAborted();
            return (result ?? null) as ServiceResults[M];
        },
        notify(method, params) {
            notifications.push({ method, params });
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        }
    };
    return {
        transport,
        notifications,
        requests,
        publish(event: Notification) {
            for (let listener of listeners) listener(event);
        },
        get subscribers() {
            return listeners.size;
        }
    };
}

/** Deterministic sample host for the demo. The component itself has no simulated server behavior. */
export function demoLanguageTransport(): LanguageTransport {
    const documents = new Map<string, string>();
    const fixture = mockLanguageTransport({
        completion: params => {
            const request = params as { textDocument: { uri: string }; position: Position };
            const line = (documents.get(request.textDocument.uri) ?? '').split(/\r\n|\r|\n/)[request.position.line] ?? '';
            const before = line.slice(0, request.position.character);
            const word = /[\w$]*$/.exec(before)?.[0] ?? '';
            return [
                { label: 'greet', kind: 3, detail: '(person: Person): string', insertText: 'greet' },
                { label: 'person', kind: 6, detail: 'Person', insertText: 'person' },
                { label: 'score', kind: 10, detail: 'number', insertText: 'score' }
            ].filter(item => item.label.startsWith(word)).map(item => ({
                ...item,
                textEdit: {
                    range: {
                        start: { line: request.position.line, character: request.position.character - word.length },
                        end: request.position
                    },
                    newText: item.insertText
                }
            }));
        },
        hover: () => ({ contents: 'Sample language service\nfunction greet(person: Person): string' })
    });
    return {
        request: fixture.transport.request,
        subscribe: fixture.transport.subscribe,
        notify(method, params) {
            fixture.transport.notify(method, params);
            const value = params as {
                textDocument: { uri: string; text?: string; version?: number };
                contentChanges?: { text: string }[];
            };
            const uri = value.textDocument.uri;
            if (method === 'textDocument/didClose') { documents.delete(uri); return; }
            const source = value.textDocument.text ?? value.contentChanges?.at(-1)?.text;
            if (source === undefined) return;
            documents.set(uri, source);
            const diagnostics = source.split(/\r\n|\r|\n/).flatMap((line, index) => {
                const column = line.indexOf('TODO_ERROR');
                return column < 0 ? [] : [{
                    range: { start: { line: index, character: column }, end: { line: index, character: column + 10 } },
                    severity: 1,
                    message: 'Replace TODO_ERROR with a number.',
                    source: 'Sample language service'
                }];
            });
            fixture.publish({ method: 'textDocument/publishDiagnostics', params: { uri, version: value.textDocument.version, diagnostics } });
        }
    };
}
