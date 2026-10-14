import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { easing } from '../src/components/highlight/easing.ts';


const spring = readFileSync(new URL('../src/components/highlight/scss/variables.scss', import.meta.url), 'utf8')
    .match(/--glide-timing-function: (linear\([^;]+\));/)[1];
const samples = (curve) => curve.slice(7, -1).split(',').map(parseFloat);


test('short highlight moves retain the exact existing spring', () => {
    for (let distance of [0, 24, 100, 200]) {
        assert.equal(easing(spring, distance), spring);
    }
});

test('long moves cap the bounce at eight pixels without changing the approach or settling shape', () => {
    let original = samples(spring);

    for (let distance of [250, 1000, 5000]) {
        let limited = samples(easing(spring, distance)),
            peak = Math.max(...limited);

        assert.ok(Math.abs((peak - 1) * distance - 8) < 1e-9);
        assert.equal(limited.at(-1), 1);

        original.forEach((value, index) => {
            if (value <= 1) {
                assert.equal(limited[index], value);
            }
            else {
                assert.ok(Math.abs((limited[index] - 1) / (peak - 1) - (value - 1) / (Math.max(...original) - 1)) < 1e-9);
            }
        });
    }
});

test('boundary easing and non-spring timing functions remain unchanged', () => {
    for (let curve of ['ease', 'cubic-bezier(0.22, 1, 0.36, 1)', 'linear(0, 0.5, 1)']) {
        assert.equal(easing(curve, 5000), curve);
    }
});

test('sample positions survive clamping, including anticipation before the move', () => {
    let curve = easing('linear(0, -0.1 10%, 0.5 30% 40%, 1.1 80%, 1)', 800),
        values = samples(curve);

    assert.ok(Math.abs(values[1] * 800 + 8) < 1e-9);
    assert.ok(Math.abs((values[3] - 1) * 800 - 8) < 1e-9);
    assert.match(curve, / 10%,\s*0.5 30% 40%,[^,]+ 80%,/);
});
