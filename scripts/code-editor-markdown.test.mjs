import assert from 'node:assert/strict';
import test from 'node:test';
import './resolve.mjs';


const { EditorDocument } = await import('../src/components/code-editor/document.ts');
const { markdownCommand } = await import('../src/components/code-editor/markdown/editing.ts');
const { sanitize } = await import('../src/components/code-editor/markdown/html.ts');
const { clipInline, parseInline, safeUrl } = await import('../src/components/code-editor/markdown/inline.ts');
const { arrange, cache, MarkdownLayout, SLICE_LINES, unitStart, WINDOW_LIMIT } = await import(
    '../src/components/code-editor/markdown/layout.ts'
);
const {
    blockAt,
    blocksAt,
    contentEnd,
    markdownBackspace,
    markdownEnter,
    markdownReferences,
    parseMarkdown,
    reparse,
    toggleMarkdown,
    toggleTask
} = await import('../src/components/code-editor/markdown/model.ts');
const { foldable, foldAt, markdownFolds } = await import('../src/components/code-editor/markdown/structure.ts');


// A parsed DOM node, as the sanitizer reads one.
function element(localName, attributes = {}, ...children) {
    return {
        childNodes: children.map((child) => typeof child === 'string' ? { childNodes: [], nodeType: 3, textContent: child } : child),
        getAttribute: (name) => attributes[name] ?? null,
        localName,
        nodeType: 1,
        textContent: null
    };
}

// Plain data of a block, for comparing parses.
function shape(block) {
    return JSON.stringify(block);
}

// Applies one edit and brings 'blocks' up to it the way the view does, from the document's line deltas.
function edit(document, blocks, from, to, insert) {
    let length = document.value.length,
        revision = document.revision;

    document.replace(from, to, insert);

    let deltas = document.deltas(revision),
        end = -1,
        start = Number.MAX_SAFE_INTEGER;

    for (let { inserted, line, removed } of deltas) {
        if (end < 0) {
            end = line + inserted;
            start = line;
            continue;
        }

        if (end >= line + removed) {
            end += inserted - removed;
        }
        else if (end > line) {
            end = line + inserted;
        }

        end = Math.max(end, line + inserted);
        start = Math.min(start, line);
    }

    let count = document.lineCount;

    return reparse(
        blocks,
        document,
        document.lineStart(Math.min(start, count - 1)),
        end < count ? document.lineStart(end) : document.value.length,
        document.value.length - length
    );
}


test('source blocks cover exact text, frontmatter, heading, quote, list/task, fence and HTML', () => {
    let source = '---\r\ntitle: Demo\r\n---\r\n# Heading\r\n\r\n> quote\r\n> next\r\n- [x] task\r\n```ts\r\nconst x = 1;\r\n```\r\n<div>safe</div>',
        document = new EditorDocument(source),
        blocks = parseMarkdown(document);

    assert.equal(blocks.map((block) => source.slice(block.from, block.to)).join(''), source);
    assert.deepEqual(blocks.map((block) => block.kind), ['frontmatter', 'heading', 'blank', 'quote', 'list', 'fence', 'html']);

    let task = blocks.find((block) => block.task).task;

    toggleTask(document, task);
    assert.ok(document.value.includes('- [ ] task'));
    document.undo();
    assert.equal(document.value, source);

    let heading = blocks[1];

    assert.deepEqual(blocksAt(blocks, { end: heading.contentFrom, start: heading.contentFrom }), { first: 1, last: 2 });
    assert.equal(blockAt(blocks, heading.contentFrom), 1);
    assert.equal(source.slice(heading.from, contentEnd(source, heading)), '# Heading');
    assert.equal(contentEnd(source, blocks[blocks.length - 1]), source.length);
});

test('nested list indentation, nested quote depth and indented code have exact source ranges', () => {
    let source =
            '- parent\r\n  - child\r\n\t- grandchild\r\n- sibling\r\n\r\n> outer\r\n> > nested\r\n> > ## heading\r\n> back\r\n\r\n    **literal**\r\n\tconst x = 1;\r\n\r\nparagraph',
        document = new EditorDocument(source),
        blocks = parseMarkdown(document);

    assert.equal(blocks.map((block) => source.slice(block.from, block.to)).join(''), source);
    assert.deepEqual(blocks.filter((block) => block.kind === 'list').map((block) => block.indent), [0, 2, 4, 0]);
    assert.deepEqual(
        blocks.filter((block) => block.quoteDepth).map((block) => [block.kind, block.quoteDepth]),
        [['quote', 1], ['quote', 2], ['heading', 2], ['quote', 1]]
    );

    let code = blocks.find((block) => block.kind === 'code');

    assert.deepEqual(code.lines.map((row) => source.slice(row.contentFrom, row.contentTo)), ['**literal**', 'const x = 1;']);
    document.select({ start: code.lines[0].contentTo });
    assert.equal(markdownEnter(document), false);
});

test('incremental reparse matches a full parse after every edit and keeps untouched blocks', () => {
    let pieces = ['\n', '\r\n', '# ', '- ', '1. ', '> ', '```', '    ', 'text', '**b**', '---', '\n\n', '[x]: /u', '- [ ] '],
        seed = 7,
        random = () => (seed = (seed * 16807) % 2147483647) / 2147483647,
        source = '# Title\n\nPara one\nline two\n\n- a\n- b\n  more\n\n> q\n> r\n\n```js\nx\n```\n\n    code\n\ntail',
        document = new EditorDocument(source),
        blocks = parseMarkdown(document);

    for (let i = 0; i < 400; i++) {
        let length = document.value.length,
            from = Math.floor(random() * (length + 1)),
            to = Math.min(length, from + Math.floor(random() * 6)),
            insert = random() < 0.3 ? '' : pieces[Math.floor(random() * pieces.length)];

        edit(document, blocks, from, to, insert);

        assert.deepEqual(blocks.map(shape), parseMarkdown(document).map(shape), `edit ${i}: ${JSON.stringify(document.value)}`);
    }

    // Typing inside one block replaces that block alone: its neighbours keep their objects.
    let typed = new EditorDocument('# A\n\nfirst paragraph\n\nsecond paragraph\n\n- item\n'),
        list = parseMarkdown(typed),
        before = [...list],
        at = typed.value.indexOf('second') + 3,
        splice = edit(typed, list, at, at, 'x');

    assert.equal(splice.dropped.length, 1);
    assert.equal(splice.inserted, 1);
    assert.equal(list[splice.start].kind, 'paragraph');

    for (let i = 0; i < list.length; i++) {
        if (i !== splice.start) {
            assert.equal(list[i], before[i]);
        }
    }

    assert.equal(list[list.length - 2].from, typed.value.indexOf('- item'));
});

test('an edit that opens a fence or closes frontmatter reparses everything it reaches', () => {
    let document = new EditorDocument('a\n\nb\n\n# c\n'),
        blocks = parseMarkdown(document);

    edit(document, blocks, 3, 3, '```\n');
    assert.deepEqual(blocks.map(shape), parseMarkdown(document).map(shape));
    assert.equal(blocks[blocks.length - 1].kind, 'fence');

    let front = new EditorDocument('---\ntitle: x\n\nbody\n'),
        list = parseMarkdown(front);

    assert.notEqual(list[0].kind, 'frontmatter');
    edit(front, list, front.value.length, front.value.length, '---\n');
    assert.equal(list[0].kind, 'frontmatter');
    assert.deepEqual(list.map(shape), parseMarkdown(front).map(shape));
});

test('multiple Markdown commands preserve exact EOL, all ranges and a single atomic undo', () => {
    let source = '- one\r\n\r\n> two',
        document = new EditorDocument(source);

    document.selectMany([{ start: 5 }, { start: source.length }]);
    assert.equal(markdownCommand(document, 'enter'), true);
    assert.equal(document.value, '- one\r\n- \r\n\r\n> two\r\n> ');
    assert.equal(document.selections.length, 2);
    document.undo();
    assert.equal(document.value, source);
    assert.equal(document.selections.length, 2);

    document.selectMany([{ end: 5, start: 2 }, { end: source.length, start: source.indexOf('two') }]);
    assert.equal(markdownCommand(document, 'bold'), true);
    assert.equal(document.value, '- **one**\r\n\r\n> **two**');
    document.undo();
    assert.equal(document.value, source);

    let unwrap = new EditorDocument(source);

    unwrap.selectMany([{ start: 2 }, { start: unwrap.value.indexOf('two') }]);
    assert.equal(markdownCommand(unwrap, 'backspace'), true);
    assert.equal(unwrap.value, 'one\r\n\r\ntwo');
    unwrap.undo();
    assert.equal(unwrap.value, source);
});

test('Enter leaves literal blocks alone, from the caller\'s parse or its own', () => {
    let document = new EditorDocument('```\n- item\n```');

    document.select({ start: 10 });
    assert.equal(markdownEnter(document), false);
    assert.equal(markdownEnter(document, 'fence'), false);
    assert.equal(markdownCommand(document, 'enter', () => 'fence'), true);
    assert.equal(document.value, '```\n- item\n\n```');

    let list = new EditorDocument('- item');

    list.select({ start: 6 });
    assert.equal(markdownCommand(list, 'enter', () => 'list'), true);
    assert.equal(list.value, '- item\n- ');
});

test('list, task and quote continuation, empty exit and Backspace unwrap share undo', () => {
    for (let [source, expected] of [
        ['- item', '- item\n- '],
        ['3. item', '3. item\n4. '],
        ['> quote', '> quote\n> '],
        ['> - [x] task', '> - [x] task\n> - [ ] ']
    ]) {
        let document = new EditorDocument(source);

        document.select({ start: source.length });
        assert.equal(markdownEnter(document), true);
        assert.equal(document.value, expected);
        document.undo();
        assert.equal(document.value, source);
    }

    let empty = new EditorDocument('- ');

    empty.select({ start: 2 });
    markdownEnter(empty);
    assert.equal(empty.value, '');
    empty.undo();
    markdownBackspace(empty);
    assert.equal(empty.value, '');

    let ordered = new EditorDocument('1. one\r\n2. two\r\n3. three');

    ordered.select({ start: 6 });
    markdownEnter(ordered);
    assert.equal(ordered.value, '1. one\r\n2. \r\n3. two\r\n4. three');
    ordered.undo();
    assert.equal(ordered.value, '1. one\r\n2. two\r\n3. three');

    let nested = new EditorDocument('> > ');

    nested.select({ start: 4 });
    markdownBackspace(nested);
    assert.equal(nested.value, '> ');
});

test('formatting toggles the current word and selection with direction and exact history', () => {
    let document = new EditorDocument('hello world\r\n');

    document.select({ start: 2 });
    toggleMarkdown(document, '**');
    assert.equal(document.value, '**hello** world\r\n');
    assert.equal(document.value.slice(document.selection.start, document.selection.end), 'hello');
    toggleMarkdown(document, '**');
    assert.equal(document.value, 'hello world\r\n');
    document.undo();
    assert.equal(document.value, '**hello** world\r\n');
    document.select({ direction: 'backward', end: 9, start: 0 });
    toggleMarkdown(document, '**');
    assert.equal(document.value, 'hello world\r\n');
    assert.equal(document.selection.direction, 'backward');

    let empty = new EditorDocument();

    toggleMarkdown(empty, '*');
    assert.equal(empty.value, '**');
    assert.equal(empty.selection.start, 1);
});

test('inline nesting, escaped markers and safe link destinations', () => {
    let tokens = parseInline('**strong *em*** ~~old~~ `code` [link](https://example.com) \\*literal');

    assert.ok(tokens.some((token) => token.kind === 'strong'));
    assert.ok(tokens.some((token) => token.kind === 'strike'));
    assert.ok(tokens.some((token) => token.kind === 'code'));
    assert.ok(tokens.some((token) => token.kind === 'link'));
    assert.equal(tokens[0].children[1].kind, 'em');
    assert.equal(tokens[0].children[1].text, 'em');
    assert.equal(safeUrl('javascript:alert(1)'), undefined);
    assert.equal(safeUrl('JaVaScRiPt:alert(1)'), undefined);
    assert.equal(safeUrl('data:text/html,hi'), undefined);
    assert.equal(safeUrl('vbscript:x'), undefined);
    assert.equal(safeUrl('java\nscript:bad'), undefined);
    assert.equal(safeUrl('java%0ascript:bad'), undefined);
    assert.equal(safeUrl('//evil'), undefined);
    assert.equal(safeUrl('\\\\evil'), undefined);
    assert.equal(safeUrl('/relative'), '/relative');
    assert.equal(safeUrl('mailto:a@b.c'), 'mailto:a@b.c');
    assert.equal(safeUrl('mailto:a@b.c', true), undefined);
    assert.equal(parseInline('[bad](javascript:alert(1))')[0].href, undefined);
});

test('inline offsets start at the origin given and clip to slices', () => {
    let tokens = parseInline('a **bold** b', 10);

    assert.equal(tokens[1].from, 14);
    assert.equal(tokens[1].children[0].from, 14);

    let clipped = clipInline(tokens, 15, 17);

    assert.equal(clipped.length, 1);
    assert.equal(clipped[0].kind, 'strong');
    assert.equal(clipped[0].text, 'ol');
});

test('balanced link destinations, escaped closers, delimiter runs and reference link presentation', () => {
    let link = parseInline('[label](https://example.test/a(b(c))/end)')[0];

    assert.equal(link.href, 'https://example.test/a(b(c))/end');
    assert.equal(link.text, 'label');
    assert.equal(parseInline('[label](https://example.test/a(b) "title ) here")')[0].href, 'https://example.test/a(b)');
    assert.equal(parseInline('[`a]b`](<https://example.test/a(b>)')[0].href, 'https://example.test/a(b');

    let escaped = parseInline('[a\\]b](https://example.test/a\\))')[0];

    assert.equal(escaped.href, 'https://example.test/a)');
    assert.equal(escaped.children.map((token) => token.text).join(''), 'a]b');

    let rendered = (tokens) => tokens.map((token) => token.children ? rendered(token.children) : token.text).join(''),
        strong = parseInline('**first\\** still**'),
        nested = parseInline('*one **two** three*'),
        triple = parseInline('***both***');

    assert.equal(strong[0].kind, 'strong');
    assert.equal(rendered(strong), 'first** still');
    assert.equal(nested[0].kind, 'em');
    assert.equal(nested[0].children[1].kind, 'strong');
    assert.equal(rendered(nested), 'one two three');
    assert.equal(triple[0].kind, 'em');
    assert.equal(triple[0].children[0].kind, 'strong');
    assert.equal(parseInline('foo_bar_baz')[0].kind, 'text');
    assert.equal(parseInline('`one ``inside`` more`')[0].text, 'one ``inside`` more');

    let references = markdownReferences('[Ref]: https://example.test/a(b)\r\n');

    for (let source of ['[label][Ref]', '[Ref][]', '[Ref]']) {
        let token = parseInline(source, 0, 0, references)[0];

        assert.equal(token.kind, 'link');
        assert.equal(token.text, source);
        assert.equal(token.href, 'https://example.test/a(b)');
        assert.equal(token.reference, true);
    }

    let document = new EditorDocument('text\n\n[Ref]: /a\n\nmore');

    assert.equal(parseMarkdown(document).filter((block) => block.definitions).length, 1);
});

test('the HTML sanitizer keeps an allowlist and drops scripts, handlers and unsafe URLs', () => {
    let tree = sanitize(element('body', {},
        element('p', { onclick: 'alert(1)', style: 'x', title: 'T' }, 'Safe ', element('b', {}, 'bold')),
        element('script', {}, 'alert(1)'),
        element('style', {}, 'body{}'),
        element('iframe', { src: 'https://evil' }),
        element('svg', {}, element('script', {}, 'x')),
        element('a', { href: 'javascript:alert(1)', onmouseover: 'x' }, 'bad'),
        element('a', { href: 'https://example.com', target: '_top' }, 'good'),
        element('img', { onerror: 'alert(1)', src: 'javascript:alert(1)', alt: 'alt text' }),
        element('img', { alt: 'pic', src: 'https://example.com/a.png' }),
        element('img', { alt: 'mail', src: 'mailto:a@b.c' }),
        element('custom-tag', {}, element('i', {}, 'kept')),
        element('form', {}, element('input', { value: 'x' }), 'gone'),
        { childNodes: [], nodeType: 8, textContent: 'comment' }
    ));

    assert.deepEqual(tree, [
        { attributes: { title: 'T' }, children: ['Safe ', { attributes: {}, children: ['bold'], tag: 'strong' }], tag: 'p' },
        { attributes: {}, children: ['bad'], tag: 'a' },
        { attributes: { href: 'https://example.com' }, children: ['good'], tag: 'a' },
        'alt text',
        { attributes: { alt: 'pic', src: 'https://example.com/a.png' }, children: [], tag: 'img' },
        'mail',
        { attributes: {}, children: ['kept'], tag: 'em' }
    ]);

    let deep = element('div');

    for (let i = 0, node = deep; i < 60; i++) {
        let child = element('div');

        node.childNodes = [child];
        node = child;
    }

    let depth = 0;

    for (let node = sanitize(element('body', {}, deep))[0]; node && typeof node !== 'string'; node = node.children[0]) {
        depth++;
    }

    assert.ok(depth <= 42);
});

test('folds follow logical blocks; markers only look at neighbours', () => {
    let source = '# A\r\n\r\ntext\r\n\r\n## B\r\n\r\n> a\r\n> b\r\n\r\n```js\r\nx\r\ny\r\n```\r\n\r\n# C\r\nend',
        document = new EditorDocument(source),
        blocks = parseMarkdown(document),
        ranges = markdownFolds(document, blocks),
        heading = ranges.find((range) => range.line === 1);

    assert.equal(source.slice(heading.from, heading.to).endsWith('\r\n\r\n'), true);
    assert.equal(source.slice(heading.to).startsWith('# C'), true);
    assert.ok(ranges.some((range) => source.slice(range.open).startsWith('```')));
    assert.ok(ranges.some((range) => source.slice(range.open).startsWith('> a')));

    for (let i = 0; i < blocks.length; i++) {
        assert.equal(foldable(blocks, i, source), !!foldAt(document, blocks, i), `block ${i} ${blocks[i].kind}`);
    }

    let nested = new EditorDocument('- outer\n  - child\n    body\n- sibling'),
        list = parseMarkdown(nested),
        subtree = foldAt(nested, list, 0);

    assert.ok(subtree);
    assert.equal(nested.value.slice(subtree.to).startsWith('- sibling'), true);
    assert.equal(foldable(list, 0, nested.value), true);
    assert.equal(foldable(list, list.length - 1, nested.value), false);
});

test('units leave folded blocks out, stand the field in for the active blocks and keep identity', () => {
    let source = '# A\n\ntext\n\n## B\n\nmore\n\n# C\nend',
        document = new EditorDocument(source),
        blocks = parseMarkdown(document),
        store = cache(),
        fold = foldAt(document, blocks, 0),
        all = arrange(blocks, source, [], store, null, null),
        folded = arrange(blocks, source, [fold], store, null, null);

    assert.equal(all.length, blocks.length);
    assert.equal(folded[0].fold, fold);
    assert.ok(folded.every((unit) => unitStart(unit) < fold.from || unitStart(unit) >= fold.to));
    assert.equal(unitStart(folded[1]), source.indexOf('# C'));

    let field = { active: true, block: blocks[2] },
        active = arrange(blocks, source, [], store, { first: 2, last: 4, unit: field }, null);

    assert.equal(active.length, blocks.length - 1);
    assert.equal(active[2], field);
    assert.equal(arrange(blocks, source, [], store, null, null)[5], all[5]);

    let raw = arrange(blocks, source, [], store, null, (index) => index === 2);

    assert.equal(raw[2].raw, true);
    assert.notEqual(raw[2], all[2]);
});

test('variable-height lookup and measurement stay bounded for ten thousand blocks', () => {
    let document = new EditorDocument(Array.from({ length: 5000 }, (_, i) => `## row ${i}\n\n`).join('')),
        blocks = parseMarkdown(document),
        layout = new MarkdownLayout();

    layout.set(arrange(blocks, document.value, [], cache(), null, null), document.value);
    layout.configure({ charWidth: 8, fontSize: 13, lineHeight: 20, quoteIndent: 10, width: 600 });

    assert.ok(blocks.length >= 10000);

    let index = 7000,
        top = layout.top(index),
        unit = layout.units[3];

    assert.equal(layout.at(top), index);
    assert.equal(layout.indexOf(blocks[index].from), index);

    let window = layout.window(top, 320);

    assert.ok(window.start <= index && window.end > index);
    assert.ok(window.end - window.start <= WINDOW_LIMIT);

    let total = layout.total,
        height = layout.height(unit);

    assert.equal(layout.measure(unit, 200), true);
    assert.ok(Math.abs(layout.total - (total + 200 - height)) < 1e-6);
    assert.equal(layout.at(layout.top(index)), index);
    assert.equal(layout.measure(unit, 200), false);

    // A width change makes every measurement an estimate again.
    layout.configure({ charWidth: 8, fontSize: 13, lineHeight: 20, quoteIndent: 10, width: 400 });
    assert.notEqual(layout.height(unit), 200);
});

test('large logical blocks draw as bounded slices that cover the whole source', () => {
    let source = '```ts\r\n' + Array.from({ length: 5000 }, (_, i) => `const x${i} = ${i};\r\n`).join('') + '```',
        document = new EditorDocument(source),
        blocks = parseMarkdown(document),
        units = arrange(blocks, source, [], cache(), null, null);

    assert.equal(blocks.length, 1);
    assert.ok(units.length > 100);
    assert.ok(units.every((unit) => unit.rows.length <= SLICE_LINES));
    assert.equal(units[0].continuation, false);
    assert.equal(units[1].continuation, true);
    assert.equal(units[units.length - 1].continues, false);
    assert.deepEqual(blocksAt(blocks, { end: unitStart(units[90]), start: unitStart(units[90]) }), { first: 0, last: 1 });

    let line = new EditorDocument('```\n' + 'x'.repeat(20000) + '\n```'),
        lines = arrange(parseMarkdown(line), line.value, [], cache(), null, null);

    assert.equal(lines.length, 1);

    let paragraph = new EditorDocument('y'.repeat(20000)),
        pieces = arrange(parseMarkdown(paragraph), paragraph.value, [], cache(), null, null);

    assert.ok(pieces.length >= 3);
    assert.equal(pieces.map((unit) => unit.rows.map((row) => paragraph.value.slice(row.contentFrom, row.contentTo)).join('')).join(''), paragraph.value);
});
