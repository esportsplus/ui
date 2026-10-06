// What a row dragged out of the tree leaves in another app or on the desktop: a file named 'name' downloaded from
// 'url' where the browser supports it (Chromium), and the link and 'text' wherever links and text are dropped.
type Export = {
    name: string;
    text?: string;
    // The MIME type the download is saved as; 'application/octet-stream' unless given.
    type?: string;
    url?: string;
};

// One item dropped into the tree from outside: 'path' runs from the drop, 'photos/cat.png' for a file inside a folder
// dropped whole, and 'file' is null for a folder, which comes ahead of what's inside it.
type ImportEntry = {
    file: File | null;
    path: string;
};


const BINARY = 'application/octet-stream';


// Hands each item to the next drop target: Chromium saves a lone file with a url to where it lands, while links and
// text go for any number.
function attach(transfer: Pick<DataTransfer, 'setData'>, items: readonly Export[]) {
    let links: string[] = [],
        texts: string[] = [];

    for (let i = 0, n = items.length; i < n; i++) {
        let item = items[i];

        if (item.url) {
            links.push(item.url);
        }

        texts.push(item.text ?? item.url ?? item.name);
    }

    if (items.length === 1 && items[0].url) {
        transfer.setData('DownloadURL', `${items[0].type || BINARY}:${items[0].name}:${items[0].url}`);
    }

    if (links.length) {
        transfer.setData('text/uri-list', links.join('\r\n'));
    }

    if (texts.length) {
        transfer.setData('text/plain', texts.join('\n'));
    }
}

// Everything a drop carries in, folders walked to the bottom, in the order dropped. The items are read before the
// first await, since a drop's data empties once its event returns; a browser without entries hands over the files
// alone.
async function collect(transfer: Pick<DataTransfer, 'items'>) {
    let items = transfer.items,
        out: ImportEntry[] = [],
        sources: (File | FileSystemEntry)[] = [];

    for (let i = 0, n = items.length; i < n; i++) {
        let item = items[i];

        if (item.kind !== 'file') {
            continue;
        }

        let source = item.webkitGetAsEntry?.() ?? item.getAsFile();

        if (source) {
            sources.push(source);
        }
    }

    for (let i = 0, n = sources.length; i < n; i++) {
        let source = sources[i];

        if ('isFile' in source) {
            await flatten([source], out);
        }
        else {
            out.push({ file: source, path: source.name });
        }
    }

    return out;
}

function file(entry: FileSystemFileEntry) {
    return new Promise<File | null>((resolve) => entry.file(resolve, () => resolve(null)));
}

// Each entry, then everything inside the folders among them, paths joined from 'prefix'. A file or folder that
// can't be read, as one the OS denies access to, is left out rather than failing the drop.
async function flatten(entries: readonly FileSystemEntry[], out: ImportEntry[] = [], prefix = '') {
    for (let i = 0, n = entries.length; i < n; i++) {
        let entry = entries[i],
            path = prefix + entry.name;

        if (entry.isDirectory) {
            out.push({ file: null, path });
            await flatten(await read(entry as FileSystemDirectoryEntry), out, `${path}/`);
        }
        else if (entry.isFile) {
            let value = await file(entry as FileSystemFileEntry);

            if (value) {
                out.push({ file: value, path });
            }
        }
    }

    return out;
}

// A folder's reader hands its entries over in batches, Chromium's of 100 at most, until an empty one.
async function read(entry: FileSystemDirectoryEntry) {
    let out: FileSystemEntry[] = [],
        reader = entry.createReader();

    for (;;) {
        let batch = await new Promise<FileSystemEntry[]>((resolve) => reader.readEntries(resolve, () => resolve([])));

        if (!batch.length) {
            return out;
        }

        for (let i = 0, n = batch.length; i < n; i++) {
            out.push(batch[i]);
        }
    }
}


export { attach, collect, flatten };
export type { Export, ImportEntry };
