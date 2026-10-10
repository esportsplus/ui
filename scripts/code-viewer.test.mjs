import assert from 'node:assert/strict';
import test from 'node:test';
import './resolve.mjs';


const { hidden, outline } = await import('../src/components/editor/viewer/model.ts');


const SOURCE = [
    'export function apply(element) {',
    '    for (let key of keys) {',
    "        element.style.setProperty(key, '<b>');",
    '    }',
    '}',
    ''
].join('\n');


test('outline highlights each line and escapes markup', () => {
    let lines = outline(SOURCE, 'typescript');

    assert.equal(lines.length, 6);
    assert.match(lines[0].html, /^<span class="code-viewer-token--keyword">export<\/span>/);
    assert.match(lines[2].html, /&lt;b&gt;/);
    assert.doesNotMatch(lines[2].html, /<b>/);
    assert.equal(lines[5].html, '');
});

test('outline leaves plain text unhighlighted', () => {
    let lines = outline('pnpm add <pkg>', 'plain');

    assert.deepEqual(lines, [{ end: -1, html: 'pnpm add &lt;pkg&gt;', text: 'pnpm add <pkg>', tokens: [] }]);
});

test('visible whitespace marks each space and tab, inside tokens too, keeping the characters', () => {
    let [line] = outline("\tlet a = 'b c';", 'typescript', { whitespace: true });

    assert.match(line.html, /^<span class="code-viewer-tab">\t<\/span>/);
    assert.match(line.html, /'b<span class="code-viewer-space"> <\/span>c'/);
    assert.equal(line.html.replace(/<[^>]+>/g, ''), "\tlet a = 'b c';");
});

test('bracket folds hide the body and keep the closing line', () => {
    let lines = outline(SOURCE, 'typescript');

    assert.equal(lines[0].end, 4);
    assert.equal(lines[1].end, 3);
    assert.equal(lines[2].end, -1);
    assert.deepEqual(hidden(lines, new Set([0])), [false, true, true, true, false, false]);
    assert.deepEqual(hidden(lines, new Set([1])), [false, false, true, false, false, false]);
});

test('a fold inside a folded one stays hidden when the outer one opens', () => {
    let lines = outline(SOURCE, 'typescript');

    assert.deepEqual(hidden(lines, new Set([0, 1])), [false, true, true, true, false, false]);
    assert.deepEqual(hidden(lines, new Set([1])), [false, false, true, false, false, false]);
});

test('without folding no line starts a fold', () => {
    assert.ok(outline(SOURCE, 'typescript', { fold: false }).every((line) => line.end === -1));
});

test('a markdown section at the end hides through the last line', () => {
    let lines = outline('# Title\n\ntext\nmore', 'markdown');

    assert.equal(lines[0].end, 4);
    assert.deepEqual(hidden(lines, new Set([0])), [false, true, true, true]);
});
