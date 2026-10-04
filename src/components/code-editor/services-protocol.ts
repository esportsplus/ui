/** Browser-side subset of LSP 3.x. Positions and offsets are UTF-16. */
export type Position = { line: number; character: number };
export type Range = { start: Position; end: Position };
export type TextEdit = { range: Range; newText: string };
export type CompletionItem = {
    label: string; kind?: number; detail?: string; documentation?: string | { value: string };
    insertText?: string; insertTextFormat?: 1 | 2; sortText?: string; filterText?: string;
    textEdit?: TextEdit | { insert: Range; replace: Range; newText: string };
    additionalTextEdits?: TextEdit[]; commitCharacters?: string[];
};
export type CompletionResult = CompletionItem[] | { items: CompletionItem[]; isIncomplete?: boolean } | null;
export type Hover = { contents: string | { language?: string; value: string } | unknown[]; range?: Range };
export type Diagnostic = { range: Range; severity?: number; message: string; source?: string; code?: string | number };
export type Notification = { method: string; params: unknown };
export type ServiceResults = { 'textDocument/completion': CompletionResult; 'textDocument/hover': Hover | null };
export type LanguageTransport = {
    request<M extends keyof ServiceResults>(method: M, params: unknown, signal?: AbortSignal): Promise<ServiceResults[M]>;
    notify(method: string, params: unknown): Promise<void> | void;
    subscribe(listener: (event: Notification) => void): VoidFunction;
};
export type PublishDiagnostics = { uri: string; version?: number; diagnostics: Diagnostic[] };
