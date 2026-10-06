// The browser-side subset of LSP 3.x the editor speaks. Positions and offsets are UTF-16.


type CompletionItem = {
    additionalTextEdits?: TextEdit[];
    commitCharacters?: string[];
    detail?: string;
    documentation?: string | { value: string };
    filterText?: string;
    insertText?: string;
    insertTextFormat?: 1 | 2;
    kind?: number;
    label: string;
    sortText?: string;
    textEdit?: TextEdit | { insert: Range; newText: string; replace: Range };
};

type CompletionResult = CompletionItem[] | { isIncomplete?: boolean; items: CompletionItem[] } | null;

type Diagnostic = { code?: number | string; message: string; range: Range; severity?: number; source?: string };

type Hover = { contents: string | unknown[] | { language?: string; value: string }; range?: Range };

type LanguageTransport = {
    notify(method: string, params: unknown): Promise<void> | void;
    request<M extends keyof ServiceResults>(method: M, params: unknown, signal?: AbortSignal): Promise<ServiceResults[M]>;
    subscribe(listener: (event: Notification) => void): VoidFunction;
};

type Notification = { method: string; params: unknown };

type Position = { character: number; line: number };

type PublishDiagnostics = { diagnostics: Diagnostic[]; uri: string; version?: number };

type Range = { end: Position; start: Position };

type ServiceResults = { 'textDocument/completion': CompletionResult; 'textDocument/hover': Hover | null };

type TextEdit = { newText: string; range: Range };


export type {
    CompletionItem,
    CompletionResult,
    Diagnostic,
    Hover,
    LanguageTransport,
    Notification,
    Position,
    PublishDiagnostics,
    Range,
    ServiceResults,
    TextEdit
};
