import assert from 'node:assert/strict';
import test from 'node:test';
import './resolve.mjs';


const { enclosing, flagged, order, seek } = await import('../src/components/editor/tree/jump.ts');
const { attach, collect, flatten } = await import('../src/components/editor/tree/transfer.ts');


// A FileSystemEntry tree, with each folder read back in batches of 'size' as browsers do.
const directory = (name, children, size = 100) => ({
    createReader: () => {
        let at = 0;

        return {
            readEntries: (resolve) => {
                let batch = children.slice(at, at + size);

                at += batch.length;
                queueMicrotask(() => resolve(batch));
            }
        };
    },
    isDirectory: true,
    isFile: false,
    name
});

const entry = (name, fail = false) => ({
    file: (resolve, reject) => queueMicrotask(() => fail ? reject(new Error('denied')) : resolve(new File([name], name))),
    isDirectory: false,
    isFile: true,
    name
});

const paths = (entries) => entries.map((value) => value.file ? value.path : `${value.path}/`);


test('places sort in tree order, a folder before what it holds', () => {
    let places = [[1, 2], [0], [1], [0, 3], [1, 0, 1]];

    places.sort(order);

    assert.deepEqual(places, [[0], [0, 3], [1], [1, 0, 1], [1, 2]]);
});

test('seek moves past the cursor either way and wraps round', () => {
    let places = [[0, 1], [1], [2, 0], [2, 4]];

    assert.equal(seek(places, [0], 1), 0);
    assert.equal(seek(places, [0, 1], 1), 1);
    assert.equal(seek(places, [2, 1], 1), 3);
    assert.equal(seek(places, [2, 4], 1), 0);
    assert.equal(seek(places, [2, 4], -1), 2);
    assert.equal(seek(places, [0, 1], -1), 3);
    assert.equal(seek(places, [3], -1), 3);
});

test('seek without a cursor starts at either end, and finds nothing in nothing', () => {
    assert.equal(seek([[0], [1]], null, 1), 0);
    assert.equal(seek([[0], [1]], null, -1), 1);
    assert.equal(seek([], [0], 1), -1);
});

test('changes are git statuses, staged or not; problems are errors and warnings', () => {
    assert.equal(flagged({ status: 'modified' }, 'change'), true);
    assert.equal(flagged({ staged: 'added' }, 'change'), true);
    assert.equal(flagged({ status: 'ignored' }, 'change'), false);
    assert.equal(flagged({ errors: 1 }, 'change'), false);
    assert.equal(flagged({ errors: 1 }, 'problem'), true);
    assert.equal(flagged({ warnings: 2 }, 'problem'), true);
    assert.equal(flagged({ errors: 0, status: 'modified' }, 'problem'), false);
    assert.equal(flagged(undefined, 'problem'), false);
});

test('enclosing lists the folders a path id sits in, nearest first', () => {
    assert.deepEqual(enclosing('src/lib/index.ts'), ['src/lib', 'src']);
    assert.deepEqual(enclosing('/home/dev/a.ts'), ['/home/dev', '/home']);
    assert.deepEqual(enclosing('C:\\code\\app\\main.rs'), ['C:\\code\\app', 'C:\\code', 'C:']);
    assert.deepEqual(enclosing('README.md'), []);
});

test('dropped folders flatten depth first, each folder ahead of its contents', async () => {
    let dropped = [
        directory('photos', [entry('cat.png'), directory('raw', [entry('cat.raw')]), directory('empty', [])]),
        entry('notes.txt')
    ];

    assert.deepEqual(paths(await flatten(dropped)), ['photos/', 'photos/cat.png', 'photos/raw/', 'photos/raw/cat.raw', 'photos/empty/', 'notes.txt']);
});

test('a folder is read to the end across batches', async () => {
    let children = Array.from({ length: 7 }, (_, i) => entry(`${i}.txt`)),
        out = await flatten([directory('many', children, 3)]);

    assert.equal(out.length, 8);
    assert.equal(out[7].path, 'many/6.txt');
    assert.equal(await out[1].file.text(), '0.txt');
});

test('unreadable files are left out rather than failing the drop', async () => {
    assert.deepEqual(paths(await flatten([directory('a', [entry('locked', true), entry('open')])])), ['a/', 'a/open']);
});

test('collect walks entries and falls back to plain files, in the order dropped', async () => {
    let plain = new File(['x'], 'plain.txt'),
        items = [
            { getAsFile: () => null, kind: 'file', webkitGetAsEntry: () => directory('docs', [entry('a.md')]) },
            { getAsFile: () => plain, kind: 'file', webkitGetAsEntry: () => null },
            { getAsFile: () => null, kind: 'string', webkitGetAsEntry: () => null }
        ];

    assert.deepEqual(paths(await collect({ items })), ['docs/', 'docs/a.md', 'plain.txt']);
});

test('one exported file carries a download, any number carry links and text', () => {
    let data = new Map(),
        transfer = { setData: (type, value) => data.set(type, value) };

    attach(transfer, [{ name: 'a.txt', text: 'hello', type: 'text/plain', url: 'data:text/plain,hello' }]);

    assert.equal(data.get('DownloadURL'), 'text/plain:a.txt:data:text/plain,hello');
    assert.equal(data.get('text/uri-list'), 'data:text/plain,hello');
    assert.equal(data.get('text/plain'), 'hello');

    data.clear();
    attach(transfer, [{ name: 'a.bin', url: 'https://x/a' }, { name: 'b.bin', url: 'https://x/b' }, { name: 'c' }]);

    assert.equal(data.has('DownloadURL'), false);
    assert.equal(data.get('text/uri-list'), 'https://x/a\r\nhttps://x/b');
    assert.equal(data.get('text/plain'), 'https://x/a\nhttps://x/b\nc');

    data.clear();
    attach(transfer, [{ name: 'd.bin', url: 'blob:x' }]);

    assert.equal(data.get('DownloadURL'), 'application/octet-stream:d.bin:blob:x');
});
