import assert from 'node:assert/strict';
import { mock, test } from 'node:test';


// Counts the timers the queue holds, through the mocked setTimeout.
let errors = [],
    pending = new Set(),
    real = { clearTimeout: globalThis.clearTimeout, setTimeout: globalThis.setTimeout };

mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 0 });

let mocked = { clearTimeout: globalThis.clearTimeout, setTimeout: globalThis.setTimeout };

Object.assign(globalThis, {
    clearTimeout: (id) => {
        pending.delete(id);
        mocked.clearTimeout(id);
    },
    reportError: (error) => errors.push(error),
    setTimeout: (callback, delay) => {
        let id = mocked.setTimeout(() => {
            pending.delete(id);
            callback();
        }, delay);

        pending.add(id);
        return id;
    }
});

let { deadline } = await import('../src/shared/deadline.ts');


// The mock runs every timer a tick passes with the clock already at the tick's end, so short spans step a millisecond
// at a time to let each callback read its own time.
function at(ms) {
    if (ms - Date.now() > 10_000) {
        mock.timers.tick(ms - Date.now());
        return;
    }

    while (Date.now() < ms) {
        mock.timers.tick(1);
    }

    mock.timers.tick(0);
}


test('many deadlines share one timer, each running once its time comes, in order', () => {
    let heard = [],
        cancels = [];

    for (let ms of [5000, 1000, 3000, 1000, 2000]) {
        cancels.push(deadline(ms, () => heard.push([ms, Date.now()])));
    }

    assert.equal(pending.size, 1);

    at(999);
    assert.deepEqual(heard, []);

    at(1000);
    assert.deepEqual(heard, [[1000, 1000], [1000, 1000]]);
    assert.equal(pending.size, 1);

    at(5000);
    assert.deepEqual(heard, [[1000, 1000], [1000, 1000], [2000, 2000], [3000, 3000], [5000, 5000]]);
    assert.equal(pending.size, 0);
});

test('callbacks rescheduling in a flush set the timer once, for the earliest', () => {
    let base = Date.now(),
        armed = 0,
        heard = [],
        set = globalThis.setTimeout;

    globalThis.setTimeout = (callback, delay) => {
        armed++;
        return set(callback, delay);
    };

    // Rows whose labels change at their own 'value + n * unit', not on a shared wall-clock boundary.
    for (let value of [base - 400, base - 700, base - 100]) {
        let next = () => {
            let now = Date.now(),
                change = now + 1000 - ((now - value) % 1000);

            heard.push([value - base, now - base]);

            if (change < base + 3000) {
                deadline(change, next);
            }
        };

        deadline(base + 1000 - ((base - value) % 1000), next);
    }

    armed = 0;
    at(base + 3000);
    globalThis.setTimeout = set;

    assert.deepEqual(heard, [
        [-700, 300], [-400, 600], [-100, 900],
        [-700, 1300], [-400, 1600], [-100, 1900],
        [-700, 2300], [-400, 2600], [-100, 2900]
    ]);
    // Once per flush: nine flushes, and nothing armed after the last since no row rescheduled.
    assert.equal(armed, 8);
    assert.equal(pending.size, 0);
});

test('cancelling removes a deadline and re-arms for the next; the last cancel clears the timer', () => {
    let base = Date.now(),
        heard = [],
        first = deadline(base + 100, () => heard.push('first')),
        second = deadline(base + 200, () => heard.push('second')),
        third = deadline(base + 300, () => heard.push('third'));

    first();
    first();
    third();
    at(base + 150);
    assert.deepEqual(heard, []);
    at(base + 200);
    assert.deepEqual(heard, ['second']);
    second();
    assert.equal(pending.size, 0);
});

test('a deadline cancelled by an earlier callback in the same flush does not run', () => {
    let base = Date.now(),
        heard = [],
        second,
        first = deadline(base + 100, () => {
            heard.push('first');
            second();
        });

    second = deadline(base + 100, () => heard.push('second'));
    at(base + 100);

    assert.deepEqual(heard, ['first']);
    first();
    assert.equal(pending.size, 0);
});

test('one callback throwing does not stop the rest of its flush', () => {
    let base = Date.now(),
        failure = new Error('row failed'),
        heard = [];

    deadline(base + 10, () => {
        throw failure;
    });
    deadline(base + 10, () => heard.push('after'));
    at(base + 10);

    assert.deepEqual(heard, ['after']);
    assert.deepEqual(errors, [failure]);
    errors.length = 0;
});

test('a deadline past the longest timeout waits through it instead of firing at once', () => {
    let base = Date.now(),
        heard = 0,
        far = base + 2 ** 31 + 5000;

    deadline(far, () => heard++);
    at(base + 2 ** 31 - 1);
    assert.equal(heard, 0);
    assert.equal(pending.size, 1);

    at(far);
    assert.equal(heard, 1);
    assert.equal(pending.size, 0);
});

test('a deadline already past runs on the next timer turn', () => {
    let heard = 0;

    deadline(Date.now() - 1000, () => heard++);
    assert.equal(heard, 0);
    at(Date.now());
    assert.equal(heard, 1);
});

test.after(() => {
    Object.assign(globalThis, real);
    mock.timers.reset();
});
