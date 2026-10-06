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
            same = next.size === previous.size;

        if (same) {
            for (let id of next) {
                if (!previous.has(id)) {
                    same = false;
                    break;
                }
            }
        }

        if (same) {
            return;
        }

        this.values = next;

        for (let id of previous) {
            if (!next.has(id)) {
                this.flag(id, false);
            }
        }

        for (let id of next) {
            if (!previous.has(id)) {
                this.flag(id, true);
            }
        }

        this.listener?.(next);
    }
}


export default Selection;
