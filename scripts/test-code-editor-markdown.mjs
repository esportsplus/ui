import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';
registerHooks({ resolve(specifier, context, next) {
    if (specifier.startsWith('./') && context.parentURL?.includes('/src/components/code-editor/') && !/\.[a-z]+$/i.test(specifier)) return next(specifier + '.ts', context);
    return next(specifier, context);
} });
const { EditorDocument } = await import('../src/components/code-editor/document.ts');
const { parseMarkdown, parseInline, markdownReferences, safeUrl, blocksAt, markdownEnter, markdownBackspace, toggleMarkdown, toggleTask } = await import('../src/components/code-editor/markdown-model.ts');
const { MarkdownLayout, viewportBlocks, MARKDOWN_SLICE_LINES, MARKDOWN_WINDOW_LIMIT } = await import('../src/components/code-editor/markdown-layout.ts');
const { markdownFolds, foldedMarkdown } = await import('../src/components/code-editor/markdown-structure.ts');
const { markdownCommand } = await import('../src/components/code-editor/markdown-editing.ts');

test('Markdown structural folds use logical source boundaries, retain section headers and multiline widget headers', () => {
    let source = '# A\r\n\r\ntext\r\n\r\n## B\r\n\r\n> a\r\n> b\r\n\r\n```js\r\nx\r\ny\r\n```\r\n\r\n# C\r\nend', doc = new EditorDocument(source), blocks = parseMarkdown(doc), ranges = markdownFolds(doc, blocks);
    let heading = ranges.find(range => range.line === 1); assert.equal(source.slice(heading.from, heading.to).endsWith('\r\n\r\n'), true); assert.equal(source.slice(heading.to).startsWith('# C'), true);
    assert.ok(ranges.some(range => source.slice(range.open).startsWith('```'))); assert.ok(ranges.some(range => source.slice(range.open).startsWith('> a')));
    let visible = foldedMarkdown(doc, blocks, [heading]); assert.deepEqual(visible.filter(block => block.kind === 'heading').map(block => source.slice(block.contentFrom, block.contentTo)), ['A', 'C']); assert.equal(doc.value, source);
    let fence = ranges.find(range => source.slice(range.open).startsWith('```')), folded = foldedMarkdown(doc, blocks, [fence]).find(block => block.from === fence.open); assert.equal(source.slice(folded.contentFrom, folded.contentTo), '```js'); assert.equal(folded.to, fence.from);
    let nested = new EditorDocument('- outer\n  - child\n    body\n- sibling'), nestedBlocks = parseMarkdown(nested), subtree = markdownFolds(nested, nestedBlocks).find(range => range.line === 1); assert.ok(subtree); assert.equal(nested.value.slice(subtree.to).startsWith('- sibling'), true); assert.equal(foldedMarkdown(nested, nestedBlocks, [subtree]).filter(block => block.kind === 'list').length, 2);
});

test('multiple Markdown commands preserve exact EOL, all ranges and a single atomic undo', () => {
    let source = '- one\r\n\r\n> two', doc = new EditorDocument(source); doc.selectMany([{ start: 5 }, { start: source.length }]);
    assert.equal(markdownCommand(doc, 'enter'), true); assert.equal(doc.value, '- one\r\n- \r\n\r\n> two\r\n> '); assert.equal(doc.selections.length, 2); doc.undo(); assert.equal(doc.value, source); assert.equal(doc.selections.length, 2);
    doc.selectMany([{ start: 2, end: 5 }, { start: source.indexOf('two'), end: source.length }]); assert.equal(markdownCommand(doc, 'bold'), true); assert.equal(doc.value, '- **one**\r\n\r\n> **two**'); doc.undo(); assert.equal(doc.value, source);
    let unwrap = new EditorDocument('- one\r\n\r\n> two'); unwrap.selectMany([{ start: 2 }, { start: unwrap.value.indexOf('two') }]); assert.equal(markdownCommand(unwrap, 'backspace'), true); assert.equal(unwrap.value, 'one\r\n\r\ntwo'); unwrap.undo(); assert.equal(unwrap.value, source);
});

test('source blocks cover exact text, frontmatter, heading, quote, list/task, fence and HTML', () => {
    let source = '---\r\ntitle: Demo\r\n---\r\n# Heading\r\n\r\n> quote\r\n> next\r\n- [x] task\r\n```ts\r\nconst x = 1;\r\n```\r\n<div>safe</div>', doc = new EditorDocument(source), blocks = parseMarkdown(doc);
    assert.equal(blocks.map((b) => source.slice(b.from, b.to)).join(''), source);
    assert.deepEqual(blocks.map((b) => b.kind), ['frontmatter', 'heading', 'blank', 'quote', 'list', 'fence', 'html']);
    let task = blocks.find((b) => b.task).task; toggleTask(doc, task); assert.ok(doc.value.includes('- [ ] task')); doc.undo(); assert.equal(doc.value, source);
    let heading = blocks[1]; assert.deepEqual(blocksAt(blocks, { start: heading.contentFrom, end: heading.contentFrom }), { from: heading.from, to: heading.to });
});
test('inline nesting, escaped markers and safe link destinations', () => {
    let tokens = parseInline('**strong *em*** ~~old~~ `code` [link](https://example.com) \\*literal');
    assert.ok(tokens.some((t) => t.kind === 'strong')); assert.ok(tokens.some((t) => t.kind === 'strike')); assert.ok(tokens.some((t) => t.kind === 'code')); assert.ok(tokens.some((t) => t.kind === 'link'));
    assert.equal(tokens[0].children[1].kind, 'em'); assert.equal(tokens[0].children[1].text, 'em');
    assert.equal(safeUrl('javascript:alert(1)'), undefined); assert.equal(safeUrl('data:text/html,hi'), undefined); assert.equal(safeUrl('java\nscript:bad'), undefined); assert.equal(safeUrl('//evil'), undefined); assert.equal(safeUrl('/relative'), '/relative');
    assert.equal(parseInline('[bad](javascript:alert(1))')[0].href, undefined);
});
test('list, task and quote continuation, empty exit and Backspace unwrap share undo', () => {
    for (let [source, expected] of [['- item', '- item\n- '], ['3. item', '3. item\n4. '], ['> quote', '> quote\n> '], ['> - [x] task', '> - [x] task\n> - [ ] ']]) {
        let doc = new EditorDocument(source); doc.select({ start: source.length }); assert.equal(markdownEnter(doc), true); assert.equal(doc.value, expected); doc.undo(); assert.equal(doc.value, source);
    }
    let doc = new EditorDocument('- '); doc.select({ start: 2 }); markdownEnter(doc); assert.equal(doc.value, ''); doc.undo(); markdownBackspace(doc); assert.equal(doc.value, '');
    let fenced = new EditorDocument('```\n- item\n```'); fenced.select({ start: 10 }); assert.equal(markdownEnter(fenced), false);
    let ordered = new EditorDocument('1. one\r\n2. two\r\n3. three'); ordered.select({ start: 6 }); markdownEnter(ordered);
    assert.equal(ordered.value, '1. one\r\n2. \r\n3. two\r\n4. three'); ordered.undo(); assert.equal(ordered.value, '1. one\r\n2. two\r\n3. three');
    let nested = new EditorDocument('> > '); nested.select({ start: 4 }); markdownBackspace(nested); assert.equal(nested.value, '> ');
});
test('formatting toggles the current word and selection with direction and exact history', () => {
    let doc = new EditorDocument('hello world\r\n'); doc.select({ start: 2 }); toggleMarkdown(doc, '**');
    assert.equal(doc.value, '**hello** world\r\n'); assert.equal(doc.value.slice(doc.selection.start, doc.selection.end), 'hello');
    toggleMarkdown(doc, '**'); assert.equal(doc.value, 'hello world\r\n'); doc.undo(); assert.equal(doc.value, '**hello** world\r\n');
    doc.select({ start: 0, end: 9, direction: 'backward' }); toggleMarkdown(doc, '**'); assert.equal(doc.value, 'hello world\r\n'); assert.equal(doc.selection.direction, 'backward');
    let empty = new EditorDocument(); toggleMarkdown(empty, '*'); assert.equal(empty.value, '**'); assert.equal(empty.selection.start, 1);
});
test('nested list indentation, nested quote depth and indented code have exact source ranges', () => {
    let source = '- parent\r\n  - child\r\n\t- grandchild\r\n- sibling\r\n\r\n> outer\r\n> > nested\r\n> > ## heading\r\n> back\r\n\r\n    **literal**\r\n\tconst x = 1;\r\n\r\nparagraph', doc = new EditorDocument(source), blocks = parseMarkdown(doc);
    assert.equal(blocks.map((b) => source.slice(b.from, b.to)).join(''), source);
    assert.deepEqual(blocks.filter((b) => b.kind === 'list').map((b) => b.indent), [0, 2, 4, 0]);
    assert.deepEqual(blocks.filter((b) => b.quoteDepth).map((b) => [b.kind, b.quoteDepth]), [['quote', 1], ['quote', 2], ['heading', 2], ['quote', 1]]);
    let code = blocks.find((b) => b.kind === 'code'); assert.deepEqual(code.lines.map((row) => source.slice(row.contentFrom, row.contentTo)), ['**literal**', 'const x = 1;']);
    doc.select({ start: code.lines[0].contentTo }); assert.equal(markdownEnter(doc), false);
});
test('balanced link destinations, escaped closers, delimiter runs and reference link presentation', () => {
    let link = parseInline('[label](https://example.test/a(b(c))/end)')[0]; assert.equal(link.href, 'https://example.test/a(b(c))/end'); assert.equal(link.text, 'label');
    assert.equal(parseInline('[label](https://example.test/a(b) "title ) here")')[0].href, 'https://example.test/a(b)');
    assert.equal(parseInline('[`a]b`](<https://example.test/a(b>)')[0].href, 'https://example.test/a(b');
    let escaped = parseInline('[a\\]b](https://example.test/a\\))')[0]; assert.equal(escaped.href, 'https://example.test/a)'); assert.equal(escaped.children.map((t) => t.text).join(''), 'a]b');
    const rendered = (tokens) => tokens.map((t) => t.children ? rendered(t.children) : t.text).join('');
    let strong = parseInline('**first\\** still**'); assert.equal(strong[0].kind, 'strong'); assert.equal(rendered(strong), 'first** still');
    let nested = parseInline('*one **two** three*'); assert.equal(nested[0].kind, 'em'); assert.equal(nested[0].children[1].kind, 'strong'); assert.equal(rendered(nested), 'one two three');
    let triple = parseInline('***both***'); assert.equal(triple[0].kind, 'em'); assert.equal(triple[0].children[0].kind, 'strong');
    assert.equal(parseInline('foo_bar_baz')[0].kind, 'text'); assert.equal(parseInline('`one ``inside`` more`')[0].text, 'one ``inside`` more');
    let refs = markdownReferences('[Ref]: https://example.test/a(b)\r\n');
    for (let source of ['[label][Ref]', '[Ref][]', '[Ref]']) { let token = parseInline(source, 0, 0, refs)[0]; assert.equal(token.kind, 'link'); assert.equal(token.text, source); assert.equal(token.href, 'https://example.test/a(b)'); assert.equal(token.reference, true); }
});
test('variable-height viewport lookup and measurement stay bounded for ten thousand blocks', () => {
    let doc = new EditorDocument(Array.from({ length: 5000 }, (_, i) => `## row ${i}\n\n`).join('')), blocks = parseMarkdown(doc), layout = new MarkdownLayout(blocks, doc.value, 600);
    assert.ok(blocks.length >= 10000);
    let index = 7000, top = layout.prefix(index); assert.equal(layout.at(top), index); assert.equal(layout.index(blocks[index].from), index);
    let window = layout.window(top, 320); assert.ok(window.start <= index && window.end > index); assert.ok(window.end - window.start <= MARKDOWN_WINDOW_LIMIT);
    let old = layout.total, height = layout.heights[3]; assert.equal(layout.measure(3, 200), true); assert.equal(layout.total, old + 200 - height); assert.equal(layout.at(layout.prefix(index)), index); assert.equal(layout.measure(3, 200), false);
});
test('large logical code blocks use bounded source slices without losing the whole edit range', () => {
    let source = '```ts\r\n' + Array.from({ length: 5000 }, (_, i) => `const x${i} = ${i};\r\n`).join('') + '```', doc = new EditorDocument(source), blocks = parseMarkdown(doc), slices = viewportBlocks(blocks, source);
    assert.equal(blocks.length, 1); assert.ok(slices.length > 100); assert.ok(slices.every((slice) => slice.lines.length <= MARKDOWN_SLICE_LINES));
    assert.equal(slices.map((slice) => source.slice(slice.from, slice.to)).join(''), source);
    assert.deepEqual(blocksAt(blocks, { start: slices[90].contentFrom, end: slices[90].contentFrom }), { from: 0, to: source.length });
    let oneLine = new EditorDocument('```\n' + 'x'.repeat(20000) + '\n```'), lineSlices = viewportBlocks(parseMarkdown(oneLine), oneLine.value);
    assert.equal(lineSlices.length, 1); assert.equal(lineSlices[0].lines[0].contentTo - lineSlices[0].lines[0].contentFrom, 20000);
});
