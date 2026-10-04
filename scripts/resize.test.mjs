import assert from 'node:assert/strict';
import test from 'node:test';
import { observeSize } from '../src/shared/resize.ts';


function browser(t, Observer, writingMode = 'horizontal-tb') {
    for (let [key, value] of Object.entries({ ResizeObserver: Observer, getComputedStyle: () => ({ writingMode }) })) {
        let original = Object.getOwnPropertyDescriptor(globalThis, key);

        Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
        t.after(() => {
            if (original) {
                Object.defineProperty(globalThis, key, original);
            }
            else {
                delete globalThis[key];
            }
        });
    }
}


test('natural size observation uses delivered border boxes, filters duplicates and cleans up on reconnect', (t) => {
    let observers = [],
        sizes = [],
        element = {
            get offsetHeight() { throw new Error('Unexpected layout read'); },
            get offsetWidth() { throw new Error('Unexpected layout read'); }
        };

    browser(t, class {
        constructor(callback) {
            this.callback = callback;
            observers.push(this);
        }
        observe(target, options) {
            assert.equal(target, element);
            assert.deepEqual(options, { box: 'border-box' });
        }
        disconnect() { this.disconnected = true; }
        deliver(blockSize, inlineSize) {
            this.callback([{ borderBoxSize: [{ blockSize, inlineSize }] }]);
        }
    });

    let observation = observeSize((size, target) => {
        assert.equal(target, element);
        sizes.push(size);
    });

    observation.onconnect(element);
    observers[0].deliver(60.5, 300);
    observers[0].deliver(60.5, 300);
    observers[0].deliver(60.5, 200);
    observation.onconnect(element);
    assert.equal(observers[0].disconnected, true);
    observers[0].deliver(90, 300);
    observers[1].deliver(60.5, 200);
    observation.ondisconnect();
    observers[1].deliver(120, 300);
    assert.equal(observers[1].disconnected, true);
    assert.deepEqual(sizes, [
        { height: 60.5, width: 300 },
        { height: 60.5, width: 200 },
        { height: 60.5, width: 200 }
    ]);
});

test('vertical writing uses the physical height and width', (t) => {
    let callback,
        received;

    browser(t, class {
        constructor(change) { callback = change; }
        observe() {}
        disconnect() {}
    }, 'vertical-rl');

    let observation = observeSize((size) => { received = size; });

    observation.onconnect({});
    callback([{ borderBoxSize: [{ blockSize: 300, inlineSize: 80 }] }]);
    assert.deepEqual(received, { height: 80, width: 300 });
    observation.ondisconnect();
});
