import type {
    CompletionResult,
    Diagnostic,
    Hover,
    LanguageTransport,
    Notification,
    Position,
    ServiceResults
} from '@esportsplus/ui/components/code-editor/services/protocol';


type Handlers = {
    completion?: (params: unknown, signal?: AbortSignal) => CompletionResult | Promise<CompletionResult>;
    hover?: (params: unknown, signal?: AbortSignal) => Hover | null | Promise<Hover | null>;
};

type Request = { position: Position; textDocument: { uri: string } };

type Sync = {
    contentChanges?: { text: string }[];
    textDocument: { text?: string; uri: string; version?: number };
};


const EOL = /\r\n|\r|\n/;

const MARKER = 'TODO_ERROR';

const SYMBOLS = [
    { detail: 'interface', hover: 'interface Person {\n    name: string;\n    score: number;\n}', kind: 8, label: 'Person' },
    { detail: '(person: Person): string', hover: 'function greet(person: Person): string', kind: 3, label: 'greet' },
    { detail: 'string', hover: '(property) Person.name: string', kind: 10, label: 'name' },
    { detail: 'Person', hover: 'const person: Person', kind: 6, label: 'person' },
    { detail: 'number', hover: '(property) Person.score: number', kind: 10, label: 'score' }
];

const WORD = /[\w$]/;


// A sample server for the docs, so the editor's own service code runs end to end: it completes and hovers a few
// fixed symbols and reports every 'TODO_ERROR' as an error.
const demoLanguageTransport = (): LanguageTransport => {
    let documents = new Map<string, string>();

    let fixture = mockLanguageTransport({
        completion: (params) => {
            let { position, textDocument } = params as Request,
                line = (documents.get(textDocument.uri) ?? '').split(EOL)[position.line] ?? '',
                word = /[\w$]*$/.exec(line.slice(0, position.character))?.[0] ?? '';

            return SYMBOLS.filter((symbol) => symbol.label.startsWith(word)).map(({ detail, kind, label }) => ({
                detail,
                kind,
                label,
                textEdit: {
                    newText: label,
                    range: { end: position, start: { character: position.character - word.length, line: position.line } }
                }
            }));
        },
        hover: (params) => {
            let { position, textDocument } = params as Request,
                line = (documents.get(textDocument.uri) ?? '').split(EOL)[position.line] ?? '',
                end = position.character,
                start = position.character;

            while (start > 0 && WORD.test(line[start - 1])) {
                start--;
            }

            while (end < line.length && WORD.test(line[end])) {
                end++;
            }

            let symbol = SYMBOLS.find((symbol) => symbol.label === line.slice(start, end));

            if (!symbol) {
                return null;
            }

            return {
                contents: symbol.hover,
                range: { end: { character: end, line: position.line }, start: { character: start, line: position.line } }
            };
        }
    });

    return {
        notify: (method, params) => {
            fixture.transport.notify(method, params);

            let { contentChanges, textDocument } = params as Sync,
                uri = textDocument.uri;

            if (method === 'textDocument/didClose') {
                documents.delete(uri);
                return;
            }

            let source = textDocument.text ?? contentChanges?.at(-1)?.text;

            if (source === undefined) {
                return;
            }

            let diagnostics: Diagnostic[] = [],
                lines = source.split(EOL);

            documents.set(uri, source);

            for (let i = 0, n = lines.length; i < n; i++) {
                let column = lines[i].indexOf(MARKER);

                if (column >= 0) {
                    diagnostics.push({
                        message: 'Replace TODO_ERROR with a number.',
                        range: { end: { character: column + MARKER.length, line: i }, start: { character: column, line: i } },
                        severity: 1,
                        source: 'Sample language service'
                    });
                }
            }

            fixture.publish({ method: 'textDocument/publishDiagnostics', params: { diagnostics, uri, version: textDocument.version } });
        },
        request: fixture.transport.request,
        subscribe: fixture.transport.subscribe
    };
};

// Answers from explicit handlers and records what it was sent, for the demo above and the service tests.
const mockLanguageTransport = (handlers: Handlers = {}) => {
    let listeners = new Set<(event: Notification) => void>(),
        notifications: Notification[] = [],
        requests: Notification[] = [];

    let transport = {
        notify: (method: string, params: unknown) => {
            notifications.push({ method, params });
        },
        request: async <M extends keyof ServiceResults>(method: M, params: unknown, signal?: AbortSignal) => {
            requests.push({ method, params });
            signal?.throwIfAborted();

            let result = method === 'textDocument/completion'
                ? await handlers.completion?.(params, signal)
                : await handlers.hover?.(params, signal);

            signal?.throwIfAborted();

            return (result ?? null) as ServiceResults[M];
        },
        subscribe: (listener: (event: Notification) => void) => {
            listeners.add(listener);

            return () => {
                listeners.delete(listener);
            };
        }
    } satisfies LanguageTransport;

    return {
        notifications,
        publish: (event: Notification) => {
            for (let listener of listeners) {
                listener(event);
            }
        },
        requests,
        get subscribers() {
            return listeners.size;
        },
        transport
    };
};


export { demoLanguageTransport, mockLanguageTransport };
