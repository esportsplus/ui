import assert from 'node:assert/strict';
import test from 'node:test';
import { trackTransition } from '../src/shared/transition.ts';


function frames(t) {
    let queue = new Map(), id = 0;

    for (let [key, value] of Object.entries({
        requestAnimationFrame: callback => { queue.set(++id, callback); return id; },
        cancelAnimationFrame: frame => queue.delete(frame)
    })) {
        let original = Object.getOwnPropertyDescriptor(globalThis, key);

        Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
        t.after(() => {
            if (original) Object.defineProperty(globalThis, key, original);
            else delete globalThis[key];
        });
    }

    return () => {
        let callbacks = [...queue.values()];
        queue.clear();
        callbacks.forEach(callback => callback());
    };
}


test('settles unchanged heights and reduced motion without needing transitionend', t => {
    let flush = frames(t), changes = [], reads = 0,
        element = { getAnimations: () => { reads++; return []; } },
        motion = trackTransition('height', (running, target) => changes.push([running, target]));

    motion.attributes.onconnect(element);
    motion.settle();
    motion.settle();
    flush();
    assert.equal(reads, 1);
    assert.deepEqual(changes, [[false, element]]);
    motion.attributes.ondisconnect();
});

test('keeps reversing transitions running and filters unrelated and descendant events', t => {
    let flush = frames(t), changes = [], animations = [],
        element = { getAnimations: () => animations },
        motion = trackTransition('height', running => changes.push(running)),
        event = { target: element, propertyName: 'height', pseudoElement: '' };

    motion.attributes.onconnect(element);
    flush();
    motion.attributes.ontransitionrun({ ...event, target: {} });
    motion.attributes.ontransitionrun({ ...event, propertyName: 'opacity' });
    motion.attributes.ontransitionrun({ ...event, pseudoElement: '::before' });
    assert.deepEqual(changes, [false]);

    animations = [{ transitionProperty: 'height', playState: 'running' }];
    motion.attributes.ontransitionrun(event);
    motion.attributes.ontransitioncancel(event);
    motion.attributes.ontransitionrun(event);
    flush();
    assert.equal(changes.at(-1), true);

    animations = [
        { transitionProperty: 'height', playState: 'finished' },
        { transitionProperty: 'opacity', playState: 'running' }
    ];
    motion.attributes.ontransitionend(event);
    flush();
    assert.equal(changes.at(-1), false);
    motion.attributes.ondisconnect();
});

test('disconnect cancels pending checks and clears the connected element', t => {
    let flush = frames(t), changes = [],
        element = { getAnimations() { throw new Error('Read disconnected element'); } },
        motion = trackTransition('height', (running, target) => changes.push([running, target]));

    motion.attributes.onconnect(element);
    motion.attributes.ondisconnect();
    flush();
    assert.deepEqual(changes, [[false, undefined]]);
});
