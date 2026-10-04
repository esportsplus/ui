import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tokenize } from '../src/components/code/tokens.ts';


test('highlighting preserves source text, whitespace, and literal HTML', () => {
    const source = "import { html } from 'docs/app';\nimport './styles.scss';\n\nexport const example = () => {\n\t// Keep <script> as source\n\treturn html`<button title=\"false\">Save</button>`;\n};\n";
    const tokens = tokenize(source);

    assert.equal(tokens.map((token) => token.text).join(''), source);
    assert.ok(tokens.some((token) => token.kind === 'keyword' && token.text === 'import'));
    assert.ok(tokens.some((token) => token.kind === 'comment' && token.text === '// Keep <script> as source'));
    assert.ok(tokens.some((token) => token.kind === 'string' && token.text === '`<button title="false">Save</button>`'));
});

test('strings and comments contain escaped delimiters without highlighting their contents as keywords', () => {
    const source = 'const label = "say \\"return\\""; /* false 42 */\nrun(true, 160);';
    const tokens = tokenize(source);

    assert.equal(tokens.map((token) => token.text).join(''), source);
    assert.ok(tokens.some((token) => token.kind === 'string' && token.text.includes('return')));
    assert.ok(tokens.some((token) => token.kind === 'comment' && token.text === '/* false 42 */'));
    assert.ok(tokens.some((token) => token.kind === 'function' && token.text === 'run'));
    assert.ok(tokens.some((token) => token.kind === 'value' && token.text === 'true'));
    assert.ok(tokens.some((token) => token.kind === 'value' && token.text === '160'));
    assert.deepEqual(tokenize(''), []);
});
