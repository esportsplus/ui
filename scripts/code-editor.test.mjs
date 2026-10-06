import assert from 'node:assert/strict';
import test from 'node:test';
import './resolve.mjs';


const {
    addNextOccurrence,
    bracket,
    closeIndent,
    deleteCharacter,
    deletePair,
    indent,
    insertText,
    lineCommand,
    newline,
    reindent,
    selectLine,
    toggleComment,
    transpose
} = await import('../src/components/editor/code/commands.ts');
const { EditorDocument, lineEnd, lineStarts } = await import('../src/components/editor/code/document.ts');
const {
    enclosingFold,
    foldAt,
    mapFolds,
    matchingPair,
    openBracket,
    outerFolds,
    pairAround,
    pairAt,
    structureOf,
    structures
} = await import('../src/components/editor/code/folding.ts');
const { EditorLayout } = await import('../src/components/editor/code/layout.ts');
const { NativeText } = await import('../src/components/editor/code/projection.ts');
const { nextMatch, replaceMatches, search, searchDocument } = await import('../src/components/editor/code/search.ts');
const { commentSyntax, highlightLine, languageFor, SyntaxCache, syntaxCache } = await import(
    '../src/components/editor/code/syntax.ts'
);


const PIECES = ['\r', '\n', '\r\n', 'a', 'bc', '', '\n\r', 'x\ry'];

const SAMPLES = {
    html: [
        '<!doctype html>',
        '<div class="a">',
        '  <p>x</p>',
        '  <ul>',
        '    <li>one</li>',
        '  </ul>',
        '</div>',
        '<!--',
        ' note',
        '-->',
        '<script>',
        'if (a) {',
        '  b();',
        '}',
        '</script>'
    ].join('\n'),
    javascript: [
        'const node = <Box title="literal }">',
        "  {items.map((item) => {",
        '    return <Inner>{`hello ${item.ok ? { value: 1 } : "}"}`}</Inner>;',
        '  })}',
        '</Box>;',
        'if (a < b && c > d) {',
        '  call(/[({[]/g);',
        '}'
    ].join('\n'),
    markdown: ['# Title', 'text', '## Sub', '```js', 'const x = {', '  a: 1', '};', '```', 'more', '# Next', 'end'].join(
        '\n'
    ),
    python: [
        'def f(a):',
        '    if a:',
        '        return (1,',
        '            2)',
        '',
        '    # note',
        '    x = """doc',
        '  text"""',
        '    return 2',
        'class B:',
        '    pass',
        'z = 3'
    ].join('\n'),
    scss: ['.card {', '  $pad: 1rem;', '  &:hover {', '    color: #62a8ff;', '  }', '}', '/* a', ' b */'].join('\n'),
    typescript: [
        'export function greet(person: { name: string }): string {',
        '  const map: Record<string, number> = {',
        '    a: 1, b: [2, 3]',
        '  };',
        '  /* note',
        '  */',
        '  return `hi ${person.name}`;',
        '}',
        'class A {',
        '  m() { return (1 + (2)); }',
        '}'
    ].join('\n')
};

const SNIPPETS = ['{', '}', '(', ')', '[', ']', '\n', '\r\n', '"', "'", '`', '/*', '*/', '//', '<div>', '</div>', 'x', ' ', '${', '#', '"""'];


function generator(seed) {
    return (max) => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;

        return seed % max;
    };
}

function kinds(text, language, state = '') {
    return highlightLine(text, language, state).tokens.map((token) => [text.slice(token.from, token.to), token.kind]);
}

function lexAll(value, language) {
    let lines = [],
        starts = lineStarts(value),
        state = '';

    for (let i = 0, n = starts.length; i < n; i++) {
        let result = highlightLine(value.slice(starts[i], lineEnd(value, starts, i)), language, state);

        lines.push({ end: result.state, start: state, tokens: result.tokens });
        state = result.state;
    }

    return lines;
}


test('exact arbitrary source, mixed EOL indexing, UTF-16 positions, and trailing empty lines', () => {
    let value = '\uFEFF<script>"\0😀\r\na\rb\n',
        doc = new EditorDocument(value);

    assert.equal(doc.value, value);
    assert.deepEqual(doc.starts, lineStarts(value));
    assert.equal(doc.state.lineCount, 4);
    assert.equal(doc.offset(2), value.indexOf('a\r'));
    assert.deepEqual(doc.position(doc.offset(3, 99)), { column: 2, line: 3 });
    assert.equal(doc.offset(999), value.length);
    assert.equal(doc.offset(-1, -1), 0);
    assert.equal(value.slice(doc.starts[1], lineEnd(value, doc.starts, 1)), 'a');
    assert.equal(doc.lineText(1), 'a');
    assert.equal(doc.lineAt(value.indexOf('b')), 2);
    assert.equal(doc.lineEnd(0), value.indexOf('\r'));
    assert.equal(doc.eol, '\r\n');
    doc.setValue('');
    doc.undo();
    assert.equal(doc.value, value);
    assert.equal(doc.state.dirty, false);
});

test('one transaction API: rejection reports the original edit index and leaves state, history and listeners alone', () => {
    let doc = new EditorDocument('abcdef'),
        events = [];

    doc.setValue('abcdef!');
    doc.undo();
    doc.select({ direction: 'backward', end: 4, start: 1 });
    doc.subscribe((state, change) => events.push([state, change]));

    let before = doc.state,
        starts = doc.starts;

    for (let edit of [
        { from: -1, insert: 'x', to: 0 },
        { from: 0.5, insert: 'x', to: 1 },
        { from: 0, insert: 'x', to: NaN },
        { from: Infinity, insert: 'x', to: Infinity },
        { from: 3, insert: 'x', to: 2 },
        { from: 0, insert: 'x', to: 7 }
    ]) {
        assert.deepEqual(
            doc.transact([{ from: 0, insert: 'valid', to: 0 }, edit], { group: 'insertText', selection: { start: 0 }, time: 100 }),
            { accepted: false, changed: false, index: 1, reason: 'invalid-range' }
        );
        assert.equal(doc.replace(edit.from, edit.to, edit.insert), false);
        assert.deepEqual(doc.state, before);
        assert.equal(doc.starts, starts);
        assert.equal(events.length, 0);
    }

    // Sorting must not change which input edit the diagnostic names.
    assert.deepEqual(
        doc.transact([
            { from: 3, insert: 'x', to: 5 },
            { from: 1, insert: 'y', to: 4 }
        ]),
        { accepted: false, changed: false, index: 0, reason: 'overlap' }
    );
    assert.deepEqual(doc.transact([{ from: 0, insert: 42, to: 1 }]), {
        accepted: false,
        changed: false,
        index: 0,
        reason: 'invalid-insert'
    });
    assert.deepEqual(doc.state, before);
    assert.equal(events.length, 0);
    assert.equal(doc.redo(), true);
    assert.equal(doc.value, 'abcdef!');
    assert.equal(doc.tryTransact, undefined);
});

test('transactions apply multi-edit offsets atomically and undo/redo restores backward selections', () => {
    let doc = new EditorDocument('abcdef');

    doc.select({ direction: 'backward', end: 5, start: 1 });

    let before = doc.state;

    assert.equal(
        doc.transact([
            { from: 0, insert: 'x', to: 3 },
            { from: 2, insert: '', to: 4 }
        ]).changed,
        false
    );
    assert.deepEqual(doc.state, before);
    assert.deepEqual(
        doc.transact([
            { from: 1, insert: 'LONG', to: 2 },
            { from: 4, insert: '!', to: 6 }
        ]),
        { accepted: true, changed: true }
    );
    assert.equal(doc.value, 'aLONGcd!');

    let after = doc.selection;

    assert.equal(doc.undo(), true);
    assert.equal(doc.value, 'abcdef');
    assert.deepEqual(doc.selection, before.selection);
    assert.equal(doc.redo(), true);
    assert.equal(doc.value, 'aLONGcd!');
    assert.deepEqual(doc.selection, after);
});

test('accepted no-ops differ from edits; a rejection keeps native typing grouped', () => {
    let doc = new EditorDocument('');

    assert.deepEqual(doc.transact([]), { accepted: true, changed: false });
    assert.deepEqual(doc.transact([{ from: 0, insert: 'a', to: 0 }], { group: 'insertText', time: 10 }), {
        accepted: true,
        changed: true
    });
    assert.deepEqual(doc.transact([{ from: 0, insert: 'a', to: 1 }]), { accepted: true, changed: false });
    assert.equal(doc.transact([{ from: -1, insert: '', to: 0 }]).accepted, false);
    assert.equal(doc.replace(1, 1, 'b', { group: 'insertText', time: 20 }), true);
    assert.equal(doc.undo(), true);
    assert.equal(doc.value, '', 'validation rejection did not split the adjacent typing group');
    assert.equal(doc.redo(), true);
    assert.equal(doc.value, 'ab');

    let events = [];

    doc.subscribe((_state, change) => events.push(change));
    assert.deepEqual(doc.transact([], { selection: { start: 0 } }), { accepted: true, changed: false });
    assert.equal(doc.selection.start, 0);
    assert.equal(events[0].textChanged, false);
    assert.equal(events[0].selectionChanged, true);
});

test('transaction validation does not catch or conceal subscriber bugs', () => {
    let doc = new EditorDocument(),
        failure = new Error('subscriber failure');

    doc.subscribe(() => {
        throw failure;
    });
    assert.throws(
        () => doc.transact([{ from: 0, insert: 'committed', to: 0 }]),
        (error) => error === failure
    );
    assert.equal(doc.value, 'committed');
    assert.equal(doc.state.canUndo, true);
});

test('native typing groups while commands, caret movement, newline, and save create boundaries', () => {
    let doc = new EditorDocument();

    doc.replace(0, 0, 'a', { group: 'insertText', time: 10 });
    doc.replace(1, 1, 'b', { group: 'insertText', time: 20 });
    doc.undo();
    assert.equal(doc.value, '');
    doc.redo();
    assert.equal(doc.value, 'ab');
    insertText(doc, '!');
    doc.undo();
    assert.equal(doc.value, 'ab');
    doc.replace(2, 2, 'c', { group: 'insertText', time: 30 });
    assert.equal(doc.state.canRedo, false);
    doc.select({ start: 0 });
    doc.select({ start: 3 });
    doc.replace(3, 3, 'd', { group: 'insertText', time: 40 });
    doc.undo();
    assert.equal(doc.value, 'abc');
    doc.markSaved();
    assert.equal(doc.state.dirty, false);
    insertText(doc, '\n');
    assert.equal(doc.state.dirty, true);
    doc.undo();
    assert.equal(doc.state.dirty, false);
});

test('history limits bound entry count and bytes, including redo memory and document resets', () => {
    let doc = new EditorDocument('', { bytes: 100, limit: 2 });

    for (let text of ['a', 'b', 'c']) {
        insertText(doc, text);
    }

    doc.undo();
    doc.undo();
    assert.equal(doc.value, 'a');
    assert.equal(doc.undo(), false);
    doc.reset('baseline');
    assert.equal(doc.state.canUndo, false);
    assert.equal(doc.state.canRedo, false);
    assert.equal(doc.state.dirty, false);
    doc.setValue('x'.repeat(100));
    assert.equal(doc.state.canUndo, false);

    let disabled = new EditorDocument('', { limit: 0 });

    insertText(disabled, 'a');
    assert.equal(disabled.undo(), false);
});

test('subscriptions distinguish text, selection, save, and clean up', () => {
    let doc = new EditorDocument('a'),
        events = [],
        stop = doc.subscribe((state, change) => events.push([state, change]));

    doc.select({ start: 1 });
    doc.select({ start: 1 });
    insertText(doc, 'b');
    doc.markSaved();
    assert.deepEqual(
        events.map(([, change]) => [change.source, change.textChanged, change.selectionChanged]),
        [
            ['selection', false, true],
            ['insert', true, true],
            ['saved', false, false]
        ]
    );
    stop();
    doc.undo();
    assert.equal(events.length, 3);
    assert.equal(Object.isFrozen(doc.state), true);
    assert.equal(Object.isFrozen(doc.selection), true);
});

test('incremental line index and deltas match a full rebuild through random CR/LF/CRLF edits and history', () => {
    let random = generator(7);

    for (let round = 0; round < 200; round++) {
        let doc = new EditorDocument(Array.from({ length: random(20) }, () => PIECES[random(PIECES.length)]).join(''));

        for (let step = 0; step < 40; step++) {
            let before = doc.value,
                cursor = 0,
                edits = [],
                old = doc.starts,
                revision = doc.revision;

            for (let k = 0, count = 1 + random(3); k < count && cursor <= doc.value.length; k++) {
                let from = cursor + random(doc.value.length - cursor + 1),
                    to = from + random(Math.min(4, doc.value.length - from) + 1);

                edits.push({ from, insert: Array.from({ length: random(3) }, () => PIECES[random(PIECES.length)]).join(''), to });
                cursor = to;
            }

            let action = random(10);

            if (action === 0) {
                doc.undo();
            }
            else if (action === 1) {
                doc.redo();
            }
            else {
                doc.transact(edits);
            }

            let expected = lineStarts(doc.value);

            assert.deepEqual(doc.starts, expected);

            if (doc.revision === revision) {
                assert.deepEqual(doc.deltas(revision), []);
                continue;
            }

            let lines = old.map((start, i) => before.slice(start, lineEnd(before, old, i)));

            for (let delta of doc.deltas(revision)) {
                lines.splice(delta.line, delta.removed, ...Array(delta.inserted).fill(null));
            }

            assert.equal(lines.length, expected.length);
            lines.forEach((line, i) => {
                if (line !== null) {
                    assert.equal(line, doc.lineText(i));
                }
            });
        }
    }
});

test('deltas are unavailable across a reset or beyond the log, and empty for the current revision', () => {
    let doc = new EditorDocument('a\nb');

    assert.deepEqual(doc.deltas(doc.revision), []);
    insertText(doc, 'x');
    assert.equal(doc.deltas(0).length, 1);
    doc.reset('other');
    assert.equal(doc.deltas(1), null);

    let revision = doc.revision;

    for (let i = 0; i < 100; i++) {
        insertText(doc, 'y');
    }

    assert.equal(doc.deltas(revision), null);
    assert.equal(doc.deltas(doc.revision - 10).length, 10);
    assert.equal(doc.deltas(doc.revision + 1), null);
});

test('indent/outdent selected lines exclude a selection ending at the next line start and retain direction', () => {
    let doc = new EditorDocument('a\r\n  b\r\nc');

    doc.select({ direction: 'backward', end: 8, start: 0 });
    indent(doc, '  ');
    assert.equal(doc.value, '  a\r\n    b\r\nc');
    assert.deepEqual(doc.selection, { direction: 'backward', end: 12, start: 2 });
    indent(doc, '  ', true);
    assert.equal(doc.value, 'a\r\n  b\r\nc');
    doc.undo();
    doc.undo();
    assert.deepEqual(doc.selection, { direction: 'backward', end: 8, start: 0 });
});

test('indent at caret and outdent handle tabs, partial spaces, and blank lines without changing EOLs', () => {
    let doc = new EditorDocument('\ta\r  b\n c');

    doc.select({ end: doc.value.length, start: 0 });
    indent(doc, '    ', true);
    assert.equal(doc.value, 'a\rb\nc');
    doc.undo();
    doc.select({ start: 2 });
    indent(doc, '\t');
    assert.equal(doc.value, '\ta\t\r  b\n c');
});

test('newline indentation and paired delimiters use the document EOL and one undo step', () => {
    let doc = new EditorDocument('x\r\n  {}');

    doc.select({ start: 6 });
    newline(doc, '  ');
    assert.equal(doc.value, 'x\r\n  {\r\n    \r\n  }');
    assert.equal(doc.selection.start, 12);
    doc.undo();
    assert.equal(doc.value, 'x\r\n  {}');

    let plain = new EditorDocument('    abc');

    plain.select({ start: 7 });
    newline(plain);
    assert.equal(plain.value, '    abc\n    ');
});

test('brackets wrap selection, skip a closer, delete pairs, and avoid apostrophes in identifiers', () => {
    let doc = new EditorDocument('word');

    doc.select({ direction: 'backward', end: 4, start: 0 });
    assert.equal(bracket(doc, '('), true);
    assert.equal(doc.value, '(word)');
    assert.deepEqual(doc.selection, { direction: 'backward', end: 5, start: 1 });
    doc.select({ start: 5 });
    assert.equal(bracket(doc, ')'), true);
    assert.equal(doc.value, '(word)');
    assert.equal(doc.selection.start, 6);
    doc.select({ start: 5 });
    assert.equal(bracket(doc, "'"), false);
    doc.reset();
    bracket(doc, '[');
    assert.equal(doc.value, '[]');
    assert.equal(deletePair(doc), true);
    assert.equal(doc.value, '');
    doc.undo();
    assert.equal(doc.value, '[]');
});

test('line and block comments toggle as one transaction and skip blank lines', () => {
    let doc = new EditorDocument('  a\r\n\r\n b');

    doc.select({ end: doc.value.length, start: 0 });
    toggleComment(doc, '//');
    assert.equal(doc.value, '  // a\r\n\r\n // b');
    toggleComment(doc, '//');
    assert.equal(doc.value, '  a\r\n\r\n b');
    doc.undo();
    doc.undo();
    assert.equal(doc.value, '  a\r\n\r\n b');
    toggleComment(doc, false, ['/*', '*/']);
    assert.equal(doc.value, '/*  a\r\n\r\n b*/');
    toggleComment(doc, false, ['/*', '*/']);
    assert.equal(doc.value, '  a\r\n\r\n b');
    assert.equal(toggleComment(doc, false), false);
});

test('native projection round trips boundaries across CRLF, lone CR, LF, and emoji', () => {
    let source = '😀\r\na\rb\nc\r\n',
        native = new NativeText(source);

    assert.equal(native.value, '😀\na\nb\nc\n');

    for (let offset = 0; offset <= native.value.length; offset++) {
        assert.equal(native.toNative(native.toSource(offset)), offset);
    }

    assert.equal(native.toSource(3), 4);
    assert.deepEqual(native.edit(source, native.value), { from: 0, insert: '', to: 0 });
});

test('native diff keeps all untouched mixed EOL and exact source; new native lines use first EOL', () => {
    let source = 'a\r\nb\rc\n',
        native = new NativeText(source),
        edit = native.edit(source, 'a\nbX\nc\n', { end: 4, start: 4 });

    assert.deepEqual(edit, { from: 4, insert: 'X', to: 4 });

    let doc = new EditorDocument(source);

    doc.replace(edit.from, edit.to, edit.insert);
    assert.equal(doc.value, 'a\r\nbX\rc\n');
    edit = native.edit(source, 'a\n\nb\nc\n', { end: 3, start: 3 });
    assert.deepEqual(edit, { from: 3, insert: '\r\n', to: 3 });
    doc.undo();
    assert.equal(doc.value, source);
});

test('anchored native diffs resolve repeated-character insertion and directional deletion', () => {
    let native = new NativeText('aaaa');

    assert.deepEqual(native.edit('aaaa', 'aaaaa', { end: 2, start: 2 }), { from: 2, insert: 'a', to: 2 });
    assert.deepEqual(native.edit('aaaa', 'aaa', { end: 2, start: 2 }, 'deleteContentBackward'), {
        from: 1,
        insert: '',
        to: 2
    });
    assert.deepEqual(native.edit('aaaa', 'aaa', { end: 2, start: 2 }, 'deleteContentForward'), {
        from: 2,
        insert: '',
        to: 3
    });

    let crlf = new NativeText('a\r\nb');

    assert.deepEqual(crlf.edit('a\r\nb', 'ab', { end: 3, start: 3 }, 'deleteContentBackward'), {
        from: 1,
        insert: '',
        to: 3
    });
});

test('a composed native replacement is one undo step with exact pre-composition selection', () => {
    let doc = new EditorDocument('a\r\n日本'),
        native = new NativeText(doc.value);

    doc.select({ end: 5, start: 3 });

    let edit = native.edit(doc.value, 'a\n語', doc.selection);

    doc.replace(edit.from, edit.to, edit.insert, { selection: { start: 4 }, source: 'composition' });
    assert.equal(doc.value, 'a\r\n語');
    doc.undo();
    assert.equal(doc.value, 'a\r\n日本');
    assert.deepEqual(doc.selection, { direction: 'none', end: 5, start: 3 });
});

test('literal search escapes patterns, Unicode whole-word boundaries, navigation and wrap', () => {
    assert.equal(search('a.b axb A.B', 'a.b').matches.length, 2);
    assert.equal(search('a.b A.B', 'a.b', { caseSensitive: true }).matches.length, 1);
    assert.equal(search('cat scatter cat_ cat$ écat caté cat', 'cat', { wholeWord: true }).matches.length, 2);

    let matches = search('one one one', 'one').matches;

    assert.equal(nextMatch(matches, 0, 0), 0);
    assert.equal(nextMatch(matches, 0, 3, false, 0), 1);
    assert.equal(nextMatch(matches, 8, 11, false, 2), 0);
    assert.equal(nextMatch(matches, 0, 3, true, 0), 2);
    assert.equal(nextMatch(matches, 5, 5, true), 0);
    assert.equal(nextMatch(matches, 0, 0, true), 2);
    assert.equal(nextMatch(matches, 9, 9), 0);
    assert.equal(nextMatch([], 0, 0), -1);
});

test('regex captures, lookaround context and JS replacement tokens retain exact offsets', () => {
    let result = search('a1 b22', '(?<letter>[ab])(\\d+)', { regex: true }, '$<letter>:$2:$$:$&:$0');

    assert.deepEqual(
        result.matches.map((match) => match.replacement),
        ['a:1:$:a1:$0', 'b:22:$:b22:$0']
    );
    assert.equal(search('ab', '(?<=a)b', { regex: true }, '$&!').matches[0].replacement, 'b!');
    assert.equal(search('ab', '(a)', { regex: true }, '$12').matches[0].replacement, 'a2');
    assert.equal(search('ab', 'a', { regex: true }, "$`|$'").matches[0].replacement, '|b');
    assert.equal(search('ab', '$&', {}, '$1').matches.length, 0);
});

test('invalid regex, zero-width Unicode progress, match cap, and no partial replace all', () => {
    assert.ok(search('a', '[', { regex: true }).error);

    let zero = search('😀x', '(?=)', { regex: true });

    assert.deepEqual(
        zero.matches.map((match) => match.from),
        [0, 2, 3]
    );
    assert.equal(nextMatch(zero.matches, 0, 0, false, 0), 1);

    let result = search('aaaa', 'a', {}, 'x', 2),
        doc = new EditorDocument('aaaa');

    assert.equal(result.truncated, true);
    assert.equal(replaceMatches(doc, result), false);
    assert.equal(doc.value, 'aaaa');
    assert.equal(replaceMatches(doc, result, false, 1), true);
    assert.equal(doc.value, 'axaa');
});

test('replace all is atomic, literal replacements stay literal, undo restores source and selection', () => {
    let doc = new EditorDocument('one\r\none\n'),
        original = doc.value;

    doc.select({ direction: 'backward', end: 8, start: 5 });
    assert.equal(replaceMatches(doc, search(doc.value, 'one', {}, '$&')), true);
    assert.equal(doc.value, '$&\r\n$&\n');
    doc.undo();
    assert.equal(doc.value, original);
    assert.deepEqual(doc.selection, { direction: 'backward', end: 8, start: 5 });
    replaceMatches(doc, search(doc.value, '^', { regex: true }, '!'));
    assert.equal(doc.value, '!' + original);
    doc.undo();
    assert.equal(doc.value, original);
});

test('document search is remembered per revision and updates incrementally to exactly what a full scan finds', () => {
    let random = generator(99),
        doc = new EditorDocument('foo bar foo\nFoo food barfoo\n'.repeat(20)),
        queries = [
            ['foo', {}],
            ['foo', { caseSensitive: true }],
            ['foo', { wholeWord: true }],
            ['aa', {}],
            ['b.r', { regex: true }],
            ['bar\nfoo', {}]
        ],
        words = ['foo', 'Foo', ' ', '\n', 'a', 'aa', 'bar', 'x', 'oo', 'f'];

    let first = searchDocument(doc, 'foo');

    assert.equal(searchDocument(doc, 'foo'), first);

    for (let step = 0; step < 300; step++) {
        let from = random(doc.value.length + 1),
            to = Math.min(doc.value.length, from + random(6));

        if (random(8) === 0) {
            doc.undo();
        }
        else {
            doc.replace(from, to, words[random(words.length)] + (random(2) ? words[random(words.length)] : ''));
        }

        for (let [query, options] of queries) {
            if (random(3)) {
                assert.deepEqual(searchDocument(doc, query, options, 'r'), search(doc.value, query, options, 'r'), query);
            }
        }
    }
});

test('lexical highlighting carries comments/strings across lines and never rewrites source slices', () => {
    let open = highlightLine('const a = /* <script>', 'typescript');

    assert.equal(open.state, 'comment');

    let close = highlightLine('*/ "&amp;<img>" + 3', 'typescript', open.state);

    assert.equal(close.state, '');
    assert.deepEqual(
        close.tokens.map((token) => token.kind),
        ['comment', 'string', 'operator', 'number']
    );

    let template = highlightLine('`first', 'javascript');

    assert.equal(template.state, '`');
    assert.equal(highlightLine('second`', 'javascript', template.state).state, '');
    assert.equal(highlightLine("'''text", 'python').state, "'''");

    for (let text of ['<img src=x onerror=alert(1)>', '\0\uFEFF😀\t const', '"escaped\\"quote"']) {
        let previous = 0;

        for (let token of highlightLine(text, 'javascript').tokens) {
            assert.ok(token.from >= previous && token.to <= text.length && token.to > token.from);
            previous = token.to;
        }
    }

    assert.deepEqual(highlightLine('x'.repeat(10001), 'typescript').tokens, []);
    assert.equal(languageFor('C:\\src\\FILE.TSX'), 'typescript');
    assert.equal(languageFor('styles/app.scss'), 'scss');
    assert.equal(languageFor('unknown.xyz'), 'plain');
    assert.equal(languageFor('Makefile'), 'plain');
    assert.deepEqual(commentSyntax('json'), { line: false });
});

test('type arguments are not JSX: generics stay code and later lines keep their state', () => {
    let state = '';

    for (let line of [
        'const map: Record<string, number> = {};',
        'type Response = Page | Renderable<unknown>;',
        'if (a < b && c > d) {}',
        'export { html } from "x";'
    ]) {
        let result = highlightLine(line, 'typescript', state);

        assert.equal(result.state, '', line);
        assert.ok(!result.tokens.some((token) => token.kind === 'tag'), line);
        state = result.state;
    }

    assert.deepEqual(kinds('export { html } from "x";', 'typescript')[0], ['export', 'keyword']);

    let jsx = highlightLine('return <div className="x">{a}</div>;', 'typescript');

    assert.equal(jsx.state, '');
    assert.ok(jsx.tokens.some((token) => token.kind === 'tag'));
    assert.deepEqual(kinds('    /[({[]/.test(left)', 'typescript')[0], ['/[({[]/', 'regexp']);
    assert.ok(highlightLine('</s}', 'javascript').state.startsWith('script:'), 'a stray brace inside a tag terminates');
});

test('CSS and SCSS lex colors, dimensions, selectors, variables, at-rules and raw urls', () => {
    assert.deepEqual(kinds('  color: #62a8ff;', 'css'), [
        ['color', 'property'],
        [':', 'operator'],
        ['#62a8ff', 'color'],
        [';', 'operator']
    ]);
    assert.deepEqual(kinds('  padding: 1rem 0.5em -2px 50%;', 'scss'), [
        ['padding', 'property'],
        [':', 'operator'],
        ['1rem', 'number'],
        ['0.5em', 'number'],
        ['-2px', 'number'],
        ['50%', 'number'],
        [';', 'operator']
    ]);
    assert.deepEqual(kinds('.card > a:hover, #main {', 'css'), [
        ['.card', 'selector'],
        ['>', 'operator'],
        ['a', 'tag'],
        [':hover', 'selector'],
        [',', 'operator'],
        ['#main', 'selector'],
        ['{', 'operator']
    ]);
    assert.deepEqual(kinds('$gap: 1rem;', 'scss'), [
        ['$gap', 'variable'],
        [':', 'operator'],
        ['1rem', 'number'],
        [';', 'operator']
    ]);
    assert.deepEqual(kinds('  margin: $gap * 2; // note', 'scss'), [
        ['margin', 'property'],
        [':', 'operator'],
        ['$gap', 'variable'],
        ['*', 'operator'],
        ['2', 'number'],
        [';', 'operator'],
        ['// note', 'comment']
    ]);
    assert.deepEqual(kinds('@media (max-width: 600px) {', 'css'), [
        ['@media', 'keyword'],
        ['(', 'operator'],
        ['max-width', 'keyword'],
        [':', 'operator'],
        ['600px', 'number'],
        [')', 'operator'],
        ['{', 'operator']
    ]);
    assert.deepEqual(kinds('--accent: var(--blue);', 'css'), [
        ['--accent', 'variable'],
        [':', 'operator'],
        ['var', 'function'],
        ['(', 'operator'],
        ['--blue', 'variable'],
        [')', 'operator'],
        [';', 'operator']
    ]);
    assert.deepEqual(kinds('background: url(//cdn.example/a.png);', 'css').slice(2), [
        ['url', 'function'],
        ['(', 'operator'],
        ['//cdn.example/a.png', 'string'],
        [')', 'operator'],
        [';', 'operator']
    ]);
    assert.deepEqual(kinds('a::before { content: "x" !important }', 'css'), [
        ['a', 'tag'],
        ['::before', 'selector'],
        ['{', 'operator'],
        ['content', 'property'],
        [':', 'operator'],
        ['"x"', 'string'],
        ['!important', 'keyword'],
        ['}', 'operator']
    ]);
    assert.equal(highlightLine('/* open', 'scss').state, 'comment');
    assert.deepEqual(kinds('<!doctype html>', 'html'), [['<!doctype html>', 'keyword']]);
    assert.deepEqual(kinds('body { color: #fff }', 'html', highlightLine('<style>', 'html').state)[4], ['#fff', 'color']);
});

test('deterministic transaction fuzz restores arbitrary source through all undo/redo steps', () => {
    let random = generator(0x1020304),
        doc = new EditorDocument('😀\r\n\uFEFF<source>\0\rX\n'),
        values = [doc.value];

    for (let i = 0; i < 100; i++) {
        let from = random(doc.value.length + 1),
            to = from + random(doc.value.length - from + 1);

        if (doc.replace(from, to, ['x', '\r\n', '😀', '', '\0', '\t', '<b>'][random(7)])) {
            values.push(doc.value);
        }
    }

    for (let i = values.length - 2; i >= 0; i--) {
        assert.equal(doc.undo(), true);
        assert.equal(doc.value, values[i]);
    }

    assert.equal(doc.undo(), false);

    for (let i = 1; i < values.length; i++) {
        assert.equal(doc.redo(), true);
        assert.equal(doc.value, values[i]);
    }

    assert.equal(doc.redo(), false);
});

test('the incremental syntax cache matches a full lex, and its nesting a fresh scan, through random edits', () => {
    for (let [language, source] of Object.entries(SAMPLES)) {
        let random = generator(language.length * 7919),
            doc = new EditorDocument(source),
            cache = new SyntaxCache(doc, language);

        for (let step = 0; step < 120; step++) {
            let action = random(12);

            if (action === 0) {
                doc.undo();
            }
            else if (action === 1) {
                doc.redo();
            }
            else if (action === 2 && step % 40 === 0) {
                doc.reset(source);
            }
            else {
                let from = random(doc.value.length + 1),
                    to = Math.min(doc.value.length, from + (random(3) ? 0 : random(8)));

                doc.replace(from, to, SNIPPETS[random(SNIPPETS.length)]);
            }

            // Partial reads leave later lines unvalidated, like a viewport would.
            cache.lineTokens(random(doc.lineCount));

            if (step % 5) {
                continue;
            }

            let expected = lexAll(doc.value, language);

            for (let i = 0, n = expected.length; i < n; i++) {
                let { end, start, tokens } = cache.line(i);

                assert.deepEqual({ end, start, tokens }, expected[i], `${language} line ${i}`);
            }

            assert.deepEqual(structureOf(cache), structures(doc.value, language), language);
        }
    }
});

test('a keystroke re-lexes only until the lexer state matches again', () => {
    let doc = new EditorDocument(Array.from({ length: 2000 }, (_, i) => `let value${i} = { a: "${i}" };`).join('\n')),
        cache = syntaxCache(doc, 'typescript');

    assert.equal(syntaxCache(doc, 'typescript'), cache);
    cache.lineTokens(1999);

    let before = Array.from({ length: 2000 }, (_, i) => cache.line(i));

    doc.select({ start: doc.offset(1000, 5) });
    insertText(doc, 'x');
    cache.lineTokens(1999);

    let relexed = before.filter((line, i) => cache.line(i) !== line).length;

    assert.equal(relexed, 1);
    insertText(doc, '/*');
    cache.lineTokens(1999);
    assert.equal(cache.stateAt(1999), 'comment');
    doc.undo();
    assert.equal(cache.stateAt(1999), '');
});

test('fold gutter prefers the function body over parameters and inline header types', () => {
    let source = 'function greet(person: { name: string }) {\n  return person.name;\n}',
        fold = structures(source, 'typescript').folds.find((range) => range.line === 1);

    assert.equal(source.slice(fold.from, fold.to), '\n  return person.name;\n');
    assert.deepEqual(foldAt(new SyntaxCache(new EditorDocument(source), 'typescript'), 1), fold);
});

test('windowed fold, pair and opener queries agree with a full structure scan', () => {
    for (let [language, source] of Object.entries(SAMPLES)) {
        let cache = new SyntaxCache(new EditorDocument(source), language),
            full = structures(source, language);

        for (let line = 1; line <= cache.lineCount; line++) {
            assert.deepEqual(foldAt(cache, line), full.folds.find((fold) => fold.line === line) ?? null, `${language}:${line}`);
        }

        for (let offset = 0; offset <= source.length; offset++) {
            assert.deepEqual(pairAt(cache, offset), matchingPair(full.pairs, offset), `${language}@${offset}`);

            let expected = full.pairs
                .filter((pair) => pair.from <= offset && pair.to >= offset + 1 && (pair.from < offset || pair.to > offset + 1))
                .sort((a, b) => a.to - a.from - (b.to - b.from))[0];

            assert.deepEqual(pairAround(cache, offset, offset + 1), expected ?? null, `${language} around ${offset}`);

            if (cache.tokenAt(offset)) {
                continue;
            }

            let open = openBracket(cache, offset);

            for (let closer of [')', ']', '}']) {
                let pair = structures(source.slice(0, offset) + closer, language).pairs.find((item) => item.to === offset),
                    matches = open && { '(': ')', '[': ']', '{': '}' }[open.name] === closer;

                assert.equal(!!pair, !!matches, `${language} opener ${offset}${closer}`);

                if (pair) {
                    assert.equal(open.from, pair.from);
                }
            }
        }
    }
});

test('folding from inside a block finds the innermost enclosing range', () => {
    let doc = new EditorDocument('function f() {\n    let a = 1;\n    if (a) {\n        a++;\n    }\n    return a;\n}\n'),
        cache = syntaxCache(doc, 'javascript');

    assert.equal(enclosingFold(cache, 2).line, 1);
    assert.equal(enclosingFold(cache, 4).line, 3);
    assert.equal(enclosingFold(cache, 5).line, 3);
    assert.equal(enclosingFold(cache, 6).line, 1);
    assert.equal(enclosingFold(cache, 1).line, 1);
    assert.equal(enclosingFold(cache, 7), null);
    assert.equal(enclosingFold(cache, 8), null);
    assert.equal(enclosingFold(cache, 99), null);

    let python = new SyntaxCache(new EditorDocument('def f():\n    x = 1\n    if x:\n        y = 2\n    z = 3\nw = 4'), 'python');

    assert.equal(enclosingFold(python, 4).line, 3);
    assert.equal(enclosingFold(python, 5).line, 1);
    assert.equal(enclosingFold(python, 6), null);

    let markdown = new SyntaxCache(new EditorDocument('# A\ntext\n## B\nmore\n# C'), 'markdown');

    assert.equal(enclosingFold(markdown, 4).line, 3);
    assert.equal(enclosingFold(markdown, 2).line, 1);

    let comment = new SyntaxCache(new EditorDocument('x;\n/*\n inside\n*/\ny;'), 'typescript');

    assert.equal(enclosingFold(comment, 3).line, 2);
    assert.equal(enclosingFold(comment, 1), null);
});

test('multiple selections merge overlaps, retain the primary, and travel in text and selection history', () => {
    let doc = new EditorDocument('abcdef');

    doc.selectMany([
        { direction: 'backward', end: 5, start: 4 },
        { end: 2, start: 0 },
        { end: 3, start: 1 },
        { end: 5, start: 4 }
    ]);
    assert.deepEqual(
        doc.selections.map((range) => [range.start, range.end]),
        [
            [4, 5],
            [0, 3]
        ]
    );

    let before = doc.selections;

    insertText(doc, ['X', 'Y']);
    assert.equal(doc.value, 'YdXf');

    let after = doc.selections;

    doc.undo();
    assert.equal(doc.value, 'abcdef');
    assert.deepEqual(doc.selections, before);
    doc.redo();
    assert.deepEqual(doc.selections, after);
    doc.select({ start: 1 });
    doc.undoSelection();
    assert.deepEqual(doc.selections, after);
    doc.redoSelection();
    assert.equal(doc.selection.start, 1);
});

test('repeated-character multi insertion anchors each caret and undo restores every range', () => {
    let doc = new EditorDocument('aaaa');

    doc.selectMany([{ start: 1 }, { start: 3 }]);

    let before = doc.selections;

    assert.equal(insertText(doc, 'a'), true);
    assert.equal(doc.value, 'aaaaaa');
    assert.deepEqual(
        doc.selections.map((range) => range.start),
        [2, 5]
    );
    doc.undo();
    assert.deepEqual(doc.selections, before);
    doc.redo();
    assert.deepEqual(
        doc.selections.map((range) => range.start),
        [2, 5]
    );
});

test('typing at several carets is one undo step, as at one caret', () => {
    let doc = new EditorDocument('a\nb\nc');

    doc.selectMany([{ start: 1 }, { start: 3 }, { start: 5 }]);

    for (let character of 'tile') {
        assert.equal(bracket(doc, character), false);
        insertText(doc, character, 'input');
    }

    assert.equal(doc.value, 'atile\nbtile\nctile');
    doc.undo();
    assert.equal(doc.value, 'a\nb\nc');
    assert.equal(bracket(doc, '('), true);
    assert.equal(doc.value, 'a()\nb()\nc()');
});

test('multiple bracket, newline, deletion and distributed paste are atomic with CRLF and surrogate pairs', () => {
    let doc = new EditorDocument('x\r\nx');

    doc.selectMany([{ start: 1 }, { start: 4 }]);
    bracket(doc, '(');
    assert.equal(doc.value, 'x()\r\nx()');
    newline(doc, '  ');
    assert.equal(doc.value, 'x(\r\n  \r\n)\r\nx(\r\n  \r\n)');
    doc.undo();
    assert.equal(doc.value, 'x()\r\nx()');
    deletePair(doc);
    assert.equal(doc.value, 'x\r\nx');
    doc.undo();
    assert.equal(doc.value, 'x()\r\nx()');
    doc.reset('😀\r\n😀');
    doc.selectMany([{ start: 2 }, { start: 6 }]);
    deleteCharacter(doc);
    assert.equal(doc.value, '\r\n');
    doc.undo();
    assert.equal(doc.value, '😀\r\n😀');
    doc.selectMany([
        { end: 2, start: 0 },
        { end: 6, start: 4 }
    ]);
    insertText(doc, ['one', 'two']);
    assert.equal(doc.value, 'one\r\ntwo');
});

test('multi indentation/comments touch each selected line only once', () => {
    let doc = new EditorDocument('a b\r\nc');

    doc.selectMany([{ start: 1 }, { start: 3 }, { start: 6 }]);
    indent(doc, '  ', true);
    assert.equal(doc.value, 'a b\r\nc');
    toggleComment(doc, '//');
    assert.equal(doc.value, '// a b\r\n// c');
    toggleComment(doc, '//');
    assert.equal(doc.value, 'a b\r\nc');
    doc.selectMany([
        { end: 2, start: 0 },
        { end: 5, start: 3 }
    ]);
    indent(doc, '  ');
    assert.equal(doc.value, '  a b\r\nc');
    doc.undo();
    assert.equal(doc.value, 'a b\r\nc');
});

test('add-next occurrence and all occurrences skip existing overlaps and wrap', () => {
    let doc = new EditorDocument('foo foo food foo');

    doc.select({ start: 1 });
    addNextOccurrence(doc);
    assert.deepEqual([doc.selection.start, doc.selection.end], [0, 3]);
    addNextOccurrence(doc);
    assert.equal(doc.selections.length, 2);
    addNextOccurrence(doc, true);
    assert.equal(doc.selections.length, 4);
    insertText(doc, 'x');
    assert.equal(doc.value, 'x x xd x');
    doc.undo();
    assert.equal(doc.selections.length, 4);
});

test('line move/copy/delete/blank commands retain columns and mixed line-ending slots', () => {
    let doc = new EditorDocument('aa\r\nbb\ncc');

    doc.select({ start: 5 });
    lineCommand(doc, 'moveUp');
    assert.equal(doc.value, 'bb\r\naa\ncc');
    assert.equal(doc.selection.start, 1);
    doc.undo();
    assert.equal(doc.selection.start, 5);
    lineCommand(doc, 'moveDown');
    assert.equal(doc.value, 'aa\r\ncc\nbb');
    assert.deepEqual(doc.position(), { column: 2, line: 3 });
    doc.undo();
    lineCommand(doc, 'copyDown');
    assert.equal(doc.value, 'aa\r\nbb\nbb\r\ncc');
    assert.deepEqual(doc.position(), { column: 2, line: 3 });
    doc.undo();
    lineCommand(doc, 'delete');
    assert.equal(doc.value, 'aa\r\ncc');
    doc.undo();
    lineCommand(doc, 'blank');
    assert.equal(doc.value, 'aa\r\nbb\n\r\ncc');
    assert.deepEqual(doc.position(), { column: 1, line: 3 });
});

test('line commands rewrite only the lines around the selection; farther lines keep their own endings', () => {
    let doc = new EditorDocument('a\r\nb\nc\r\nd\ne'),
        batches = [];

    doc.subscribe((_state, change) => batches.push(...(change.editBatches ?? [])));
    doc.select({ start: 0 });
    lineCommand(doc, 'delete');
    assert.equal(doc.value, 'b\nc\r\nd\ne');
    doc.select({ start: doc.value.length });
    lineCommand(doc, 'moveUp');
    assert.equal(doc.value, 'b\nc\r\ne\nd');
    assert.ok(batches.every((batch) => batch.every((edit) => edit.to - edit.from <= 4)));
    doc.select({ end: doc.value.length, start: 0 });
    lineCommand(doc, 'delete');
    assert.equal(doc.value, '');
});

test('disjoint line movement, line selection, lexical reindent and transpose', () => {
    let doc = new EditorDocument('a\nb\nc\nd\ne');

    doc.selectMany([{ start: 2 }, { start: 6 }]);
    lineCommand(doc, 'moveUp');
    assert.equal(doc.value, 'b\na\nd\nc\ne');
    assert.deepEqual(
        doc.selections.map((range) => range.start),
        [0, 4]
    );
    doc.undo();
    selectLine(doc);
    assert.deepEqual(
        doc.selections.map((range) => [range.start, range.end]),
        [
            [2, 4],
            [6, 8]
        ]
    );
    doc.reset('{\nx\n}');
    doc.select({ end: 5, start: 0 });
    reindent(doc, 'javascript', '  ');
    assert.equal(doc.value, '{\n  x\n}');
    doc.reset('if (a) {\n"}"; [\n1\n]\n  }');
    doc.select({ end: doc.value.length, start: 0 });
    reindent(doc, 'javascript', '  ');
    assert.equal(doc.value, 'if (a) {\n  "}"; [\n    1\n  ]\n}');
    doc.reset('abc');
    doc.select({ start: 2 });
    transpose(doc);
    assert.equal(doc.value, 'acb');
    doc.undo();
    assert.equal(doc.value, 'abc');
});

test('fold projection hides source without losing CRLF mapping or mutating source', () => {
    let source = '{\r\n  a\r\n  b\r\n}\r\nz',
        projection = new NativeText(source, structures(source, 'javascript').folds);

    assert.equal(projection.value, '{…}\nz');
    assert.equal(projection.toSource(2), source.indexOf('}'));
    assert.equal(projection.toNative(source.indexOf('}')), 2);
    assert.equal(projection.toNative(source.indexOf('a')), 1);
    assert.equal(source, '{\r\n  a\r\n  b\r\n}\r\nz');

    for (let offset = 0; offset <= projection.value.length; offset++) {
        assert.equal(projection.toNative(projection.toSource(offset)), offset);
    }
});

test('lexical brackets and folds ignore string/comment delimiters and handle nested blocks', () => {
    let source = '{\n  "}"; // ]\n  [\n    1\n  ]\n}',
        scan = structures(source, 'javascript');

    assert.equal(scan.pairs.length, 2);
    assert.equal(scan.folds.length, 2);
    assert.equal(outerFolds(scan.folds).length, 1);
    assert.equal(matchingPair(scan.pairs, 0).to, source.length - 1);
    assert.equal(matchingPair(scan.pairs, source.indexOf('"}') + 1), null);
    assert.equal(structures('def f():\n  x=1\n  y=2\nz=3', 'python').folds.length, 1);
    assert.equal(structures('<div>\n<p>x</p>\n<p>y</p>\n</div>', 'html').folds.length, 1);
    // Pairs closing on their own line don't fold, as in CodeMirror.
    assert.equal(structures('greet(person, { name: "Ada" });', 'typescript').folds.length, 0);
    assert.equal(structures('# Title\na\nb\n# Next', 'markdown').folds.length, 1);
    assert.equal(structures('const m: Map<string, Array<number>> = new Map();\n</string>', 'typescript').folds.length, 0);
});

test('wrapping fallback aligns row geometry, tab stops, CRLF source offsets and trailing lines', () => {
    let source = 'abc defgh\r\n\tx\n',
        projection = new NativeText(source),
        layout = new EditorLayout(projection, source, 35, 20, 7, 4, true);

    assert.equal(layout.lines[0].height, 40);
    assert.equal(layout.rect(4).top, 20);
    assert.equal(layout.offset(14, 30), 6);
    assert.equal(layout.rect(projection.toNative(source.indexOf('x'))).left, 28);
    assert.equal(layout.lines.at(-1).number, 3);

    let nowrap = new EditorLayout(projection, source, 35, 20, 7, 4, false);

    assert.equal(nowrap.lines[0].height, 20);
    assert.equal(nowrap.rect(8).left, 56);
});

test('minimap slider click/drag maps endpoints, short documents and resize', async (t) => {
    // The minimap module renders through '@esportsplus/template', which needs a DOM as soon as it loads.
    let module = await import('../src/components/editor/code/minimap.ts').catch(() => null);

    if (!module) {
        t.skip('minimap.ts cannot load without a DOM');
        return;
    }

    let { minimapMetrics, minimapScroll } = module,
        metrics = minimapMetrics(200, 1000, 200, 400);

    assert.equal(metrics.height, 40);
    assert.equal(metrics.top, 80);
    assert.equal(minimapScroll(100, 20, 200, 1000, 200), 400);
    assert.equal(minimapScroll(200, 20, 200, 1000, 200), 800);
    assert.equal(minimapScroll(-20, 0, 200, 1000, 200), 0);
    assert.equal(minimapScroll(10, 0, 200, 100, 200), 0);
});

test('visible language token categories cover embedded HTML, JSX, JSONC, SCSS, Python and fenced Markdown', () => {
    let js = highlightLine('class Widget { run(arg) { return /a+/g.test(arg) && true; } }', 'tsx');

    for (let kind of ['keyword', 'type', 'function', 'variable', 'regexp', 'number', 'operator']) {
        assert.ok(
            js.tokens.some((token) => token.kind === kind),
            kind
        );
    }

    assert.ok(highlightLine('<Button title="hello" />', 'jsx').tokens.some((token) => token.kind === 'tag'));

    let html = highlightLine('<style>', 'html'),
        css = highlightLine('a { color: red; }', 'html', html.state);

    assert.ok(css.tokens.some((token) => token.kind === 'property'));

    let close = highlightLine('</style><script>const x = 1;</script>', 'html', css.state);

    assert.equal(close.state, '');
    assert.ok(close.tokens.some((token) => token.kind === 'keyword'));

    let json = highlightLine('{"x": true, /* note */ "y": 2}', 'jsonc');

    assert.ok(json.tokens.some((token) => token.kind === 'property'));
    assert.ok(json.tokens.some((token) => token.kind === 'comment'));

    let scss = highlightLine('$color: #fff;', 'scss');

    assert.ok(scss.tokens.some((token) => token.kind === 'variable'));
    assert.ok(scss.tokens.some((token) => token.kind === 'color'));

    let fence = highlightLine('```ts', 'markdown'),
        code = highlightLine('const x = 1', 'markdown', fence.state);

    assert.ok(code.tokens.some((token) => token.kind === 'keyword'));
    assert.equal(highlightLine('```', 'markdown', code.state).state, '');

    let doc = new EditorDocument('if x:');

    doc.select({ start: 5 });
    newline(doc, '  ', 'python');
    assert.equal(doc.value, 'if x:\n  ');
});

test('overlapping multi deletions merge atomically, while identical replacements still collapse selections', () => {
    let doc = new EditorDocument('abc');

    doc.selectMany([{ start: 1 }, { start: 2 }]);

    let before = doc.state;

    assert.equal(deleteCharacter(doc, true, true), true);
    assert.equal(doc.value, 'c');
    assert.equal(doc.selections.length, 1);
    doc.undo();
    assert.equal(doc.value, before.value);
    assert.deepEqual(doc.selections, before.selections);
    doc.reset('aa\naa');
    doc.selectMany([
        { end: 2, start: 0 },
        { end: 5, start: 3 }
    ]);
    assert.equal(insertText(doc, 'aa'), false);
    assert.deepEqual(
        doc.selections.map((range) => range.start),
        [2, 5]
    );
    assert.equal(doc.state.canUndo, false);
});

test('word deletion takes whitespace, identifier or punctuation runs, across line breaks', () => {
    let doc = new EditorDocument('let foo$1 = a.b;\n  next');

    doc.select({ start: 9 });
    deleteCharacter(doc, true, true);
    assert.equal(doc.value, 'let  = a.b;\n  next');
    doc.undo();
    doc.select({ start: 17 });
    deleteCharacter(doc, true, true);
    assert.equal(doc.value, 'let foo$1 = a.b;  next');
    doc.undo();
    doc.select({ start: 12 });
    deleteCharacter(doc, false, true);
    assert.equal(doc.value, 'let foo$1 = .b;\n  next');
});

test('many-caret edits preserve source and bounded patch history without per-caret document clones', () => {
    let source = Array.from({ length: 500 }, (_, index) => String(index).padStart(4, '0')).join('\r\n'),
        doc = new EditorDocument(source);

    doc.selectMany(Array.from({ length: 500 }, (_, index) => ({ start: index * 6 + 4 })));

    let before = doc.selections;

    insertText(doc, '!');
    assert.equal(
        doc.value,
        source
            .split('\r\n')
            .map((line) => line + '!')
            .join('\r\n')
    );
    assert.equal(doc.selections.length, 500);
    doc.undo();
    assert.equal(doc.value, source);
    assert.deepEqual(doc.selections, before);
    doc.redo();
    assert.equal(doc.selections.at(-1).start, 499 * 7 + 5);
    deleteCharacter(doc);
    assert.equal(doc.value, source);
    assert.equal(doc.selections.at(-1).start, 499 * 6 + 4);
});

test('syntax assistance suppresses pairing/extra indentation inside comments and strings', () => {
    let doc = new EditorDocument('// comment {');

    doc.select({ start: doc.value.length });
    assert.equal(bracket(doc, '(', 'javascript'), false);
    newline(doc, '  ', 'javascript');
    assert.equal(doc.value, '// comment {\n');
    doc.reset('const x = "abc";');
    doc.select({ start: 11 });
    assert.equal(bracket(doc, '(', 'javascript'), false);
    doc.select({ start: 15 });
    assert.equal(bracket(doc, '(', 'javascript'), true);
    doc.reset('😀a');
    doc.select({ start: 2 });
    transpose(doc);
    assert.equal(doc.value, 'a😀');
    doc.undo();
    assert.equal(doc.value, '😀a');
});

test('HTML tag state handles quoted greater-than, multiline attributes and embedded script; comments/fences fold', () => {
    let first = highlightLine('<div title="a>b"', 'html');

    assert.ok(first.state.startsWith('tag:'));

    let next = highlightLine(' class="box">hello</div>', 'html', first.state);

    assert.equal(next.state, '');
    assert.ok(next.tokens.some((token) => token.kind === 'property'));

    let script = highlightLine('<script type="text/javascript">', 'html');

    assert.ok(highlightLine('const n=1;', 'html', script.state).tokens.some((token) => token.kind === 'keyword'));
    assert.equal(structures('/*\n a\n b\n */', 'javascript').folds.length, 1);
    assert.equal(structures('```js\nconst x=1;\nx();\n```', 'markdown').folds.length, 1);
});

test('closing delimiter indentation is lexical, atomic, and preserves CRLF', () => {
    let doc = new EditorDocument('  {\r\n      ');

    doc.select({ start: doc.value.length });
    assert.equal(closeIndent(doc, '}', 'javascript'), true);
    assert.equal(doc.value, '  {\r\n  }');
    doc.undo();
    assert.equal(doc.value, '  {\r\n      ');
    doc.reset('// {\r\n    ');
    doc.select({ start: doc.value.length });
    assert.equal(closeIndent(doc, '}', 'javascript'), false);
    doc.reset('  (\r\n      ');
    doc.select({ start: doc.value.length });
    assert.equal(closeIndent(doc, '}', 'javascript'), false);
});

test('custom multi-caret deletion follows grapheme boundaries and treats CRLF as one break', () => {
    let doc = new EditorDocument('e\u0301\r\n👩‍💻');

    doc.selectMany([{ start: 2 }, { start: doc.value.length }]);
    deleteCharacter(doc);
    assert.equal(doc.value, '\r\n');
    doc.undo();
    assert.equal(doc.value, 'e\u0301\r\n👩‍💻');
    doc.select({ start: 2 });
    deleteCharacter(doc, false);
    assert.equal(doc.value, 'e\u0301👩‍💻');
});

test('two closed folds map independently through edits before, between, after and grouped history', () => {
    let source = 'before\r\n{\r\n  one\r\n}\r\nbetween\r\n{\r\n  two\r\n}\r\nafter',
        doc = new EditorDocument(source),
        folds = outerFolds(structures(source, 'typescript').folds);

    assert.equal(folds.length, 2);
    doc.subscribe((state, change) => {
        if (change.textChanged) {
            folds = mapFolds(folds, change.editBatches, doc);
        }
    });

    let hidden = () => folds.map((fold) => doc.value.slice(fold.from, fold.to)),
        original = hidden();

    for (let name of ['before', 'between', 'after']) {
        let at = doc.value.indexOf(name);

        doc.replace(at, at, 'insert\r\n');
        assert.deepEqual(hidden(), original);
        doc.replace(at, at + 8, '');
        assert.deepEqual(hidden(), original);
        doc.undo();
        assert.deepEqual(hidden(), original);
        doc.undo();
        assert.deepEqual(hidden(), original);
        doc.redo();
        assert.deepEqual(hidden(), original);
        doc.redo();
        assert.deepEqual(hidden(), original);
    }

    doc.transact([
        { from: 0, insert: 'A', to: 0 },
        { from: doc.value.length, insert: 'B', to: doc.value.length }
    ]);
    assert.deepEqual(hidden(), original);
    doc.undo();
    assert.deepEqual(hidden(), original);
    doc.redo();
    assert.deepEqual(hidden(), original);
    doc.select({ start: doc.value.length });
    insertText(doc, 'x');
    insertText(doc, 'y');
    doc.undo();
    assert.deepEqual(hidden(), original);
    doc.redo();
    assert.deepEqual(hidden(), original);
    doc.replace(folds[0].from + 2, folds[0].from + 3, 'X');
    assert.equal(folds.length, 1);
    assert.equal(hidden()[0], original[1]);
    assert.deepEqual(mapFolds(folds, [], doc.value), folds);
    doc.undo();
    assert.equal(folds.length, 1);
    doc.redo();
    assert.equal(folds.length, 1);
});

test('ellipsis boundaries retain exact CRLF source, protect native deletion and map seam paste', () => {
    let source = 'head\r\n{ secret\r\n}\r\n{\r\nmore\r\n}\r\ntail',
        folds = outerFolds(structures(source, 'typescript').folds),
        projection = new NativeText(source, folds);

    assert.equal(projection.value, 'head\n{…}\n{…}\ntail');

    for (let at = 0; at <= projection.value.length; at++) {
        assert.equal(projection.toNative(projection.toSource(at)), at);
    }

    for (let placeholder of projection.placeholders()) {
        assert.equal(projection.toSource(placeholder.at), placeholder.from);
        assert.equal(projection.toSource(placeholder.at + 1), placeholder.to);

        let removed = projection.value.slice(0, placeholder.at) + projection.value.slice(placeholder.at + 1);

        assert.deepEqual(
            projection.edit(source, removed, { end: placeholder.to, start: placeholder.to }, 'deleteContentBackward'),
            { from: 0, insert: '', to: 0 }
        );

        let inserted = projection.value.slice(0, placeholder.at) + 'x\n' + projection.value.slice(placeholder.at),
            edit = projection.edit(source, inserted, { end: placeholder.from, start: placeholder.from }, 'insertText');

        assert.deepEqual(edit, { from: placeholder.from, insert: 'x\r\n', to: placeholder.from });

        let next = source.slice(0, edit.from) + edit.insert + source.slice(edit.to),
            mapped = mapFolds(folds, [[edit]], next);

        assert.equal(mapped.length, 2);
        assert.deepEqual(
            mapped.map((fold) => next.slice(fold.from, fold.to)),
            folds.map((fold) => source.slice(fold.from, fold.to))
        );
    }
});

test('wrapped inline and multiline ellipses roundtrip geometry and original gutter numbers', () => {
    let source = '0123456789 {\r\n hidden } end\r\n{\r\n more\r\n}\r\nafter',
        folds = outerFolds(structures(source, 'typescript').folds),
        projection = new NativeText(source, folds),
        layout = new EditorLayout(projection, source, 42, 20, 7, 4, true);

    for (let placeholder of projection.placeholders()) {
        for (let native of [placeholder.at, placeholder.at + 1]) {
            let rect = layout.rect(native);

            assert.equal(projection.toSource(layout.offset(rect.left, rect.top + 10)), projection.toSource(native));
        }
    }

    assert.deepEqual(
        layout.lines.map((line) => line.number),
        [1, 3, 6]
    );
});

test('nested JSX and multiline template interpolations expose expression braces without literal false pairs', () => {
    for (let language of ['jsx', 'tsx', 'javascript', 'typescript']) {
        let source =
                'const node = <Box title="literal }">don\'t {items.map(item => {\n return <Inner>{`hello ${item.ok ? {value: `nested ${item.id}`} : "}"}`}</Inner>;\n})}</Box>;',
            scan = structures(source, language),
            state = '';

        assert.ok(scan.pairs.some((pair) => pair.from === source.indexOf('{items')));
        assert.ok(scan.pairs.some((pair) => pair.from === source.indexOf('{value')));
        assert.ok(scan.pairs.some((pair) => pair.from === source.indexOf('{item.id')));
        assert.ok(scan.folds.some((fold) => fold.line === 1 && fold.endLine === 3));
        assert.ok(!scan.pairs.some((pair) => pair.to === source.indexOf('literal }') + 8));

        for (let line of source.split('\n')) {
            let lex = highlightLine(line, language, state);

            state = lex.state;

            for (let token of lex.tokens) {
                assert.ok(token.to > token.from && token.to <= line.length);
            }
        }

        assert.equal(state, '');
    }

    assert.equal(structures('const s = `text ${\n (() => { return {ok: "}"}; })()\n} tail`;', 'typescript').pairs.length, 6);
});
