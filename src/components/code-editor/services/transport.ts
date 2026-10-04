import type { LanguageTransport, Notification, ServiceResults } from './protocol';

/** Adapts the reference plugin's editor.lsp.* RPC envelope; never starts a server. */
export function referenceRpcTransport(config: {
    invoke(method: string, payload?: unknown): Promise<unknown>;
    subscribe(
        channel: 'editor.lsp.notification',
        listener: (event: Notification & { cwd?: string; languageId?: string }) => void
    ): VoidFunction;
    cwd: string;
    languageId: string;
}): LanguageTransport {
    return {
        async request<M extends keyof ServiceResults>(
            method: M,
            params: unknown,
            signal?: AbortSignal
        ): Promise<ServiceResults[M]> {
            signal?.throwIfAborted();
            let response = await config.invoke('editor.lsp.request', {
                cwd: config.cwd,
                languageId: config.languageId,
                method,
                params
            });
            signal?.throwIfAborted();
            return (response as { result: ServiceResults[M] }).result;
        },
        async notify(method, params) {
            await config.invoke('editor.lsp.notify', {
                cwd: config.cwd,
                languageId: config.languageId,
                method,
                params
            });
        },
        subscribe(listener) {
            return config.subscribe('editor.lsp.notification', (event) => {
                if (event.cwd !== undefined && event.cwd !== config.cwd) return;
                if (event.languageId !== undefined && event.languageId !== config.languageId) return;
                listener(event);
            });
        }
    };
}
