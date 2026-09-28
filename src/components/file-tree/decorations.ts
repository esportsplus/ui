// A consumer's own badge, as an extension adds one in VS Code.
type Badge = {
    // Any CSS color; the tree's text color otherwise.
    color?: string;
    text: string;
    // Shown on hover and spoken in place of the text, so a one-letter badge still says what it means.
    tooltip?: string;
};

type Decoration = {
    // Lines added and removed against HEAD, as `git diff --numstat` reports them; an untracked file is all additions.
    additions?: number;
    badges?: Badge[];
    deletions?: number;
    // What the editor knows, which git doesn't: grouped apart since the editor, not `git status`, reports it.
    editor?: Editor;
    errors?: number;
    // The index side of `git status`, where 'status' is the working tree's; a file staged and then edited again
    // carries both.
    staged?: Status;
    status?: Status;
    submodule?: boolean;
    warnings?: number;
};

type Editor = {
    open?: boolean;
    unsaved?: boolean;
};

type Listener = (ids: string[]) => void;

type Source = Pick<Decorations, 'get' | 'keys' | 'subscribe'>;

type Status = 'added' | 'conflict' | 'deleted' | 'ignored' | 'modified' | 'renamed' | 'untracked';

type Tone = 'added' | 'conflict' | 'deleted' | 'error' | 'ignored' | 'modified' | 'warning';


function equal(a: Decoration | undefined, b: Decoration | undefined) {
    return a === b || (
        a !== undefined &&
        b !== undefined &&
        (a.additions ?? 0) === (b.additions ?? 0) &&
        same(a.badges ?? [], b.badges ?? []) &&
        (a.deletions ?? 0) === (b.deletions ?? 0) &&
        !!a.editor?.open === !!b.editor?.open &&
        !!a.editor?.unsaved === !!b.editor?.unsaved &&
        (a.errors ?? 0) === (b.errors ?? 0) &&
        a.staged === b.staged &&
        a.status === b.status &&
        !!a.submodule === !!b.submodule &&
        (a.warnings ?? 0) === (b.warnings ?? 0)
    );
}

// Each provider (git, problems, the editor, extensions) owns a store, so a fresh `git status` replaces git's records
// without clearing the editor's. Later stores win a field both set; badges from every store are kept, in store order.
function merge(stores: Decorations[]): Source {
    if (stores.length === 1) {
        return stores[0];
    }

    return {
        get(id: string) {
            let out: Decoration | undefined;

            for (let i = 0, n = stores.length; i < n; i++) {
                let decoration = stores[i].get(id);

                if (!decoration) {
                    continue;
                }

                if (!out) {
                    out = decoration;
                    continue;
                }

                out = {
                    ...out,
                    ...decoration,
                    badges: out.badges && decoration.badges ? [...out.badges, ...decoration.badges] : (decoration.badges ?? out.badges)
                };
            }

            return out;
        },
        keys() {
            return new Set(stores.flatMap((store) => [...store.keys()])).values();
        },
        subscribe(listener: Listener) {
            let unsubscribe = stores.map((store) => store.subscribe(listener));

            return () => {
                for (let i = 0, n = unsubscribe.length; i < n; i++) {
                    unsubscribe[i]();
                }
            };
        }
    };
}

function same(a: Badge[], b: Badge[]) {
    if (a.length !== b.length) {
        return false;
    }

    for (let i = 0, n = a.length; i < n; i++) {
        if (a[i].color !== b[i].color || a[i].text !== b[i].text || a[i].tooltip !== b[i].tooltip) {
            return false;
        }
    }

    return true;
}


// Git status, problem counts, editor state and consumer badges by element id, shared by any number of trees. Writes
// are diffed, so a caller can hand over a full `git status` on every refresh and only the rows that changed re-render.
class Decorations {
    private listeners: Listener[] = [];
    private values = new Map<string, Decoration>();


    private notify(ids: string[]) {
        if (!ids.length) {
            return;
        }

        for (let i = 0, n = this.listeners.length; i < n; i++) {
            this.listeners[i](ids);
        }
    }

    private write(id: string, decoration: Decoration | null, changed: string[]) {
        let previous = this.values.get(id);

        if (decoration === null) {
            if (previous !== undefined) {
                this.values.delete(id);
                changed.push(id);
            }

            return;
        }

        if (!equal(previous, decoration)) {
            this.values.set(id, decoration);
            changed.push(id);
        }
    }


    get(id: string) {
        return this.values.get(id);
    }

    keys() {
        return this.values.keys();
    }

    // A full snapshot: anything missing from it is cleared.
    replace(entries: Iterable<[string, Decoration]>) {
        let changed: string[] = [],
            seen = new Set<string>();

        for (let [id, decoration] of entries) {
            seen.add(id);
            this.write(id, decoration, changed);
        }

        for (let id of this.values.keys()) {
            if (!seen.has(id)) {
                this.values.delete(id);
                changed.push(id);
            }
        }

        this.notify(changed);
    }

    subscribe(listener: Listener) {
        this.listeners.push(listener);

        return () => {
            let i = this.listeners.indexOf(listener);

            if (i !== -1) {
                this.listeners.splice(i, 1);
            }
        };
    }

    // A partial change, as a file watcher reports it; `null` clears an id.
    update(entries: Iterable<[string, Decoration | null]>) {
        let changed: string[] = [];

        for (let [id, decoration] of entries) {
            this.write(id, decoration, changed);
        }

        this.notify(changed);
    }
}


export default Decorations;
export { merge };
export type { Badge, Decoration, Editor, Source, Status, Tone };
