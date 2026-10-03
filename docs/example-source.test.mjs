import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { ts } from '@esportsplus/typescript';
import { languageService } from '@esportsplus/typescript/compiler';
import { snippet } from './example-source.mjs';
import { groupVariants } from './src/examples/groups.ts';


after(() => languageService.dispose());

function extract(source) {
    let context = languageService.scratch(`${process.cwd()}/docs/src/examples/source-fixture.ts`, source),
        render;

    function walk(node) {
        if (ts.isObjectLiteralExpression(node)) {
            render ??= node.properties.find((property) => property.name?.getText() === 'render')?.initializer;
        }

        node.forEachChild(walk);
    }

    walk(context.sourceFile);
    assert.ok(render);
    return snippet(context, render);
}

test('includes the selected renderer and its transitive helpers, omitting unrelated examples', () => {
    let result = extract(`
        import { accordion } from '@esportsplus/ui';
        import { reactive } from '@esportsplus/reactivity';
        import './example.scss';
        const limit = 160;
        const unrelated = 'Other preview';
        function state() { return reactive({ active: false }); }
        function more() { return accordion({ state: state(), style: '--max-height: ' + limit + 'px;' }); }
        const variant = { title: 'max height', render: () => more() };
    `);

    assert.match(result.header, /import \{ accordion \}/);
    assert.match(result.header, /import \{ reactive \}/);
    assert.match(result.header, /example\.scss/);
    assert.equal(result.header, "import { accordion } from '@esportsplus/ui';\nimport { reactive } from '@esportsplus/reactivity';\nimport './example.scss';");
    assert.match(result.helpers, /const limit = 160/);
    assert.match(result.helpers, /function state/);
    assert.match(result.helpers, /function more/);
    assert.doesNotMatch(result.helpers, /unrelated|Other preview|const variant/);
    assert.equal(result.example, 'export const example = () => more();');
    assert.deepEqual(result.captures, []);
});

test('captures selected values from generated variants without capturing their local state', () => {
    let result = extract(`
        import { reactive } from '@esportsplus/reactivity';
        function variants(kind: string) {
            return ['halo', 'underline'].map((mode) => ({
                title: mode,
                render: () => {
                    const state = reactive({ active: false });
                    return { kind, mode, state };
                }
            }));
        }
    `);

    assert.deepEqual(result.captures.sort(), ['kind', 'mode']);
    assert.doesNotMatch(result.helpers, /function variants/);
    assert.match(result.example, /reactive\(\{ active: false \}\)/);
});

test('resolves shorthand dependencies and a renderer passed by reference', () => {
    let result = extract(`
        const words = ['one', 'two'];
        const unused = ['three'];
        function demo() { return { words }; }
        const variant = { title: 'demo', render: demo };
    `);

    assert.match(result.helpers, /const words/);
    assert.match(result.helpers, /function demo/);
    assert.doesNotMatch(result.helpers, /unused/);
    assert.equal(result.example, 'export const example = demo;');
    assert.deepEqual(result.captures, []);
});

test('keeps shadowed locals separate from module data', () => {
    let result = extract(`
        const state = 'Unrelated';
        const variant = {
            render: () => { const state = 'Selected'; return state; },
            title: 'local'
        };
    `);

    assert.equal(result.helpers, '');
    assert.doesNotMatch(result.example, /Unrelated/);
    assert.deepEqual(result.captures, []);
});

test('grouped options retain the source provider of each original variant', async () => {
    let variants = ['toggle', 'show more', 'max height', 'fits'].map((title) => ({
            title,
            render: () => title,
            source: async () => `TypeScript for ${title}`
        })),
        grouped = groupVariants('accordion', variants);

    assert.equal(await grouped[0].source(), 'TypeScript for toggle');
    assert.equal(await grouped[1].source(), 'TypeScript for show more');
    assert.equal(await grouped[1].options[1].source(), 'TypeScript for max height');
    assert.equal(await grouped[1].options[2].source(), 'TypeScript for fits');
});
