import assert from 'node:assert/strict';
import test from 'node:test';
import './resolve.mjs';


// A 1000 x 800 window with a classic 15px scrollbar on each axis: the client box is what's left to place into.
Object.assign(globalThis, {
    document: { documentElement: { clientHeight: 785, clientWidth: 985 } },
    getComputedStyle: (element) => ({
        getPropertyValue: (name) => element.style?.[name] ?? '',
        paddingTop: element.style?.paddingTop ?? '0px'
    }),
    innerHeight: 800,
    innerWidth: 1000
});

let { fit, flip, viewport } = await import('../src/shared/viewport.ts'),
    { default: place } = await import('../src/components/select/placement.ts');


test('the viewport is the client box, leaving out the scrollbars', () => {
    assert.deepEqual(viewport(), { height: 785, width: 985 });
});

test('fit keeps a box inside the margins, and the near margin wins when it fits neither', () => {
    assert.equal(fit(100, 50, 985, 12), 100);
    assert.equal(fit(-20, 50, 985, 12), 12);
    // Against the scrollbar, not the window edge: 985 - 12 - 50.
    assert.equal(fit(950, 50, 985, 12), 923);
    assert.equal(fit(400, 2000, 985, 12), 12);
});

test('flip opens toward the far end unless that crosses its margin, never past the near margin', () => {
    assert.equal(flip(100, 200, 985, 8), 100);
    // 900 + 80 is past 985 - 8 though inside the 1000px window: it opens back from the point instead.
    assert.equal(flip(900, 80, 985, 8), 820);
    assert.equal(flip(50, 200, 240, 8), 8);
});

function select({ count = 20, left = 100, selected = 0, top = 100 } = {}) {
    let trigger = {
        getBoundingClientRect: () => ({ height: 32, left, top, width: 120 }),
        offsetHeight: 32,
        offsetLeft: 0,
        offsetTop: 0,
        offsetWidth: 120
    };

    return place({
        label: { offsetLeft: 12 },
        option: { offsetHeight: 32 },
        panel: { style: {} },
        scroller: { style: { paddingTop: '4px' } },
        trigger,
        value: { offsetLeft: 0 }
    }, count, selected);
}

function style(result) {
    return Object.fromEntries([...result.style.matchAll(/^\s*(left|top|width): ([-\d.]+)px/gm)].map(([, name, value]) => [name, Number(value)]));
}

test('select places the selected option over the trigger when it fits', () => {
    let result = select({ selected: 0 });

    assert.equal(result.scroll, 0);
    assert.deepEqual(style(result), { left: -12, top: -4, width: 132 });
});

test('select stays clear of the bottom scrollbar, trading position for scroll', () => {
    // Eight 32px rows and 4px padding make a 264px panel, which must end at 785 - 8, not the window's 800 - 8.
    let result = select({ selected: 0, top: 600 }),
        { top } = style(result);

    assert.equal(600 + top + 264, 777);
});

test('select stays clear of the side scrollbar', () => {
    let { left, width } = style(select({ left: 900 }));

    assert.equal(900 + left + width, 985 - 8);
});
