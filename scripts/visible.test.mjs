import assert from 'node:assert/strict';
import test from 'node:test';


// A native observer queues an initial entry for every target it starts observing, re-observing included.
let observers = [];

class FakeObserver {
    constructor(callback, options) {
        this.callback = callback;
        this.connected = true;
        this.options = options;
        this.queue = [];
        this.targets = new Set();
        observers.push(this);
    }
    deliver(...entries) {
        this.callback(entries.map(([target, isIntersecting]) => ({ isIntersecting, target })));
    }
    disconnect() {
        this.connected = false;
        this.targets.clear();
    }
    flush() {
        let queue = this.queue;

        this.queue = [];
        this.deliver(...queue.filter(([target]) => this.targets.has(target)));
    }
    observe(target) {
        this.targets.add(target);
        this.queue.push([target, false]);
    }
    unobserve(target) {
        this.targets.delete(target);
    }
}

globalThis.IntersectionObserver = FakeObserver;

let { observeIntersection, onceVisible } = await import('../src/shared/visible.ts');


function live() {
    return observers.filter((observer) => observer.connected);
}

function reset() {
    observers.length = 0;
}


test('handlers with the same options share one observer and receive only their own entries', () => {
    reset();

    let a = {}, b = {}, c = {},
        calls = [],
        first = (entries) => calls.push(['first', entries.map((entry) => entry.target)]),
        second = (entries) => calls.push(['second', entries.map((entry) => entry.target)]),
        releases = [
            observeIntersection(a, first, { rootMargin: '96px' }),
            observeIntersection(b, first, { rootMargin: '96px' }),
            observeIntersection(c, second, { rootMargin: '96px' })
        ];

    assert.equal(observers.length, 1);
    assert.deepEqual(observers[0].options, { rootMargin: '96px' });

    observers[0].queue.length = 0;
    observers[0].deliver([a, true], [c, true], [b, false]);

    assert.deepEqual(calls, [['first', [a, b]], ['second', [c]]]);

    releases.forEach((release) => release());
});

test('distinct margins and thresholds get observers of their own', () => {
    reset();

    let element = {},
        noop = () => {},
        releases = [
            observeIntersection(element, noop),
            observeIntersection(element, noop, { threshold: 0.4 }),
            observeIntersection(element, noop, { rootMargin: '400px 0px' }),
            observeIntersection(element, noop, { rootMargin: '400px 0px' }),
            observeIntersection(element, noop, { threshold: [0, 0.5] })
        ];

    assert.equal(live().length, 4);
    releases.forEach((release) => release());
    assert.equal(live().length, 0);
});

test('a newly observed element delivers its initial entry, even to a second handler on the same element', () => {
    reset();

    let element = {},
        heard = [],
        release = [
            observeIntersection(element, (entries) => heard.push(['first', entries.length])),
        ];

    observers[0].flush();
    release.push(observeIntersection(element, (entries) => heard.push(['second', entries.length])));
    observers[0].flush();

    // Both hear the re-observation, as two observers of their own would each have heard their first delivery.
    assert.deepEqual(heard, [['first', 1], ['first', 1], ['second', 1]]);

    release.forEach((r) => r());
});

test('the last element released disconnects the observer, and the next observe makes a fresh one', () => {
    reset();

    let a = {}, b = {},
        noop = () => {},
        releaseA = observeIntersection(a, noop),
        releaseB = observeIntersection(b, noop);

    releaseA();
    releaseA();
    assert.equal(live().length, 1);
    assert.equal(observers[0].targets.has(a), false);
    assert.equal(observers[0].targets.has(b), true);

    releaseB();
    assert.equal(live().length, 0);

    let releaseC = observeIntersection(a, noop);

    assert.equal(observers.length, 2);
    assert.equal(live().length, 1);
    releaseC();
});

test('an element released by an earlier handler in the same delivery is not reported', () => {
    reset();

    let a = {}, b = {},
        heard = [],
        releaseB,
        releaseA = observeIntersection(a, () => {
            heard.push('a');
            releaseB();
        });

    releaseB = observeIntersection(b, () => heard.push('b'));
    observers[0].deliver([a, true], [b, true]);

    assert.deepEqual(heard, ['a']);
    releaseA();
});

test('onceVisible shows once, on the first entry in view, and stops observing', () => {
    reset();

    let element = {},
        shown = 0,
        attributes = onceVisible(() => shown++, { threshold: 0.4 });

    attributes.onconnect(element);
    assert.deepEqual(observers[0].options, { threshold: 0.4 });

    observers[0].flush();
    assert.equal(shown, 0);

    observers[0].deliver([element, true]);
    assert.equal(shown, 1);
    assert.equal(live().length, 0);

    attributes.ondisconnect();
    assert.equal(shown, 1);
});

test('onceVisible stops observing on disconnect', () => {
    reset();

    let attributes = onceVisible(() => {});

    attributes.onconnect({});
    assert.equal(live().length, 1);
    attributes.ondisconnect();
    assert.equal(live().length, 0);
});
