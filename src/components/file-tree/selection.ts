import { read, signal, write, type Signal } from '@esportsplus/reactivity';


type Listener = (ids: ReadonlySet<string>) => void;


// A set of ids each row watches for itself, so a change re-renders only the rows it adds or removes.
class Selection {
    private flags = new Map<string, Signal<boolean>>();
    private listener: Listener | undefined;
    private values: ReadonlySet<string> = new Set();


    constructor(listener?: Listener) {
        this.listener = listener;
    }


    private flag(id: string, value: boolean) {
        let flag = this.flags.get(id);

        if (flag) {
            write(flag, value);
        }
    }


    // Never changed in place: each change swaps in a new set, so it's handed out as is.
    get ids() {
        return this.values;
    }

    has(id: string) {
        return this.values.has(id);
    }

    // Tracked, for a row's template; created the first time the row renders.
    read(id: string) {
        let flag = this.flags.get(id);

        if (!flag) {
            this.flags.set(id, flag = signal(this.values.has(id)));
        }

        return read(flag);
    }

    replace(ids: Iterable<string>) {
        let next = new Set(ids),
            previous = this.values,
            added = [...next].filter((id) => !previous.has(id)),
            removed = [...previous].filter((id) => !next.has(id));

        if (!added.length && !removed.length) {
            return;
        }

        this.values = next;

        for (let i = 0, n = removed.length; i < n; i++) {
            this.flag(removed[i], false);
        }

        for (let i = 0, n = added.length; i < n; i++) {
            this.flag(added[i], true);
        }

        this.listener?.(next);
    }
}


export default Selection;
