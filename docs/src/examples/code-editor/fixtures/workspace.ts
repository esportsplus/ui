import {
    containsPath,
    DEFAULTS,
    workspacePath,
    type WorkspaceChange,
    type WorkspaceEntry,
    type WorkspaceHost,
    type WorkspacePreferences
} from '@esportsplus/ui/components/code-editor/workspace/model';

/** Deterministic complete host for tests and interactive examples, including watcher and undo receipts.
 * @throws {Error} An invalid initial file path.
 */
export function createMemoryWorkspaceHost(
    files: Readonly<Record<string, string>>,
    initial: Partial<WorkspacePreferences> = {},
    emptyDirectories: readonly string[] = []
) {
    let contents = new Map(Object.entries(files).map(([path, text]) => [workspacePath(path), text])),
        directories = new Set(emptyDirectories.map((path) => workspacePath(path))),
        watchers = new Set<(event: WorkspaceChange) => void>(),
        preferences = { ...DEFAULTS, ...initial },
        operations = new Map<string, { undo: VoidFunction }>(),
        id = 0,
        mentions: string[] = [],
        copiedPaths: string[] = [],
        writes: { path: string; content: string }[] = [];
    let changed = (paths: readonly string[]) => {
        for (let watcher of [...watchers]) watcher({ paths });
    };
    let parents = (path: string) => {
        let parts = path.split('/');
        for (let length = 1; length < parts.length; length++) directories.add(parts.slice(0, length).join('/'));
    };
    for (let path of [...contents.keys(), ...directories]) parents(path);
    let list = () => {
        let entries = new Map<string, WorkspaceEntry>();
        for (let path of directories) entries.set(path, { path, kind: 'directory' });
        for (let path of contents.keys()) {
            entries.set(path, { path, kind: 'file' });
        }
        return [...entries.values()].sort((a, b) => a.path.localeCompare(b.path));
    };
    let receipt = (undo: VoidFunction) => {
        let operationId = `memory-${++id}`;
        operations.set(operationId, { undo });
        return { operationId };
    };
    const host: WorkspaceHost = {
        list: async () => list(),
        read: async (_cwd, path) => {
            if (!contents.has(path)) throw new Error(`File not found: ${path}`);
            return contents.get(path)!;
        },
        write: async (_cwd, path, content) => {
            parents(path);
            contents.set(path, content);
            writes.push({ path, content });
            changed([path]);
        },
        rename: async (_cwd, source, destination) => {
            let moved = [...contents].filter(([path]) => containsPath(source, path));
            if (!moved.length && !directories.has(source)) throw new Error('Source does not exist');
            if (list().some((entry) => containsPath(destination, entry.path)))
                throw new Error('Destination already exists');
            let move = (from: string, to: string) => {
                let items = [...contents].filter(([path]) => containsPath(from, path));
                let folders = [...directories].filter((path) => containsPath(from, path));
                for (let [path] of items) contents.delete(path);
                for (let [path, value] of items) contents.set(to + path.slice(from.length), value);
                for (let path of folders) directories.delete(path);
                for (let path of folders) directories.add(to + path.slice(from.length));
                parents(to);
            };
            move(source, destination);
            changed([source, destination]);
            return receipt(() => {
                if (list().some((entry) => containsPath(source, entry.path)))
                    throw new Error('Undo destination already exists');
                move(destination, source);
                changed([source, destination]);
            });
        },
        delete: async (_cwd, paths) => {
            let removed = [...contents].filter(([path]) => paths.some((parent) => containsPath(parent, path)));
            let removedDirectories = [...directories].filter((path) =>
                paths.some((parent) => containsPath(parent, path))
            );
            for (let [path] of removed) contents.delete(path);
            for (let path of removedDirectories) directories.delete(path);
            changed(paths);
            return receipt(() => {
                if (
                    removed.some(([path]) => contents.has(path)) ||
                    removedDirectories.some((path) => contents.has(path))
                )
                    throw new Error('Cannot overwrite a file created after deletion');
                for (let [path, value] of removed) contents.set(path, value);
                for (let path of removedDirectories) directories.add(path);
                changed(paths);
            });
        },
        undo: async (_cwd, operationId) => {
            let operation = operations.get(operationId);
            if (!operation) throw new Error('Unknown operation');
            operation.undo();
            operations.delete(operationId);
        },
        watch: (_cwd, listener) => {
            watchers.add(listener);
            return () => {
                watchers.delete(listener);
            };
        },
        preferences: {
            get: async () => ({ ...preferences }),
            set: async (next) => {
                preferences = { ...next };
            }
        },
        mention: (_cwd, path) => {
            mentions.push(path);
        },
        copyPath: (cwd, path) => {
            copiedPaths.push(`${cwd.replace(/[\\/]+$/, '')}/${path}`);
        }
    };
    return Object.assign(host, {
        contents,
        directories,
        mentions,
        copiedPaths,
        writes,
        watchCount: () => watchers.size,
        change(path: string, content: string | null) {
            path = workspacePath(path);
            if (content === null) contents.delete(path);
            else {
                parents(path);
                contents.set(path, content);
            }
            changed([path]);
        }
    });
}
