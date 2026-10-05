import assert from 'node:assert/strict';
import test from 'node:test';
import { measure, slide, slides } from '../src/shared/animation.ts';


const TIMING = { duration: 200, easing: 'ease' };


// An element drawn at 'from' until the change, laid out at 'to' after it; every cancel, read and animate is logged.
function element(name, from, to, log) {
    let rect = from;

    return {
        animate(keyframes, options) {
            log.push(`animate ${name}`);

            return { cancel: () => log.push(`cancel ${name}`), keyframes, options };
        },
        getBoundingClientRect() {
            log.push(`read ${name}`);
            return rect;
        },
        move() {
            rect = to;
        },
        name
    };
}

function box(left, top) {
    return { bottom: top + 10, height: 10, left, right: left + 10, top, width: 10 };
}

function scene(log) {
    return [
        element('a', box(0, 0), box(0, 20), log),
        element('b', box(0, 20), box(0, 0), log),
        element('c', box(0, 40), box(0, 40), log)
    ];
}


test('slides cancel every running slide before reading any box, and hear new elements last', () => {
    let log = [],
        elements = scene(log),
        entered = element('d', null, box(0, 60), log);

    measure(elements);
    elements.forEach((e) => e.move());
    slides(elements, TIMING);

    // A second change interrupts the first, so each running slide is cancelled before anything is read.
    measure(elements);
    entered.move();
    log.length = 0;

    let all = [...elements, entered],
        heard = [];

    slides(all, TIMING, (e) => {
        heard.push(e.name);
        log.push(`enter ${e.name}`);
    });

    assert.deepEqual(log, [
        'cancel a', 'cancel b',
        'read a', 'read b', 'read c', 'read d',
        'enter d'
    ]);
    assert.deepEqual(heard, ['d']);
});

test('slides read the new box only after cancelling, and start a slide only where the box moved', () => {
    let log = [],
        elements = scene(log);

    measure(elements);
    elements.forEach((e) => e.move());
    log.length = 0;
    slides(elements, TIMING);

    assert.deepEqual(log, ['read a', 'read b', 'read c', 'animate a', 'animate b']);
});

test('slides return the same boxes, and start the same slides, as one slide per element', () => {
    let batchLog = [],
        batched = scene(batchLog),
        singleLog = [],
        single = scene(singleLog),
        started = (log) => log.filter((entry) => entry.startsWith('animate'));

    measure(batched);
    measure(single);
    batched.forEach((e) => e.move());
    single.forEach((e) => e.move());

    let rects = slides(batched, TIMING),
        expected = single.map((e) => slide(e, TIMING));

    assert.deepEqual(rects, expected);
    assert.deepEqual(started(batchLog), started(singleLog));
});

test('an element measure never saw still reports its box, and slide alone reports it as new', () => {
    let log = [],
        fresh = element('fresh', null, box(5, 5), log);

    fresh.move();

    assert.deepEqual(slides([fresh], TIMING), [box(5, 5)]);
    assert.equal(slide(fresh, TIMING), undefined);
});

test('without a timing nothing slides, but every box is still read', () => {
    let log = [],
        elements = scene(log);

    measure(elements);
    elements.forEach((e) => e.move());
    log.length = 0;

    assert.deepEqual(slides(elements, null), [box(0, 20), box(0, 0), box(0, 40)]);
    assert.deepEqual(log, ['read a', 'read b', 'read c']);
});
