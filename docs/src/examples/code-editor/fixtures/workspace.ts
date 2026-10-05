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
function createMemoryWorkspaceHost(
    files: Readonly<Record<string, string>>,
    initial: Partial<WorkspacePreferences> = {},
    emptyDirectories: readonly string[] = []
) {
    let contents = new Map(Object.entries(files).map(([path, text]) => [workspacePath(path), text])),
        copiedPaths: string[] = [],
        directories = new Set(emptyDirectories.map((path) => workspacePath(path))),
        id = 0,
        operations = new Map<string, { undo: VoidFunction }>(),
        preferences = { ...DEFAULTS, ...initial },
        watchers = new Set<(event: WorkspaceChange) => void>(),
        writes: { content: string; path: string }[] = [];

    function changed(paths: readonly string[]) {
        for (let watcher of [...watchers]) {
            watcher({ paths });
        }
    }

    function list() {
        let entries = new Map<string, WorkspaceEntry>();

        for (let path of directories) {
            entries.set(path, { kind: 'directory', path });
        }

        for (let path of contents.keys()) {
            entries.set(path, { kind: 'file', path });
        }

        return [...entries.values()].sort((a, b) => a.path.localeCompare(b.path));
    }

    function move(from: string, to: string) {
        let folders = [...directories].filter((path) => containsPath(from, path)),
            items = [...contents].filter(([path]) => containsPath(from, path));

        for (let [path] of items) {
            contents.delete(path);
        }

        for (let [path, value] of items) {
            contents.set(to + path.slice(from.length), value);
        }

        for (let path of folders) {
            directories.delete(path);
        }

        for (let path of folders) {
            directories.add(to + path.slice(from.length));
        }

        parents(to);
    }

    function parents(path: string) {
        let parts = path.split('/');

        for (let length = 1; length < parts.length; length++) {
            directories.add(parts.slice(0, length).join('/'));
        }
    }

    function receipt(undo: VoidFunction) {
        let operationId = `memory-${++id}`;

        operations.set(operationId, { undo });

        return { operationId };
    }

    for (let path of [...contents.keys(), ...directories]) {
        parents(path);
    }

    let host: WorkspaceHost = {
        copyPath: (cwd, path) => {
            copiedPaths.push(`${cwd.replace(/[\\/]+$/, '')}/${path}`);
        },
        delete: async (_cwd, paths) => {
            let removed = [...contents].filter(([path]) => paths.some((parent) => containsPath(parent, path))),
                removedDirectories = [...directories].filter((path) => paths.some((parent) => containsPath(parent, path)));

            for (let [path] of removed) {
                contents.delete(path);
            }

            for (let path of removedDirectories) {
                directories.delete(path);
            }

            changed(paths);

            return receipt(() => {
                if (removed.some(([path]) => contents.has(path)) || removedDirectories.some((path) => contents.has(path))) {
                    throw new Error('Memory workspace: cannot overwrite a file created after deletion');
                }

                for (let [path, value] of removed) {
                    contents.set(path, value);
                }

                for (let path of removedDirectories) {
                    directories.add(path);
                }

                changed(paths);
            });
        },
        list: async () => list(),
        preferences: {
            get: async () => ({ ...preferences }),
            set: async (next) => {
                preferences = { ...next };
            }
        },
        read: async (_cwd, path) => {
            if (!contents.has(path)) {
                throw new Error(`Memory workspace: file not found: ${path}`);
            }

            return contents.get(path)!;
        },
        rename: async (_cwd, source, destination) => {
            if (![...contents.keys()].some((path) => containsPath(source, path)) && !directories.has(source)) {
                throw new Error('Memory workspace: source does not exist');
            }

            if (list().some((entry) => containsPath(destination, entry.path))) {
                throw new Error('Memory workspace: destination already exists');
            }

            move(source, destination);
            changed([source, destination]);

            return receipt(() => {
                if (list().some((entry) => containsPath(source, entry.path))) {
                    throw new Error('Memory workspace: undo destination already exists');
                }

                move(destination, source);
                changed([source, destination]);
            });
        },
        undo: async (_cwd, operationId) => {
            let operation = operations.get(operationId);

            if (!operation) {
                throw new Error('Memory workspace: unknown operation');
            }

            operation.undo();
            operations.delete(operationId);
        },
        watch: (_cwd, listener) => {
            watchers.add(listener);

            return () => {
                watchers.delete(listener);
            };
        },
        write: async (_cwd, path, content) => {
            parents(path);
            contents.set(path, content);
            writes.push({ content, path });
            changed([path]);
        }
    };

    return Object.assign(host, {
        change(path: string, content: string | null) {
            path = workspacePath(path);

            if (content === null) {
                contents.delete(path);
            }
            else {
                parents(path);
                contents.set(path, content);
            }

            changed([path]);
        },
        contents,
        copiedPaths,
        directories,
        watchCount: () => watchers.size,
        writes
    });
}


export { createMemoryWorkspaceHost };
