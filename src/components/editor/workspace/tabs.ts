import { peek, read, signal, write, type Signal } from '@esportsplus/reactivity';
import { EditorDocument } from '../code/document';
import { conflictMarkers, resolveMarker } from '../diffs/diff3';
import type { WorkspaceCompare } from './model';


type Closable = 'others' | 'right' | 'saved';

// A conflicted file split back into the versions its markers hold, as the merge editor takes them.
type MergeSides = { base: string | null; current: string; incoming: string };

type TabFlags = Pick<WorkspaceTab, 'missing' | 'path' | 'pinned' | 'preview' | 'saved'>;

type TabStub = Omit<TabFlags, 'saved'> & { dirty: boolean };


// No workspace path holds a NUL, so a compare tab's key never matches a file's path, nor lies inside a folder.
const SEPARATOR = '\u0000';

const TRAILING_EOL = /(?:\r\n|\r|\n)$/;


/** One open file. Its flags are signals, so the strip, the explorer and auto save each follow only what they show. */
class WorkspaceTab {
    readonly compare?: WorkspaceCompare;
    readonly document: EditorDocument;
    readonly id: number;
    scroll = { left: 0, top: 0 };
    private signals: {
        dirty: Signal<boolean>;
        missing: Signal<boolean>;
        path: Signal<string>;
        pinned: Signal<boolean>;
        preview: Signal<boolean>;
        saved: Signal<string>;
    };
    private unsubscribe: VoidFunction;


    constructor(id: number, content: string, flags: Partial<TabFlags> & { path: string }, compare?: WorkspaceCompare) {
        let saved = flags.saved ?? content;

        this.compare = compare;
        this.document = new EditorDocument(content);
        this.id = id;
        this.signals = {
            dirty: signal(content !== saved),
            missing: signal(flags.missing ?? false),
            path: signal(flags.path),
            pinned: signal(flags.pinned ?? false),
            preview: signal(flags.preview ?? false),
            saved: signal(saved)
        };
        this.unsubscribe = this.document.subscribe((_, change) => {
            if (change.textChanged) {
                this.sync();
            }
        });
    }


    // Only turning dirty or clean writes, so typing never reaches anything that reads the flag.
    private sync() {
        let dirty = this.document.value !== peek(this.signals.saved);

        // A draft is kept open until it's saved or closed; a preview would give its place to the next file.
        if (dirty) {
            write(this.signals.preview, false);
        }

        write(this.signals.dirty, dirty);
    }


    get dirty() {
        return read(this.signals.dirty);
    }

    get missing() {
        return read(this.signals.missing);
    }

    set missing(value: boolean) {
        write(this.signals.missing, value);
    }

    get path() {
        return read(this.signals.path);
    }

    set path(value: string) {
        write(this.signals.path, value);
    }

    get pinned() {
        return read(this.signals.pinned);
    }

    set pinned(value: boolean) {
        write(this.signals.pinned, value);
    }

    get preview() {
        return read(this.signals.preview);
    }

    set preview(value: boolean) {
        write(this.signals.preview, value);
    }

    get saved() {
        return read(this.signals.saved);
    }

    set saved(value: string) {
        write(this.signals.saved, value);
        this.sync();
    }


    dispose() {
        this.unsubscribe();
    }
}


// Bulk closes leave pinned tabs and the tab they were asked from; 'saved' also keeps drafts of files gone from disk.
const closable = <T extends TabStub>(tabs: readonly T[], kind: Closable, path?: string) => {
    let at = tabs.findIndex((tab) => tab.path === path);

    return tabs.filter((tab, i) => {
        if (tab.pinned || tab.path === path) {
            return false;
        }

        if (kind === 'right') {
            return at !== -1 && i > at;
        }

        return kind === 'others' || (!tab.missing && !tab.dirty);
    });
};

const compareKey = (original: string, modified: string) => `${SEPARATOR}${original}${SEPARATOR}${modified}`;

// A compare tab's document stays empty and saved, so nothing that reads tabs ever finds it dirty.
const compareTab = (id: number, compare: WorkspaceCompare) =>
    new WorkspaceTab(id, '', { path: compareKey(compare.paths[0], compare.paths[1]) }, compare);

// Pinned tabs lead; a stable sort keeps every other tab where it was among its group.
const order = (tabs: WorkspaceTab[]) => {
    tabs.sort((a, b) => Number(b.pinned) - Number(a.pinned));
};

// A preview tab takes the place of the last one, which the caller then removes.
const place = (tabs: WorkspaceTab[], tab: WorkspaceTab) => {
    let at = tab.preview ? tabs.findIndex((item) => item.preview) : -1;

    if (at === -1) {
        tabs.push(tab);
        return;
    }

    let replaced = tabs[at];

    tabs.splice(at, 0, tab);

    return replaced;
};

const sides = (text: string): MergeSides | null => {
    let markers = conflictMarkers(text);

    if (!markers.length) {
        return null;
    }

    let at = 0,
        base: string | null = '',
        current = '',
        incoming = '';

    for (let i = 0, n = markers.length; i < n; i++) {
        let marker = markers[i],
            between = text.slice(at, marker.from);

        if (base !== null && marker.base !== null) {
            base += between + (marker.to === text.length && !TRAILING_EOL.test(text) ? marker.base.replace(TRAILING_EOL, '') : marker.base);
        }
        else {
            base = null;
        }

        current += between + resolveMarker(text, marker, 'current');
        incoming += between + resolveMarker(text, marker, 'incoming');
        at = marker.to;
    }

    let rest = text.slice(at);

    return { base: base === null ? null : base + rest, current: current + rest, incoming: incoming + rest };
};


export { closable, compareKey, compareTab, order, place, sides, WorkspaceTab };
export type { Closable, MergeSides };
