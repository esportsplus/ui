import assert from 'node:assert/strict';
import test from 'node:test';
import { ReactiveArray } from '@esportsplus/reactivity';
import './resolve.mjs';
const { default: subscribe } = await import('../src/shared/subscribe.ts');


test('each mounted metric hears every change and an unmounted one is removed from the array', () => {
    let data = new ReactiveArray([{ label: 'a', value: 1 }]),
        first = 0,
        second = 0,
        stop = subscribe(data, () => first++),
        other = subscribe(data, () => second++);

    data.push({ label: 'b', value: 2 });
    data.splice(0, 1);
    data.reverse();
    data.sort((a, b) => a.value - b.value);
    data.unshift({ label: 'c', value: 3 });
    data.shift();
    data.pop();
    assert.equal(first, 7);
    assert.equal(second, 7);

    stop();
    data.push({ label: 'd', value: 4 });
    assert.equal(first, 7);
    assert.equal(second, 8);

    other();
    stop();
    data.push({ label: 'e', value: 5 });
    assert.equal(second, 8);
    assert.deepEqual(Object.keys(data.listeners), []);
});

test('the same listener on two arrays is removed from each independently', () => {
    let a = new ReactiveArray([]),
        b = new ReactiveArray([]),
        calls = 0,
        listener = () => calls++,
        stop = subscribe(a, listener);

    subscribe(b, listener);
    stop();
    a.push(1);
    b.push(1);
    assert.equal(calls, 1);
});
