import assert from 'node:assert/strict';
import test from 'node:test';


// The module keeps one observer for its lifetime, so the fakes stay installed for the whole file.
let frames = new Map(),
    frameId = 0,
    log = [],
    observers = [];

class FakeObserver {
    constructor(callback) {
        this.callback = callback;
        this.targets = new Map();
        observers.push(this);
    }
    disconnect() { this.targets.clear(); }
    observe(target, options) { this.targets.set(target, options); }
    unobserve(target) { this.targets.delete(target); }
}

Object.assign(globalThis, {
    cancelAnimationFrame: (id) => frames.delete(id),
    getComputedStyle: (element) => {
        log.push(`style ${element.name}`);
        return { writingMode: element.writingMode ?? 'horizontal-tb' };
    },
    requestAnimationFrame: (callback) => {
        frames.set(++frameId, callback);
        return frameId;
    },
    ResizeObserver: FakeObserver
});

let { observe, observer, observeSize } = await import('../src/shared/resize.ts');


function box(blockSize, inlineSize) {
    return [{ blockSize, inlineSize }];
}

function deliver(...entries) {
    observers[0].callback(entries.map(([target, blockSize, inlineSize]) => ({ borderBoxSize: box(blockSize, inlineSize), target })));
}

function element(name, height, width, extra = {}) {
    return {
        name,
        get offsetHeight() { log.push(`read ${name}`); return Math.round(this.rect.height); },
        get offsetWidth() { return Math.round(this.rect.width); },
        getBoundingClientRect() { return this.rect; },
        rect: { height, width },
        ...extra
    };
}

function frame() {
    let callbacks = [...frames.values()];

    frames.clear();
    callbacks.forEach((callback) => callback());
}

function tick() {
    return new Promise((resolve) => setTimeout(resolve));
}


test('handlers share one observer and receive their own entries together', () => {
    let a = {}, b = {}, c = {},
        calls = [],
        first = (entries) => calls.push(['first', entries.map((entry) => entry.target)]),
        second = (entries) => calls.push(['second', entries.map((entry) => entry.target)]);

    let unobserveA = observe(a, first, { box: 'border-box' }),
        unobserveB = observe(b, first),
        unobserveSecond = [observe(b, second), observe(c, second)];

    assert.equal(observers.length, 1);
    assert.deepEqual(observers[0].targets.get(a), { box: 'border-box' });

    deliver([a, 1, 1], [b, 1, 1], [c, 1, 1]);
    assert.deepEqual(calls, [['first', [a, b]], ['second', [b, c]]]);

    calls.length = 0;
    unobserveA();
    assert.equal(observers[0].targets.has(a), false);
    deliver([a, 2, 2], [b, 2, 2]);
    assert.deepEqual(calls, [['first', [b]], ['second', [b]]]);

    // One handler leaving an element keeps it observed for the other.
    calls.length = 0;
    unobserveB();
    assert.equal(observers[0].targets.has(b), true);
    deliver([b, 3, 3]);
    assert.deepEqual(calls, [['second', [b]]]);
    unobserveSecond.forEach((unobserve) => unobserve());
    assert.equal(observers[0].targets.has(b), false);
});

test('an element unobserved earlier in the same delivery is not reported', () => {
    let a = {}, b = {},
        calls = [],
        second = () => calls.push('second'),
        unobserveB;

    observe(a, () => {
        calls.push('first');
        unobserveB();
    });
    unobserveB = observe(b, second);
    deliver([a, 1, 1], [b, 1, 1]);
    assert.deepEqual(calls, ['first']);
    assert.equal(observers[0].targets.has(b), false);
});

test('a group disconnects every element it observes', () => {
    let a = {}, b = {},
        calls = 0,
        group = observer(() => calls++);

    group.observe(a);
    group.observe(b);
    deliver([a, 1, 1], [b, 1, 1]);
    assert.equal(calls, 1);

    group.disconnect();
    assert.equal(observers[0].targets.has(a), false);
    assert.equal(observers[0].targets.has(b), false);
    deliver([a, 2, 2]);
    assert.equal(calls, 1);
});

test('sizes on connect are read together, before any change, and the first delivery finds nothing new', async () => {
    let a = element('a', 60.5, 300),
        b = element('b', 20, 100),
        empty = element('empty', 0, 0),
        sizes = [];

    let connect = (target) => {
        let size = observeSize((size, element) => {
            log.push(`change ${element.name}`);
            sizes.push([element.name, size]);
        });

        size.onconnect(target);
        return size;
    };

    log.length = 0;

    let first = connect(a),
        second = connect(b),
        third = connect(empty);

    // Nothing is read inside onconnect; the observer's delivery before the flush is superseded by it.
    assert.deepEqual(log, []);
    deliver([a, 1, 1]);
    await tick();

    assert.deepEqual(log, ['read a', 'style a', 'read b', 'style b', 'read empty', 'style empty', 'change a', 'change b']);
    assert.deepEqual(sizes, [['a', { height: 60.5, width: 300 }], ['b', { height: 20, width: 100 }]]);

    deliver([a, 60.5, 300], [b, 20, 100], [empty, 0, 0]);
    assert.equal(frames.size, 0);
    assert.equal(sizes.length, 2);

    first.ondisconnect();
    second.ondisconnect();
    third.ondisconnect();
});

test('later changes apply in the next frame, coalesced, and not at all once disconnected', async () => {
    let a = element('a', 10, 100),
        sizes = [],
        size = observeSize((size) => sizes.push(size));

    size.onconnect(a);
    await tick();
    sizes.length = 0;

    deliver([a, 20, 100]);
    deliver([a, 30, 100]);
    assert.deepEqual(sizes, []);
    assert.equal(frames.size, 1);
    frame();
    assert.deepEqual(sizes, [{ height: 30, width: 100 }]);

    // Back to the applied size before the frame: nothing to apply.
    deliver([a, 40, 100]);
    deliver([a, 30, 100]);
    frame();
    assert.equal(sizes.length, 1);

    deliver([a, 50, 100]);
    size.ondisconnect();
    frame();
    deliver([a, 60, 100]);
    frame();
    assert.equal(sizes.length, 1);
    assert.equal(observers[0].targets.has(a), false);
});

test('reconnecting drops the previous element and a connect not yet flushed', async () => {
    let a = element('a', 10, 10),
        b = element('b', 20, 20),
        sizes = [],
        size = observeSize((size, element) => sizes.push([element.name, size]));

    size.onconnect(a);
    size.onconnect(b);
    await tick();
    assert.deepEqual(sizes, [['b', { height: 20, width: 20 }]]);
    assert.equal(observers[0].targets.has(a), false);

    size.ondisconnect();
    size.onconnect(a);
    size.ondisconnect();
    await tick();
    assert.equal(sizes.length, 1);
});

test('a transformed box measures its layout size, and vertical writing maps blocks to width', async () => {
    let scaled = element('scaled', 30, 50),
        vertical = element('vertical', 300, 80, { writingMode: 'vertical-rl' }),
        sizes = [];

    scaled.rect = { height: 15, width: 25 };
    Object.defineProperties(scaled, {
        offsetHeight: { get: () => 30 },
        offsetWidth: { get: () => 50 }
    });

    let a = observeSize((size) => sizes.push(size)),
        b = observeSize((size) => sizes.push(size));

    a.onconnect(scaled);
    b.onconnect(vertical);
    await tick();
    assert.deepEqual(sizes, [{ height: 30, width: 50 }, { height: 300, width: 80 }]);

    deliver([vertical, 90, 300]);
    frame();
    assert.deepEqual(sizes[2], { height: 300, width: 90 });
    a.ondisconnect();
    b.ondisconnect();
});
