import assert from 'node:assert/strict';
import test from 'node:test';
import './resolve.mjs';
const { lead, span, step } = await import('../src/components/chat-minimap/range.ts');


test('lead puts the turn first and keeps the range size', () => {
    assert.deepEqual(lead(4, { end: 5, start: 2 }, 10), { end: 7, start: 4 });
    assert.deepEqual(lead(0, { end: 5, start: 2 }, 10), { end: 3, start: 0 });
});

test('lead stops where the thread can scroll no further', () => {
    assert.deepEqual(lead(9, { end: 5, start: 2 }, 10), { end: 10, start: 7 });
    assert.deepEqual(lead(-3, { end: 3, start: 0 }, 10), { end: 3, start: 0 });
});

test('lead grows an empty range to one turn and shrinks one larger than the thread', () => {
    assert.deepEqual(lead(3, { end: 0, start: 0 }, 10), { end: 4, start: 3 });
    assert.deepEqual(lead(1, { end: 8, start: 0 }, 4), { end: 4, start: 0 });
    assert.deepEqual(lead(0, { end: 0, start: 0 }, 0), { end: 0, start: 0 });
});

test('span covers every index in any order', () => {
    assert.deepEqual(span([5, 3, 4]), { end: 6, start: 3 });
    assert.deepEqual(span(new Set([7])), { end: 8, start: 7 });
});

test('span skips unknown turns and is null with none', () => {
    assert.deepEqual(span([-1, 2, -1]), { end: 3, start: 2 });
    assert.equal(span([]), null);
    assert.equal(span([-1]), null);
});

test('step moves one turn either way from the first in view', () => {
    assert.equal(step(-1, { end: 5, start: 2 }, 10), 1);
    assert.equal(step(1, { end: 5, start: 2 }, 10), 3);
});

test('step is -1 at either end of the thread', () => {
    assert.equal(step(-1, { end: 3, start: 0 }, 10), -1);
    assert.equal(step(1, { end: 10, start: 7 }, 10), -1);
    assert.equal(step(1, { end: 12, start: 9 }, 10), -1);
});

test('step from an empty range goes to its turn, and never back', () => {
    assert.equal(step(1, { end: 0, start: 0 }, 10), 0);
    assert.equal(step(-1, { end: 0, start: 0 }, 10), -1);
    assert.equal(step(1, { end: 0, start: 0 }, 0), -1);
});

test('step back from a range past a shrunken thread lands on its last turn', () => {
    assert.equal(step(-1, { end: 14, start: 12 }, 10), 9);
});
