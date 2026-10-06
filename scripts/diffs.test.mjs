import assert from 'node:assert/strict';
import test from 'node:test';
import './resolve.mjs';


const { diffLines, diffSequences } = await import('../src/components/editor/diffs/engine.ts');


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
