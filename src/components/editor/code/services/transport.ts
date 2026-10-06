import type { LanguageTransport, Notification, ServiceResults } from './protocol';


type Reference = {
    cwd: string;
    invoke(method: string, payload?: unknown): Promise<unknown>;
    languageId: string;
    subscribe(channel: 'editor.lsp.notification', listener: (event: Notification & { cwd?: string; languageId?: string }) => void): VoidFunction;
};


// Adapts the reference plugin's 'editor.lsp.*' RPC envelope. It never starts a server; the host owns that.
const referenceRpcTransport = ({ cwd, invoke, languageId, subscribe }: Reference): LanguageTransport => ({
    notify: async (method, params) => {
        await invoke('editor.lsp.notify', { cwd, languageId, method, params });
    },
    request: async <M extends keyof ServiceResults>(method: M, params: unknown, signal?: AbortSignal) => {
        signal?.throwIfAborted();

        let response = await invoke('editor.lsp.request', { cwd, languageId, method, params }) as { result?: ServiceResults[M] } | null;

        signal?.throwIfAborted();

        return (response?.result ?? null) as ServiceResults[M];
    },
    subscribe: (listener) => subscribe('editor.lsp.notification', (event) => {
        if ((event.cwd !== undefined && event.cwd !== cwd) || (event.languageId !== undefined && event.languageId !== languageId)) {
            return;
        }

        listener(event);
    })
});


export { referenceRpcTransport };
