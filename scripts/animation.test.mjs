import assert from 'node:assert/strict';
import test from 'node:test';
import { finished } from '../src/shared/animation.ts';


test('closing waits for finite motion but not a looping animation', async () => {
    let resolve,
        motion = new Promise((done) => { resolve = done; }),
        options = { subtree: true },
        settled = false,
        result = finished({
            getAnimations(received) {
                assert.equal(received, options);

                return [
                    { effect: { getComputedTiming: () => ({ endTime: Infinity }) }, finished: new Promise(() => {}) },
                    { effect: { getComputedTiming: () => ({ endTime: 100 }) }, finished: motion }
                ];
            }
        }, options).then((value) => {
            settled = true;
            return value;
        });

    await Promise.resolve();
    assert.equal(settled, false);
    resolve('finished');

    assert.deepEqual(await Promise.race([
        result,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Looping animation blocked closing')), 100))
    ]), [{ status: 'fulfilled', value: 'finished' }]);
});

test('cancelled motion still lets closing finish', async () => {
    let cancelled = new Error('Animation cancelled');

    assert.deepEqual(await finished({
        getAnimations: () => [{ finished: Promise.reject(cancelled) }]
    }), [{ status: 'rejected', reason: cancelled }]);
});

test('closing without animations settles immediately', async () => {
    assert.deepEqual(await finished({ getAnimations: () => [] }), []);
});
