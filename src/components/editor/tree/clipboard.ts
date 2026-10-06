import Selection from './selection';


type Held<T> = {
    cut: boolean;
    items: T[];
};


// What was last cut or copied. Cut items stay marked until they're pasted, or something else is cut or copied.
class Clipboard<T extends { id: string }> {
    private held: Held<T> | null = null;

    readonly marked = new Selection();


    // Escape drops a cut, as in VS Code; a copy stays to paste again.
    cancel() {
        if (!this.held?.cut) {
            return false;
        }

        this.held = null;
        this.marked.replace([]);

        return true;
    }

    hold(items: T[], cut: boolean) {
        this.held = { cut, items };
        this.marked.replace(cut ? items.map((item) => item.id) : []);
    }

    // A cut empties once pasted: its items have moved, so pasting again would find nothing there.
    async paste(fn: (items: T[], cut: boolean) => unknown) {
        let held = this.held;

        if (!held) {
            return;
        }

        await fn(held.items, held.cut);

        if (held.cut && this.held === held) {
            this.held = null;
            this.marked.replace([]);
        }
    }

    // Items a live change took away leave; the rest are swapped for their current versions, so a paste names only
    // what's still there, as it's now called.
    retain(find: (id: string) => T | undefined) {
        let held = this.held;

        if (!held) {
            return;
        }

        let items: T[] = [];

        for (let i = 0, n = held.items.length; i < n; i++) {
            let item = find(held.items[i].id);

            if (item !== undefined) {
                items.push(item);
            }
        }

        if (items.length === held.items.length) {
            held.items = items;
            return;
        }

        this.held = items.length ? { cut: held.cut, items } : null;
        this.marked.replace(this.held?.cut ? items.map((item) => item.id) : []);
    }
}


export default Clipboard;
