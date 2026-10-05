import assert from 'node:assert/strict';
import test from 'node:test';


let errors = [],
    frameId = 0,
    frames = new Map();

Object.assign(globalThis, {
    cancelAnimationFrame: (id) => frames.delete(id),
    reportError: (error) => errors.push(error),
    requestAnimationFrame: (callback) => {
        frames.set(++frameId, callback);
        return frameId;
    }
});

let { ticker } = await import('../src/shared/ticker.ts');


function frame(now) {
    let callbacks = [...frames.values()];

    frames.clear();
    callbacks.forEach((callback) => callback(now));
}


test('every subscriber runs off one frame callback, handed the same timestamp', () => {
    let heard = [],
        stops = [1, 2, 3].map((n) => ticker((now) => heard.push([n, now])));

    assert.equal(frames.size, 1);
    frame(16);
    assert.equal(frames.size, 1);
    assert.deepEqual(heard, [[1, 16], [2, 16], [3, 16]]);

    stops.forEach((stop) => stop());
});

test('the loop stops once nothing is subscribed, and starts again on the next subscribe', () => {
    let stop = ticker(() => {});

    assert.equal(frames.size, 1);
    stop();
    stop();
    assert.equal(frames.size, 0);

    stop = ticker(() => {});
    assert.equal(frames.size, 1);
    stop();
});

test('a subscriber unsubscribing itself stops the loop after its frame', () => {
    let calls = 0,
        stop = ticker(() => {
            calls++;
            stop();
        });

    frame(16);
    frame(32);
    assert.equal(calls, 1);
    assert.equal(frames.size, 0);
});

test('one subscribed mid-frame starts on the next frame, one unsubscribed mid-frame is skipped', () => {
    let heard = [],
        late,
        stopB,
        stopA = ticker((now) => {
            heard.push(['a', now]);
            stopB();
            late ??= ticker((t) => heard.push(['late', t]));
        });

    stopB = ticker((now) => heard.push(['b', now]));
    frame(16);
    frame(32);

    assert.deepEqual(heard, [['a', 16], ['a', 32], ['late', 32]]);

    stopA();
    late();
    assert.equal(frames.size, 0);
});

test('one subscriber throwing does not stop the others or the loop', () => {
    let failure = new Error('tick failed'),
        heard = [],
        stops = [
            ticker(() => {
                throw failure;
            }),
            ticker((now) => heard.push(now))
        ];

    frame(16);
    frame(32);

    assert.deepEqual(heard, [16, 32]);
    assert.deepEqual(errors, [failure, failure]);

    stops.forEach((stop) => stop());
    errors.length = 0;
});

test('marquees sharing a scroll tracker step its spring once per frame off the shared timestamp', async () => {
    let { step } = await import('../src/components/marquee/velocity.ts'),
        tracker = { factor: 0, smooth: 0, smoothRate: 0, stepped: 0, time: 0, velocity: 2000 },
        steps = [],
        stops = [0, 1].map(() => ticker((now) => {
            let before = tracker.smoothRate;

            tracker.time = now;
            step(tracker, now, 1 / 60);
            steps.push(tracker.smoothRate !== before);
        }));

    frame(16);
    frame(32);

    assert.deepEqual(steps, [true, false, true, false]);

    stops.forEach((stop) => stop());
});
