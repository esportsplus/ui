import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { compileString } from 'sass';

const loadPaths = [fileURLToPath(new URL('../src/lib/scss/', import.meta.url))];
const compile = source => compileString(`@use 'css-variables' as lib; ${source}`, {
    loadPaths,
    style: 'compressed'
}).css;

test('preserves positional, named and mixed declaration calls', () => {
    const expected = ':root{--font-weight-300: 400;--font-weight-500: 600}';
    for (const args of [
        'font-weight, (300: 400, 500: 600)',
        '$prefix: font-weight, $tokens: (300: 400, 500: 600)',
        'font-weight, $tokens: (300: 400, 500: 600)'
    ]) {
        assert.equal(compile(`:root { @include lib.css-variables(${args}); }`), expected);
    }
});

test('three arguments wrap each custom-property value in its own class', () => {
    const expected = '.--font-weight-300{--font-weight-300: 400}.--font-weight-500{--font-weight-500: 600}.--font-weight-600{--font-weight-600: 700}';
    for (const args of [
        "'--font-weight', font-weight, (300: 400, 500: 600, 600: 700)",
        "$class: '--font-weight', $prefix: font-weight, $tokens: (300: 400, 500: 600, 600: 700)"
    ]) {
        assert.equal(compile(`@include lib.css-variables(${args});`), expected);
    }
});

test('nested maps produce matching declaration and utility suffixes', () => {
    assert.equal(compile(`
        $colors: (blue: (300: #abc, 500: #123));
        :root { @include lib.css-variables(color, $colors); }
        @include lib.css-variables('--color', color, $colors);
    `), ':root{--color-blue-300: #abc;--color-blue-500: #123}.--color-blue-300{--color-blue-300: #abc}.--color-blue-500{--color-blue-500: #123}');
});

test('utility classes preserve a surrounding selector scope', () => {
    assert.equal(compile(`.preview { @include lib.css-variables('--weight', font-weight, (500: 600)); }`),
        '.preview .--weight-500{--font-weight-500: 600}');
});

test('empty maps emit no CSS and invalid token arguments fail clearly', () => {
    assert.equal(compile(':root { @include lib.css-variables(color, ()); }'), '');
    assert.equal(compile("@include lib.css-variables('--color', color, ());"), '');
    assert.throws(() => compile(':root { @include lib.css-variables(color, red); }'), /with a token map/);
});
