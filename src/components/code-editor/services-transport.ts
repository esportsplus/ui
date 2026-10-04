import type { LanguageTransport, Notification, ServiceResults } from './services-protocol';

/** Adapts the reference plugin's editor.lsp.* RPC envelope; never starts a server. */
export function referenceRpcTransport(config: {
    invoke(method: string, payload?: unknown): Promise<unknown>;
    subscribe(channel: 'editor.lsp.notification', listener: (event: Notification & { cwd?: string; languageId?: string }) => void): VoidFunction;
    cwd: string; languageId: string;
}): LanguageTransport {
    return {
        async request<M extends keyof ServiceResults>(method: M, params: unknown, signal?: AbortSignal): Promise<ServiceResults[M]> {
            signal?.throwIfAborted();
            let response = await config.invoke('editor.lsp.request', { cwd: config.cwd, languageId: config.languageId, method, params });
            signal?.throwIfAborted();
            return (response as { result: ServiceResults[M] }).result;
        },
        async notify(method, params) {
            await config.invoke('editor.lsp.notify', { cwd: config.cwd, languageId: config.languageId, method, params });
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

/** Explicit fixture data only. No synthetic diagnostics or hard-coded intelligence in production. */
export function mockLanguageTransport(handlers: {
    completion?: (params: unknown, signal?: AbortSignal) => ServiceResults['textDocument/completion'] | Promise<ServiceResults['textDocument/completion']>;
    hover?: (params: unknown, signal?: AbortSignal) => ServiceResults['textDocument/hover'] | Promise<ServiceResults['textDocument/hover']>;
} = {}) {
    let listeners = new Set<(event: Notification) => void>();
    let notifications: Notification[] = [], requests: Notification[] = [];
    const transport: Omit<LanguageTransport, 'notify'> & { notify(method: string, params: unknown): void } = {
        async request<M extends keyof ServiceResults>(method: M, params: unknown, signal?: AbortSignal): Promise<ServiceResults[M]> {
            requests.push({ method, params }); signal?.throwIfAborted();
            let result = method === 'textDocument/completion' ? await handlers.completion?.(params, signal) : await handlers.hover?.(params, signal);
            signal?.throwIfAborted();
            return (result ?? null) as ServiceResults[M];
        },
        notify(method, params) { notifications.push({ method, params }); },
        subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }
    };
    return { transport, notifications, requests, publish(event: Notification) { for (let listener of listeners) listener(event); }, get subscribers() { return listeners.size; } };
}
