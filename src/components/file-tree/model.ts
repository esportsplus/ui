import type { FileTreeElement as Element } from '.';


type Change = {
    // The folder a move left; null at the top level.
    from?: string | null;
    // Every id the change touched: the element's and all those inside it, whose paths a rename or move changes too.
    ids: string[];
    // The folder whose children changed; null at the top level.
    parent: string | null;
    type: 'add' | 'move' | 'remove' | 'rename';
};

type Entry = {
    element: Element;
    parent: string | null;
};

type Listener = (change: Change) => void;


function collect(element: Element, out: string[]) {
    out.push(element.id);

    if (element.children) {
        for (let i = 0, n = element.children.length; i < n; i++) {
            collect(element.children[i], out);
        }
    }

    return out;
}

function walk(elements: Element[], parent: string | null, index: Map<string, Entry>) {
    for (let i = 0, n = elements.length; i < n; i++) {
        let element = elements[i];

        index.set(element.id, { element, parent });

        if (element.children) {
            walk(element.children, element.id, index);
        }
    }

    return index;
}


// The elements a tree shows, changed in place: each change reaches every tree showing them as the one folder it
// touched, so open folders, selection and decorations elsewhere stay as they are. Ids are the elements' identity; a
// rename keeps the id and swaps the element for a copy with the new name.
//
// A change that can't apply, naming an id the store doesn't hold, one it already does, or a file as a folder, is
// skipped and returns false: a file watcher reports changes inside folders a lazy tree hasn't loaded yet, and those
// arrive with the load instead.
class Elements {
    private listeners: Listener[] = [];

    readonly elements: Element[];
    readonly index: Map<string, Entry>;
    // Bumped by every change, so a tree that was disconnected can tell it missed some.
    version = 0;


    constructor(elements: Element[]) {
        this.elements = elements;
        this.index = walk(elements, null, new Map());
    }


    // Adding to a folder whose children were never given makes them known.
    private list(parent: string | null) {
        if (parent === null) {
            return this.elements;
        }

        let element = this.index.get(parent)?.element;

        if (!element || element.type === 'file') {
            return null;
        }

        return element.children ??= [];
    }

    private notify(change: Change) {
        this.version++;

        for (let i = 0, n = this.listeners.length; i < n; i++) {
            this.listeners[i](change);
        }

        return true;
    }


    // Inserts at 'at' among the folder's children, or last; a tree sorting its rows places them by its own order.
    add(elements: Element | Element[], parent: string | null = null, at?: number) {
        let added = Array.isArray(elements) ? elements : [elements],
            ids: string[] = [];

        for (let i = 0, n = added.length; i < n; i++) {
            collect(added[i], ids);
        }

        for (let i = 0, n = ids.length; i < n; i++) {
            if (this.index.has(ids[i])) {
                return false;
            }
        }

        let list = this.list(parent);

        if (!list) {
            return false;
        }

        // Pushed one by one when appending, since a loaded folder can hold more than a spread may pass.
        if (at === undefined) {
            for (let i = 0, n = added.length; i < n; i++) {
                list.push(added[i]);
            }
        }
        else {
            list.splice(at, 0, ...added);
        }

        walk(added, parent, this.index);

        return this.notify({ ids, parent, type: 'add' });
    }

    get(id: string) {
        return this.index.get(id)?.element;
    }

    // Refuses a folder moved into itself or anything inside it.
    move(id: string, parent: string | null, at?: number) {
        let entry = this.index.get(id);

        if (!entry) {
            return false;
        }

        for (let node = parent; node !== null; node = this.index.get(node)?.parent ?? null) {
            if (node === id) {
                return false;
            }
        }

        let from = entry.parent,
            target = this.list(parent);

        if (!target) {
            return false;
        }

        let source = this.list(from)!;

        source.splice(source.indexOf(entry.element), 1);
        target.splice(at ?? target.length, 0, entry.element);
        entry.parent = parent;

        return this.notify({ from, ids: collect(entry.element, []), parent, type: 'move' });
    }

    remove(id: string) {
        let entry = this.index.get(id);

        if (!entry) {
            return false;
        }

        let ids = collect(entry.element, []),
            list = this.list(entry.parent)!;

        list.splice(list.indexOf(entry.element), 1);

        for (let i = 0, n = ids.length; i < n; i++) {
            this.index.delete(ids[i]);
        }

        return this.notify({ ids, parent: entry.parent, type: 'remove' });
    }

    rename(id: string, name: string) {
        let entry = this.index.get(id);

        if (!entry) {
            return false;
        }

        let element = { ...entry.element, name },
            list = this.list(entry.parent)!;

        list[list.indexOf(entry.element)] = element;
        entry.element = element;

        return this.notify({ ids: collect(element, []), parent: entry.parent, type: 'rename' });
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
}


export default Elements;
export type { Change, Entry };
