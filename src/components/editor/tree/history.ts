import { peek, read, signal, write } from '@esportsplus/reactivity';
import type { FileTreeElement as Element } from '.';
import type Elements from './model';
import type { Change } from './model';


type Entry = {
    label: string;
    operations: Operation[];
};

type Listener = (step: Step) => void;

// One store change, with what it takes to reverse it exactly: an added or removed element carries everything inside
// it, and its place among its folder's children.
type Operation =
    | { at: number; element: Element; parent: string | null; type: 'add' | 'remove' }
    | { element: Element; from: Place; to: Place; type: 'move' }
    | { element: Element; from: string; to: string; type: 'rename' };

type Options = {
    // Asked before an undo or redo changes the store, with the operations it's about to apply; false, or a promise
    // settling false, leaves the store and the history as they are. Where to ask before recreating deleted files, or
    // to apply the operations to the disk first and refuse when that fails.
    confirm?: (step: Step) => boolean | Promise<boolean>;
    // How many entries undo reaches back; the oldest drop first.
    depth?: number;
};

type Place = {
    at: number;
    parent: string | null;
};

type Step = {
    direction: 'redo' | 'undo';
    label: string;
    operations: Operation[];
};


const VERBS: Record<Operation['type'], string> = {
    add: 'Create',
    move: 'Move',
    remove: 'Delete',
    rename: 'Rename'
};


function apply(store: Elements, operation: Operation) {
    switch (operation.type) {
        case 'add':
            return store.add(operation.element, operation.parent, operation.at);
        case 'move':
            return store.move(operation.element.id, operation.to.parent, operation.to.at);
        case 'remove':
            return store.remove(operation.element.id);
        case 'rename':
            return store.rename(operation.element.id, operation.to);
    }
}

function describe(operations: Operation[]) {
    let first = operations[0],
        n = operations.length;

    if (operations.some((operation) => operation.type !== first.type)) {
        return `Change ${n} items`;
    }

    if (n > 1) {
        return `${VERBS[first.type]} ${n} items`;
    }

    return `${VERBS[first.type]} ${first.type === 'rename' ? first.from : first.element.name}`;
}

// Undoes 'operations': each reversed, last first.
function invert(operations: Operation[]) {
    let out: Operation[] = [];

    for (let i = operations.length - 1; i >= 0; i--) {
        let operation = operations[i];

        switch (operation.type) {
            case 'add':
            case 'remove':
                out.push({ ...operation, type: operation.type === 'add' ? 'remove' : 'add' });
                break;
            case 'move':
                out.push({ ...operation, from: operation.to, to: operation.from });
                break;
            case 'rename':
                out.push({ element: { ...operation.element, name: operation.from }, from: operation.to, to: operation.from, type: 'rename' });
                break;
        }
    }

    return out;
}

// An add of several elements is one change; it's split so each can be taken away, and put back, on its own.
function split({ at, elements, from = null, origin, parent, previous, type }: Change): Operation[] {
    switch (type) {
        case 'add':
        case 'remove':
            return elements.map((element, i) => ({ at: at + i, element, parent, type }));
        case 'move':
            return [{ element: elements[0], from: { at: origin!, parent: from }, to: { at, parent }, type }];
        case 'rename':
            return [{ element: elements[0], from: previous!, to: elements[0].name, type }];
    }
}


// Undo and redo for a store's structural changes. Only changes made inside 'transact' are recorded, each call one
// entry however many changes it makes, so a file watcher feeding the store outside one never lands in the history.
// A new entry clears what could be redone.
//
// An undo or redo applies its entry's operations reversed, last first, then hands each listener the step as the store
// took it: the operations it applied, in order, for the consumer to mirror on disk. One the store refuses, like
// restoring into a folder a watcher removed since, is skipped and left out of the step.
class History {
    private busy = false;
    private confirm: Options['confirm'];
    private depth: number;
    private readonly future: Entry[] = [];
    private listeners: Listener[] = [];
    private readonly past: Entry[] = [];
    private recording: Operation[] | null = null;
    private revision = signal(0);
    private store: Elements;


    constructor(store: Elements, { confirm, depth = 100 }: Options = {}) {
        this.confirm = confirm;
        this.depth = depth;
        this.store = store;

        store.subscribe((change) => {
            this.recording?.push(...split(change));
        });
    }


    private changed() {
        write(this.revision, peek(this.revision) + 1);
    }

    // Left be when the history changed while 'confirm' was asked.
    private async travel(direction: Step['direction']) {
        let from = direction === 'undo' ? this.past : this.future,
            entry = from[from.length - 1];

        if (!entry || this.busy) {
            return null;
        }

        let step: Step = { direction, label: entry.label, operations: invert(entry.operations) };

        if (this.confirm) {
            this.busy = true;

            try {
                if (!(await this.confirm(step)) || from[from.length - 1] !== entry) {
                    return null;
                }
            }
            finally {
                this.busy = false;
            }
        }

        let operations: Operation[] = this.recording = [];

        for (let i = 0, n = step.operations.length; i < n; i++) {
            apply(this.store, step.operations[i]);
        }

        this.recording = null;
        from.pop();

        // Kept as the store took them, so going back the other way reverses exactly what happened.
        if (operations.length) {
            (direction === 'undo' ? this.future : this.past).push({ label: entry.label, operations });
        }

        this.changed();
        step = { direction, label: entry.label, operations };

        for (let i = 0, n = this.listeners.length; i < n; i++) {
            this.listeners[i](step);
        }

        return step;
    }


    get canRedo() {
        read(this.revision);
        return this.future.length > 0;
    }

    get canUndo() {
        read(this.revision);
        return this.past.length > 0;
    }

    // What redo steps through, the next last.
    get redoable(): readonly Entry[] {
        read(this.revision);
        return this.future;
    }

    // What undo steps through, the next last.
    get undoable(): readonly Entry[] {
        read(this.revision);
        return this.past;
    }


    clear() {
        this.future.length = 0;
        this.past.length = 0;
        this.changed();
    }

    redo() {
        return this.travel('redo');
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

    // Records the store changes 'fn' makes as one entry, labelled for a history list, or described from its operations:
    // 'Delete 3 items', 'Rename index.ts'. Only what 'fn' changes before it returns is recorded; a transaction inside
    // another joins it.
    transact(fn: VoidFunction, label?: string) {
        if (this.recording) {
            fn();
            return;
        }

        let operations: Operation[] = this.recording = [];

        // What 'fn' changed before it threw is still undoable.
        try {
            fn();
        }
        finally {
            this.recording = null;

            if (operations.length) {
                this.future.length = 0;
                this.past.push({ label: label || describe(operations), operations });

                if (this.past.length > this.depth) {
                    this.past.shift();
                }

                this.changed();
            }
        }
    }

    undo() {
        return this.travel('undo');
    }
}


export default History;
export type { Entry, Operation, Options, Place, Step };
