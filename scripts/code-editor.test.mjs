import assert from 'node:assert/strict';
import test from 'node:test';
import './resolve.mjs';
const { EditorDocument, lineStarts, lineEnd } = await import('../src/components/code-editor/document.ts');
const { NativeText } = await import('../src/components/code-editor/projection.ts');
const {
    closeIndent,
    addNextOccurrence,
    deleteCharacter,
    lineCommand,
    selectLine,
    reindent,
    transpose,
    bracket,
    deletePair,
    indent,
    insertText,
    newline,
    toggleComment
} = await import('../src/components/code-editor/commands.ts');
const { search, nextMatch, replaceMatches } = await import('../src/components/code-editor/search.ts');
const { highlightLine, languageFor, commentSyntax } = await import('../src/components/code-editor/syntax.ts');

test('exact arbitrary source, mixed EOL indexing, UTF-16 positions, and trailing empty lines', () => {
    let value = '\uFEFF<script>"\0😀\r\na\rb\n',
        doc = new EditorDocument(value);
    assert.equal(doc.value, value);
    assert.deepEqual(doc.starts, lineStarts(value));
    assert.equal(doc.state.lineCount, 4);
    assert.equal(doc.offset(2), value.indexOf('a\r'));
    assert.deepEqual(doc.position(doc.offset(3, 99)), { line: 3, column: 2 });
    assert.equal(doc.offset(999), value.length);
    assert.equal(doc.offset(-1, -1), 0);
    assert.equal(value.slice(doc.starts[1], lineEnd(value, doc.starts, 1)), 'a');
    doc.setValue('');
    doc.undo();
    assert.equal(doc.value, value);
    assert.equal(doc.state.dirty, false);
});

test('transactions validate atomically and undo/redo multi-edit offsets and backward selection', () => {
    let doc = new EditorDocument('abcdef');
    doc.select({ start: 1, end: 5, direction: 'backward' });
    let before = doc.state;
    assert.equal(
        doc.transact([
            { from: 0, to: 3, insert: 'x' },
            { from: 2, to: 4, insert: '' }
        ]),
        false
    );
    assert.deepEqual(doc.state, before);
    doc.transact([
        { from: 1, to: 2, insert: 'LONG' },
        { from: 4, to: 6, insert: '!' }
    ]);
    assert.equal(doc.value, 'aLONGcd!');
    let after = doc.selection;
    assert.equal(doc.undo(), true);
    assert.equal(doc.value, 'abcdef');
    assert.deepEqual(doc.selection, before.selection);
    assert.equal(doc.redo(), true);
    assert.equal(doc.value, 'aLONGcd!');
    assert.deepEqual(doc.selection, after);
});

test('transaction rejection reports the original edit index and leaves all state, history and notifications untouched', () => {
    let doc = new EditorDocument('abcdef'),
        events = [];
    doc.setValue('abcdef!');
    doc.undo();
    doc.select({ start: 1, end: 4, direction: 'backward' });
    doc.subscribe((state, change) => events.push([state, change]));
    let before = doc.state,
        starts = doc.starts;
    for (let edit of [
        { from: -1, to: 0, insert: 'x' },
        { from: 0.5, to: 1, insert: 'x' },
        { from: 0, to: NaN, insert: 'x' },
        { from: Infinity, to: Infinity, insert: 'x' },
        { from: 3, to: 2, insert: 'x' },
        { from: 0, to: 7, insert: 'x' }
    ]) {
        assert.deepEqual(
            doc.tryTransact([{ from: 0, to: 0, insert: 'valid' }, edit], {
                selection: { start: 0 },
                group: 'insertText',
                time: 100
            }),
            { accepted: false, reason: 'invalid-range', index: 1 }
        );
        assert.equal(doc.replace(edit.from, edit.to, edit.insert), false);
        assert.deepEqual(doc.state, before);
        assert.equal(doc.starts, starts);
        assert.equal(events.length, 0);
    }
    // Sorting must not change which input edit the diagnostic identifies.
    assert.deepEqual(
        doc.tryTransact([
            { from: 3, to: 5, insert: 'x' },
            { from: 1, to: 4, insert: 'y' }
        ]),
        { accepted: false, reason: 'overlap', index: 0 }
    );
    assert.deepEqual(doc.tryTransact([{ from: 0, to: 1, insert: 42 }]), {
        accepted: false,
        reason: 'invalid-insert',
        index: 0
    });
    assert.deepEqual(doc.state, before);
    assert.equal(events.length, 0);
    assert.equal(doc.redo(), true);
    assert.equal(doc.value, 'abcdef!');
});

test('detailed transaction results distinguish accepted no-ops and edits; rejection preserves native grouping', () => {
    let doc = new EditorDocument('');
    assert.deepEqual(doc.tryTransact([]), { accepted: true, changed: false });
    assert.deepEqual(doc.tryTransact([{ from: 0, to: 0, insert: 'a' }], { group: 'insertText', time: 10 }), {
        accepted: true,
        changed: true
    });
    assert.equal(doc.transact([{ from: 0, to: 1, insert: 'a' }]), false);
    assert.equal(doc.transact([{ from: -1, to: 0, insert: '' }]), false);
    assert.equal(doc.replace(1, 1, 'b', { group: 'insertText', time: 20 }), true);
    assert.equal(doc.undo(), true);
    assert.equal(doc.value, '', 'validation rejection did not split the adjacent typing group');
    assert.equal(doc.redo(), true);
    assert.equal(doc.value, 'ab');
    let events = [];
    doc.subscribe((_state, change) => events.push(change));
    assert.deepEqual(doc.tryTransact([], { selection: { start: 0 } }), { accepted: true, changed: false });
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
        () => doc.tryTransact([{ from: 0, to: 0, insert: 'committed' }]),
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
    let doc = new EditorDocument('', { limit: 2, bytes: 100 });
    for (let text of ['a', 'b', 'c']) insertText(doc, text);
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

test('indent/outdent selected lines exclude a selection ending at the next line start and retain direction', () => {
    let doc = new EditorDocument('a\r\n  b\r\nc');
    doc.select({ start: 0, end: 8, direction: 'backward' });
    indent(doc, '  ');
    assert.equal(doc.value, '  a\r\n    b\r\nc');
    assert.deepEqual(doc.selection, { start: 2, end: 12, direction: 'backward' });
    indent(doc, '  ', true);
    assert.equal(doc.value, 'a\r\n  b\r\nc');
    doc.undo();
    doc.undo();
    assert.deepEqual(doc.selection, { start: 0, end: 8, direction: 'backward' });
});

test('indent at caret and outdent handle tabs, partial spaces, and blank lines without changing EOLs', () => {
    let doc = new EditorDocument('\ta\r  b\n c');
    doc.select({ start: 0, end: doc.value.length });
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
    doc.select({ start: 0, end: 4, direction: 'backward' });
    assert.equal(bracket(doc, '('), true);
    assert.equal(doc.value, '(word)');
    assert.deepEqual(doc.selection, { start: 1, end: 5, direction: 'backward' });
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
    doc.select({ start: 0, end: doc.value.length });
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
    for (let offset = 0; offset <= native.value.length; offset++)
        assert.equal(native.toNative(native.toSource(offset)), offset);
    assert.equal(native.toSource(3), 4);
    assert.deepEqual(native.edit(source, native.value), { from: 0, to: 0, insert: '' });
});

test('native diff keeps all untouched mixed EOL and exact source; new native lines use first EOL', () => {
    let source = 'a\r\nb\rc\n',
        native = new NativeText(source),
        edit = native.edit(source, 'a\nbX\nc\n', { start: 4, end: 4 });
    assert.deepEqual(edit, { from: 4, to: 4, insert: 'X' });
    let doc = new EditorDocument(source);
    doc.replace(edit.from, edit.to, edit.insert);
    assert.equal(doc.value, 'a\r\nbX\rc\n');
    edit = native.edit(source, 'a\n\nb\nc\n', { start: 3, end: 3 });
    assert.deepEqual(edit, { from: 3, to: 3, insert: '\r\n' });
    doc.undo();
    assert.equal(doc.value, source);
});

test('anchored native diffs resolve repeated-character insertion and directional deletion', () => {
    let native = new NativeText('aaaa');
    assert.deepEqual(native.edit('aaaa', 'aaaaa', { start: 2, end: 2 }), { from: 2, to: 2, insert: 'a' });
    assert.deepEqual(native.edit('aaaa', 'aaa', { start: 2, end: 2 }, 'deleteContentBackward'), {
        from: 1,
        to: 2,
        insert: ''
    });
    assert.deepEqual(native.edit('aaaa', 'aaa', { start: 2, end: 2 }, 'deleteContentForward'), {
        from: 2,
        to: 3,
        insert: ''
    });
    let crlf = new NativeText('a\r\nb');
    assert.deepEqual(crlf.edit('a\r\nb', 'ab', { start: 3, end: 3 }, 'deleteContentBackward'), {
        from: 1,
        to: 3,
        insert: ''
    });
});

test('a composed native replacement is one undo step with exact pre-composition selection', () => {
    let doc = new EditorDocument('a\r\n日本'),
        native = new NativeText(doc.value);
    doc.select({ start: 3, end: 5 });
    let edit = native.edit(doc.value, 'a\n語', doc.selection);
    doc.replace(edit.from, edit.to, edit.insert, { source: 'composition', selection: { start: 4 } });
    assert.equal(doc.value, 'a\r\n語');
    doc.undo();
    assert.equal(doc.value, 'a\r\n日本');
    assert.deepEqual(doc.selection, { start: 3, end: 5, direction: 'none' });
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
    doc.select({ start: 5, end: 8, direction: 'backward' });
    assert.equal(replaceMatches(doc, search(doc.value, 'one', {}, '$&')), true);
    assert.equal(doc.value, '$&\r\n$&\n');
    doc.undo();
    assert.equal(doc.value, original);
    assert.deepEqual(doc.selection, { start: 5, end: 8, direction: 'backward' });
    replaceMatches(doc, search(doc.value, '^', { regex: true }, '!'));
    assert.equal(doc.value, '!' + original);
    doc.undo();
    assert.equal(doc.value, original);
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
    for (let text of ['<img src=x onerror=alert(1)>', '\0\uFEFF😀\t const', '"escaped\\\"quote"']) {
        let tokens = highlightLine(text, 'javascript').tokens,
            previous = 0;
        for (let token of tokens) {
            assert.ok(token.from >= previous && token.to <= text.length && token.to > token.from);
            previous = token.to;
        }
    }
    assert.deepEqual(highlightLine('x'.repeat(10001), 'typescript').tokens, []);
    assert.equal(languageFor('C:\\src\\FILE.TSX'), 'typescript');
    assert.equal(languageFor('unknown.xyz'), 'plain');
    assert.deepEqual(commentSyntax('json'), { line: false });
});

test('deterministic transaction fuzz restores arbitrary source through all undo/redo steps', () => {
    let seed = 0x1020304,
        random = (max) => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed % max;
        },
        doc = new EditorDocument('😀\r\n\uFEFF<source>\0\rX\n'),
        values = [doc.value];
    for (let i = 0; i < 100; i++) {
        let from = random(doc.value.length + 1),
            to = from + random(doc.value.length - from + 1),
            insert = ['x', '\r\n', '😀', '', '\0', '\t', '<b>'][random(7)];
        if (doc.replace(from, to, insert)) values.push(doc.value);
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

const { EditorLayout } = await import('../src/components/code-editor/layout.ts');
const { structures, matchingPair, outerFolds, mapFolds } = await import('../src/components/code-editor/folding.ts');

test('fold gutter prefers the function body over parameters and inline header types', () => {
    const source = 'function greet(person: { name: string }) {\n  return person.name;\n}';
    const fold = structures(source, 'typescript').folds.find((range) => range.line === 1);
    assert.equal(source.slice(fold.from, fold.to), '\n  return person.name;\n');
});
const { minimapMetrics, minimapScroll } = await import('../src/components/code-editor/minimap.ts');

test('multiple selections merge overlaps, retain the primary, and travel in text and selection history', () => {
    let doc = new EditorDocument('abcdef');
    doc.selectMany([
        { start: 4, end: 5, direction: 'backward' },
        { start: 0, end: 2 },
        { start: 1, end: 3 },
        { start: 4, end: 5 }
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
        { start: 0, end: 2 },
        { start: 4, end: 6 }
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
        { start: 0, end: 2 },
        { start: 3, end: 5 }
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
    assert.deepEqual(doc.position(), { line: 3, column: 2 });
    doc.undo();
    lineCommand(doc, 'copyDown');
    assert.equal(doc.value, 'aa\r\nbb\nbb\r\ncc');
    assert.deepEqual(doc.position(), { line: 3, column: 2 });
    doc.undo();
    lineCommand(doc, 'delete');
    assert.equal(doc.value, 'aa\r\ncc');
    doc.undo();
    lineCommand(doc, 'blank');
    assert.equal(doc.value, 'aa\r\nbb\n\r\ncc');
    assert.deepEqual(doc.position(), { line: 3, column: 1 });
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
    doc.select({ start: 0, end: 5 });
    reindent(doc, 'javascript', '  ');
    assert.equal(doc.value, '{\n  x\n}');
    doc.reset('abc');
    doc.select({ start: 2 });
    transpose(doc);
    assert.equal(doc.value, 'acb');
    doc.undo();
    assert.equal(doc.value, 'abc');
});
test('fold projection hides source without losing CRLF mapping or mutating source', () => {
    let source = '{\r\n  a\r\n  b\r\n}\r\nz',
        ranges = structures(source, 'javascript').folds,
        projection = new NativeText(source, ranges);
    assert.equal(projection.value, '{…}\nz');
    assert.equal(projection.toSource(2), source.indexOf('}'));
    assert.equal(projection.toNative(source.indexOf('}')), 2);
    assert.equal(projection.toNative(source.indexOf('a')), 1);
    assert.equal(source, '{\r\n  a\r\n  b\r\n}\r\nz');
    for (let offset = 0; offset <= projection.value.length; offset++)
        assert.equal(projection.toNative(projection.toSource(offset)), offset);
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
    assert.equal(structures('<div>\n<p>x</p>\n<p>y</p>\n</div>', 'html').folds.length, 3);
    assert.equal(structures('# Title\na\nb\n# Next', 'markdown').folds.length, 1);
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
test('minimap slider click/drag maps endpoints, short documents and resize', () => {
    let metrics = minimapMetrics(200, 1000, 200, 400);
    assert.equal(metrics.height, 40);
    assert.equal(metrics.top, 80);
    assert.equal(minimapScroll(100, 20, 200, 1000, 200), 400);
    assert.equal(minimapScroll(200, 20, 200, 1000, 200), 800);
    assert.equal(minimapScroll(-20, 0, 200, 1000, 200), 0);
    assert.equal(minimapScroll(10, 0, 200, 100, 200), 0);
});
test('visible language token categories cover embedded HTML, JSX, JSONC, SCSS, Python and fenced Markdown', () => {
    let js = highlightLine('class Widget { run(arg) { return /a+/g.test(arg) && true; } }', 'tsx');
    for (let kind of ['keyword', 'type', 'function', 'variable', 'regexp', 'number', 'operator'])
        assert.ok(
            js.tokens.some((token) => token.kind === kind),
            kind
        );
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
    assert.ok(highlightLine('$color: #fff;', 'scss').tokens.some((token) => token.kind === 'property'));
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
        { start: 0, end: 2 },
        { start: 3, end: 5 }
    ]);
    assert.equal(insertText(doc, 'aa'), false);
    assert.deepEqual(
        doc.selections.map((range) => range.start),
        [2, 5]
    );
    assert.equal(doc.state.canUndo, false);
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
        if (change.textChanged) folds = mapFolds(folds, change.editBatches, state.value);
    });
    const hidden = () => folds.map((f) => doc.value.slice(f.from, f.to));
    let original = hidden();
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
        { from: 0, to: 0, insert: 'A' },
        { from: doc.value.length, to: doc.value.length, insert: 'B' }
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
    doc.undo();
    assert.equal(folds.length, 1);
    doc.redo();
    assert.equal(folds.length, 1);
});

test('ellipsis boundaries retain exact CRLF source, protect native deletion and map seam paste', () => {
    let source = 'head\r\n{ secret }\r\n{\r\nmore\r\n}\r\ntail',
        folds = outerFolds(structures(source, 'typescript').folds),
        projection = new NativeText(source, folds);
    assert.equal(projection.value, 'head\n{…}\n{…}\ntail');
    for (let at = 0; at <= projection.value.length; at++)
        assert.equal(projection.toNative(projection.toSource(at)), at);
    for (let placeholder of projection.placeholders()) {
        assert.equal(projection.toSource(placeholder.at), placeholder.from);
        assert.equal(projection.toSource(placeholder.at + 1), placeholder.to);
        let removed = projection.value.slice(0, placeholder.at) + projection.value.slice(placeholder.at + 1);
        assert.deepEqual(
            projection.edit(source, removed, { start: placeholder.to, end: placeholder.to }, 'deleteContentBackward'),
            { from: 0, to: 0, insert: '' }
        );
        let inserted = projection.value.slice(0, placeholder.at) + 'x\n' + projection.value.slice(placeholder.at),
            edit = projection.edit(source, inserted, { start: placeholder.from, end: placeholder.from }, 'insertText');
        assert.deepEqual(edit, { from: placeholder.from, to: placeholder.from, insert: 'x\r\n' });
        let next = source.slice(0, edit.from) + edit.insert + source.slice(edit.to),
            mapped = mapFolds(folds, [[edit]], next);
        assert.equal(mapped.length, 2);
        assert.deepEqual(
            mapped.map((f) => next.slice(f.from, f.to)),
            folds.map((f) => source.slice(f.from, f.to))
        );
    }
});

test('wrapped inline and multiline ellipses roundtrip geometry and original gutter numbers', () => {
    let source = '0123456789 { hidden } end\r\n{\r\n more\r\n}\r\nafter',
        folds = outerFolds(structures(source, 'typescript').folds),
        projection = new NativeText(source, folds),
        layout = new EditorLayout(projection, source, 42, 20, 7, 4, true);
    for (let placeholder of projection.placeholders())
        for (let native of [placeholder.at, placeholder.at + 1]) {
            let rect = layout.rect(native);
            assert.equal(projection.toSource(layout.offset(rect.left, rect.top + 10)), projection.toSource(native));
        }
    assert.deepEqual(
        layout.lines.map((line) => line.number),
        [1, 2, 5]
    );
});

test('nested JSX and multiline template interpolations expose expression braces without literal false pairs', () => {
    for (let language of ['jsx', 'tsx', 'javascript', 'typescript']) {
        let source =
                'const node = <Box title="literal }">don\'t {items.map(item => {\n return <Inner>{`hello ${item.ok ? {value: `nested ${item.id}`} : "}"}`}</Inner>;\n})}</Box>;',
            scan = structures(source, language);
        let opens = [...source.matchAll(/\{/g)]
            .map((m) => m.index)
            .filter((at) => !source.slice(0, at).endsWith('literal '));
        assert.ok(scan.pairs.some((pair) => pair.from === source.indexOf('{items')));
        assert.ok(scan.pairs.some((pair) => pair.from === source.indexOf('{value')));
        assert.ok(scan.pairs.some((pair) => pair.from === source.indexOf('{item.id')));
        assert.ok(scan.folds.some((fold) => fold.line === 1 && fold.endLine === 3));
        assert.ok(!scan.pairs.some((pair) => pair.to === source.indexOf('literal }') + 8));
        let state = '';
        for (let line of source.split('\n')) {
            let lex = highlightLine(line, language, state);
            state = lex.state;
            for (let token of lex.tokens) assert.ok(token.to > token.from && token.to <= line.length);
        }
        assert.equal(state, '');
    }
    let source = 'const s = `text ${\n (() => { return {ok: "}"}; })()\n} tail`;';
    assert.equal(structures(source, 'typescript').pairs.length, 6);
});
