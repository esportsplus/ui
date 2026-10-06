import assert from 'node:assert/strict';
import test from 'node:test';
import './resolve.mjs';


const { conflictMarkers, diff3, resolveMarker } = await import('../src/components/editor/diffs/diff3.ts');
const { diffLines, diffSequences } = await import('../src/components/editor/diffs/engine.ts');
const { acceptChange, diffTexts, hunks, revertChange } = await import('../src/components/editor/diffs/hunks.ts');
const { words } = await import('../src/components/editor/diffs/words.ts');


const numbered = (count, edit = {}) => Array.from({ length: count }, (_, i) => edit[i] ?? `line ${i + 1}`).join('\n');


test('diffLines reports nothing for equal texts', () => {
    assert.deepEqual(diffLines('a\nb', 'a\nb'), []);
});

test('diffLines finds insertions, deletions and replacements', () => {
    assert.deepEqual(diffLines('a\nb\nc', 'a\nx\nb\nc'), [{ modified: { from: 1, to: 2 }, original: { from: 1, to: 1 } }]);
    assert.deepEqual(diffLines('a\nb\nc', 'a\nc'), [{ modified: { from: 1, to: 1 }, original: { from: 1, to: 2 } }]);
    assert.deepEqual(diffLines('a\nb\nc', 'a\ny\nc'), [{ modified: { from: 1, to: 2 }, original: { from: 1, to: 2 } }]);
});

test('diffLines ignores line endings', () => {
    assert.deepEqual(diffLines('a\r\nb', 'a\nb'), []);
});

test('diffSequences aligns every element', () => {
    let ops = diffSequences([...'abcabba'], [...'cbabac']);

    assert.equal(ops.filter((op) => op.type !== 'insert').length, 7);
    assert.equal(ops.filter((op) => op.type !== 'delete').length, 6);
});

test('diffSequences stays exact on long inputs with scattered edits', () => {
    let changes = diffLines(numbered(5000), numbered(5000, { 10: 'x', 2500: 'y', 4990: 'z' }));

    assert.deepEqual(changes.map((change) => change.original.from), [10, 2500, 4990]);
});

test('diffTexts aligns rows and counts additions and deletions', () => {
    let diff = diffTexts('a\nb\nc', 'a\nx\nc\nd');

    assert.equal(diff.additions, 2);
    assert.equal(diff.deletions, 1);
    assert.deepEqual(diff.rows.map((row) => row.type), ['equal', 'delete', 'insert', 'equal', 'insert']);
    assert.deepEqual(diff.changes, [
        { index: 0, modified: { from: 1, to: 2 }, modifiedText: 'x', original: { from: 1, to: 2 }, originalText: 'b', rows: { from: 1, to: 3 } },
        { index: 1, modified: { from: 3, to: 4 }, modifiedText: 'd', original: { from: 3, to: 3 }, originalText: '', rows: { from: 4, to: 5 } }
    ]);
});

test('diffTexts can ignore leading and trailing whitespace', () => {
    assert.equal(diffTexts('a\n  b', 'a\nb  ').changes.length, 1);
    assert.equal(diffTexts('a\n  b', 'a\nb  ', { ignoreWhitespace: true }).changes.length, 0);
});

test('hunks keep context around changes and hide the rest as gaps', () => {
    let diff = diffTexts(numbered(20), numbered(20, { 4: 'five', 15: 'sixteen' })),
        { gaps, hunks: list } = hunks(diff, 2);

    assert.equal(list.length, 2);
    assert.deepEqual(list[0].original, { from: 2, to: 7 });
    assert.deepEqual(list[0].modified, { from: 2, to: 7 });
    assert.deepEqual(list[1].original, { from: 13, to: 18 });
    // Leading, between and trailing unchanged rows.
    assert.deepEqual(gaps.map(({ from, to }) => to - from), [2, 6, 2]);
});

test('hunks merge changes whose context touches', () => {
    let diff = diffTexts(numbered(20), numbered(20, { 4: 'five', 9: 'ten' }));

    assert.equal(hunks(diff, 3).hunks.length, 1);
    assert.deepEqual(hunks(diff, 3).hunks[0].changes, { from: 0, to: 2 });
    assert.equal(hunks(diff, 1).hunks.length, 2);
    assert.deepEqual(hunks(diff, 0).gaps.map(({ from, to }) => to - from), [4, 4, 10]);
});

test('hunks treat identical texts as one gap and an unlimited context as none', () => {
    let same = diffTexts(numbered(5), numbered(5));

    assert.deepEqual(hunks(same).hunks, []);
    assert.deepEqual(hunks(same).gaps, [{ from: 0, to: 5 }]);
    assert.deepEqual(hunks(diffTexts(numbered(9), numbered(9, { 4: 'x' })), Infinity).gaps, []);
});

test('hunks count pure insertions and deletions from their change', () => {
    let diff = diffTexts('a\nb\nc', 'a\nb\nx\nc'),
        [hunk] = hunks(diff, 0).hunks;

    assert.deepEqual(hunk.original, { from: 2, to: 2 });
    assert.deepEqual(hunk.modified, { from: 2, to: 3 });
});

test('acceptChange and revertChange apply one change to either side', () => {
    let original = 'a\nb\nc\nd',
        modified = 'a\nB\nc\nd\ne',
        diff = diffTexts(original, modified);

    assert.equal(revertChange(modified, diff.changes[0]), 'a\nb\nc\nd\ne');
    assert.equal(revertChange(modified, diff.changes[1]), 'a\nB\nc\nd');
    assert.equal(acceptChange(original, diff.changes[0]), 'a\nB\nc\nd');
    assert.equal(acceptChange(original, diff.changes[1]), 'a\nb\nc\nd\ne');
    assert.equal(revertChange('a\r\nB', diffTexts('a\r\nb', 'a\r\nB').changes[0]), 'a\r\nb');
});

test('words marks only the changed words of a line pair', () => {
    let result = words('let total = count + 1;', 'let total = amount + 2;');

    assert.deepEqual(result.original, [{ from: 12, to: 17 }, { from: 20, to: 21 }]);
    assert.deepEqual(result.modified, [{ from: 12, to: 18 }, { from: 21, to: 22 }]);
});

test('words joins changes separated only by whitespace', () => {
    assert.deepEqual(words('keep one two', 'keep three four'), {
        modified: [{ from: 5, to: 15 }],
        original: [{ from: 5, to: 12 }]
    });
});

test('words gives up on unrelated or very long lines', () => {
    assert.equal(words('alpha beta', 'gamma delta'), null);
    assert.equal(words('x'.repeat(3000), 'y'.repeat(3000)), null);
});

test('words can ignore whitespace changes', () => {
    assert.deepEqual(words('a  b', 'a b', true), { modified: [], original: [] });
    assert.deepEqual(words('a  b', 'a b').original, [{ from: 1, to: 3 }]);
});

test('diff3 takes changes made on one side only', () => {
    let result = diff3('a\nb\nc\nd\ne', 'A\nb\nc\nd\ne', 'a\nb\nc\nd\nE');

    assert.equal(result.conflicts, 0);
    assert.equal(result.text, 'A\nb\nc\nd\nE');
    assert.deepEqual(result.regions.map((region) => region.kind), ['current', 'equal', 'incoming']);
});

test('diff3 accepts identical changes and conflicts on different ones', () => {
    assert.equal(diff3('a\nb\nc', 'a\nX\nc', 'a\nX\nc').text, 'a\nX\nc');

    let result = diff3('a\nb\nc', 'a\nours\nc', 'a\ntheirs\nc');

    assert.equal(result.conflicts, 1);
    assert.equal(result.text, 'a\n<<<<<<< current\nours\n||||||| base\nb\n=======\ntheirs\n>>>>>>> incoming\nc');
});

test('diff3 handles insertions, deletions and a missing base', () => {
    assert.equal(diff3('a\nb\nc\nd\ne', 'a\nb\nb2\nc\nd\ne', 'a\nb\nc\nd').text, 'a\nb\nb2\nc\nd');
    assert.equal(diff3('a\nb\nc\nd\ne\nf', 'a\nb\nc\nd\ne\nf\ng', 'z\na\nb\nc\nd\ne\nf').text, 'z\na\nb\nc\nd\ne\nf\ng');

    let result = diff3(null, 'a\nb\nc', 'a\nx\nc');

    assert.equal(result.conflicts, 1);
    assert.equal(result.text, 'a\n<<<<<<< current\nb\n=======\nx\n>>>>>>> incoming\nc');
});

test('diff3 keeps the line endings of the current side', () => {
    assert.equal(diff3('a\r\nb', 'a\r\nB', 'a\r\nb').text, 'a\r\nB');
});

test('conflictMarkers finds blocks with and without a base section', () => {
    let text = diff3('a\nb\nc', 'a\nours\nc', 'a\ntheirs\nc').text + '\n<<<<<<< x\n1\n=======\n2\n>>>>>>> y',
        list = conflictMarkers(text);

    assert.equal(list.length, 2);
    assert.deepEqual({ ...list[0], from: 0, to: 0 }, { base: 'b\n', current: 'ours\n', from: 0, incoming: 'theirs\n', line: 1, to: 0 });
    assert.equal(text.slice(list[0].from, list[0].to), '<<<<<<< current\nours\n||||||| base\nb\n=======\ntheirs\n>>>>>>> incoming\n');
    assert.equal(list[1].base, null);
    assert.equal(list[1].line, 9);
    assert.equal(list[1].to, text.length);
    assert.deepEqual(conflictMarkers('<<<<<<< a\nx\n=======\n'), []);
});

test('resolveMarker replaces a block with the chosen side', () => {
    let text = 'a\n<<<<<<< current\nours\n=======\ntheirs\n>>>>>>> incoming\nc',
        [marker] = conflictMarkers(text),
        apply = (choice) => text.slice(0, marker.from) + resolveMarker(text, marker, choice) + text.slice(marker.to);

    assert.equal(apply('current'), 'a\nours\nc');
    assert.equal(apply('incoming'), 'a\ntheirs\nc');
    assert.equal(apply('both'), 'a\nours\ntheirs\nc');

    let last = 'a\n<<<<<<< current\nours\n=======\ntheirs\n>>>>>>> incoming',
        [end] = conflictMarkers(last);

    assert.equal(last.slice(0, end.from) + resolveMarker(last, end, 'both'), 'a\nours\ntheirs');
});
