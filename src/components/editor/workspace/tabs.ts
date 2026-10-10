import { EditorDocument } from '../code/document';
import { conflictMarkers, resolveMarker } from '../diffs/diff3';
import type { WorkspaceCompare, WorkspaceTab } from './model';


type Closable = 'others' | 'right' | 'saved';

// A conflicted file split back into the versions its markers hold, as the merge editor takes them.
type MergeSides = { base: string | null; current: string; incoming: string };


// No workspace path holds a NUL, so a compare tab's key never matches a file's path, nor lies inside a folder.
const SEPARATOR = '\u0000';

const TRAILING_EOL = /(?:\r\n|\r|\n)$/;


// Bulk closes leave pinned tabs and the tab they were asked from; 'saved' also keeps drafts of files gone from disk.
const closable = (tabs: readonly WorkspaceTab[], kind: Closable, path?: string) => {
    let at = tabs.findIndex((tab) => tab.path === path);

    return tabs.filter((tab, i) => {
        if (tab.pinned || tab.path === path) {
            return false;
        }

        if (kind === 'right') {
            return at !== -1 && i > at;
        }

        return kind === 'others' || (!tab.missing && tab.document.value === tab.saved);
    });
};

const compareKey = (original: string, modified: string) => `${SEPARATOR}${original}${SEPARATOR}${modified}`;

// A compare tab's document stays empty and saved, so nothing that reads tabs ever finds it dirty.
const compareTab = (id: number, compare: WorkspaceCompare): WorkspaceTab => ({
    compare,
    document: new EditorDocument(''),
    id,
    missing: false,
    path: compareKey(compare.paths[0], compare.paths[1]),
    pinned: false,
    preview: false,
    saved: '',
    scroll: { left: 0, top: 0 }
});

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


export { closable, compareKey, compareTab, order, place, sides };
export type { Closable, MergeSides };
