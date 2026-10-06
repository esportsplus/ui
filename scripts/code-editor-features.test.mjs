import assert from 'node:assert/strict';
import test from 'node:test';
import './resolve.mjs';


const { changeLines, lineChanges, revertChange } = await import('../src/components/editor/code/changes.ts');
const { colorLiterals, formatColor, toHex } = await import('../src/components/editor/code/colors.ts');
const { detectIndent } = await import('../src/components/editor/code/commands.ts');
const { conflictsOf, resolveConflict, tints } = await import('../src/components/editor/code/conflicts.ts');
const { EditorDocument } = await import('../src/components/editor/code/document.ts');
const { stickyFolds, structures } = await import('../src/components/editor/code/folding.ts');
const { chord, COMMANDS, keymap } = await import('../src/components/editor/code/keymap.ts');
const { linksIn } = await import('../src/components/editor/code/links.ts');
const { SyntaxCache } = await import('../src/components/editor/code/syntax.ts');
const { describeSuspect, suspects } = await import('../src/components/editor/code/unicode.ts');


const CONFLICT = [
    'before',
    '<<<<<<< HEAD',
    'ours 1',
    'ours 2',
    '||||||| base',
    'base 1',
    '=======',
    'theirs 1',
    '>>>>>>> feature',
    'after',
    ''
].join('\n');


function apply(text, edit) {
    return text.slice(0, edit.from) + edit.insert + text.slice(edit.to);
}

function key(key, extra = {}) {
    return { altKey: false, code: '', ctrlKey: false, key, metaKey: false, shiftKey: false, ...extra };
}

// Color literals of the first line, as the editor finds them from that line's tokens.
function literals(text, language) {
    let cache = new SyntaxCache(new EditorDocument(text), language);

    return colorLiterals(text.split('\n')[0], cache.lineTokens(0), language).map((literal) => literal.value);
}


test('conflictsOf reads each side, the base and the block span', () => {
    let [block] = conflictsOf(CONFLICT);

    assert.equal(block.line, 2);
    assert.equal(block.middle, 5);
    assert.equal(block.divider, 7);
    assert.equal(block.close, 9);
    assert.equal(block.current, 'ours 1\nours 2\n');
    assert.equal(block.base, 'base 1\n');
    assert.equal(block.incoming, 'theirs 1\n');
    assert.equal(CONFLICT.slice(block.start, block.end), CONFLICT.split('after')[0].slice('before\n'.length));
});

test('conflictsOf handles two-way blocks, CRLF, several blocks and malformed markers', () => {
    let text = 'a\r\n<<<<<<< ours\r\nx\r\n=======\r\ny\r\n>>>>>>> theirs\r\nb\r\n<<<<<<<\r\n=======\r\nz\r\n>>>>>>>\r\n',
        blocks = conflictsOf(text);

    assert.equal(blocks.length, 2);
    assert.equal(blocks[0].base, null);
    assert.equal(blocks[0].current, 'x\r\n');
    assert.equal(blocks[0].incoming, 'y\r\n');
    assert.equal(blocks[1].current, '');
    assert.equal(blocks[1].incoming, 'z\r\n');
    assert.equal(blocks[1].end, text.length);

    assert.deepEqual(conflictsOf('<<<<<<< a\nx\n=======\ny\n'), []);
    assert.deepEqual(conflictsOf('<<<<<<<< a\nx\n=======\ny\n>>>>>>> b\n'), []);
    assert.deepEqual(conflictsOf('<<<<<<< a\nx\n======= label\ny\n>>>>>>> b\n'), []);
    assert.deepEqual(conflictsOf('no markers'), []);
});

test('resolveConflict keeps a side, both or given text as one edit', () => {
    let [block] = conflictsOf(CONFLICT);

    assert.equal(apply(CONFLICT, resolveConflict(CONFLICT, block, 'current')), 'before\nours 1\nours 2\nafter\n');
    assert.equal(apply(CONFLICT, resolveConflict(CONFLICT, block, 'incoming')), 'before\ntheirs 1\nafter\n');
    assert.equal(apply(CONFLICT, resolveConflict(CONFLICT, block, 'both')), 'before\nours 1\nours 2\ntheirs 1\nafter\n');
    assert.equal(apply(CONFLICT, resolveConflict(CONFLICT, block, 'merged\n')), 'before\nmerged\nafter\n');
});

test('resolveConflict adds no line break when the block ends the text', () => {
    let text = 'a\n<<<<<<< ours\nx\n=======\ny\n>>>>>>> theirs',
        [block] = conflictsOf(text);

    assert.equal(apply(text, resolveConflict(text, block, 'incoming')), 'a\ny');
    assert.equal(apply(text, resolveConflict(text, block, 'both')), 'a\nx\ny');
});

test('tints marks every line of a block by side', () => {
    let map = tints(conflictsOf(CONFLICT));

    assert.deepEqual([...map.entries()], [
        [2, 'current'],
        [3, 'current'],
        [4, 'current'],
        [5, 'base'],
        [6, 'base'],
        [7, 'divider'],
        [8, 'incoming'],
        [9, 'incoming']
    ]);
});

test('colorLiterals finds CSS values: hex, functions and named colors', () => {
    assert.deepEqual(literals('a { color: #fff; background: rgb(1 2 3 / 50%); border-color: rebeccapurple; }', 'css'), [
        '#fff',
        'rgb(1 2 3 / 50%)',
        'rebeccapurple'
    ]);
    assert.deepEqual(literals('.x { color: hsl(120, 50%, 50%); outline: 1px solid red; }', 'scss'), ['hsl(120, 50%, 50%)', 'red']);
});

test('colorLiterals skips selectors, invalid hex and non-color words', () => {
    assert.deepEqual(literals('#add { width: 10px; color: #12345; display: block; }', 'css'), []);
    assert.deepEqual(literals('a { color: var(--red); background: url(red.png); }', 'css'), []);
});

test('colorLiterals finds hex and color functions in string literals only', () => {
    assert.deepEqual(literals(`const accent = '#ff8800', other = "oklch(70% 0.1 200)", hash = 0; // #123456`, 'typescript'), [
        '#ff8800',
        'oklch(70% 0.1 200)'
    ]);
    assert.deepEqual(literals(`const issue = '#12 and &#123;';`, 'typescript'), []);
    assert.deepEqual(literals('<p style="color: red; background: #000">red</p>', 'html'), ['red', '#000']);
});

test('toHex resolves hex, rgb() and hsl(); formatColor keeps the notation', () => {
    assert.equal(toHex('#abc'), '#AABBCC');
    assert.equal(toHex('#AABBCC80'), '#AABBCC80');
    assert.equal(toHex('rgb(255, 0, 0)'), '#FF0000');
    assert.equal(toHex('rgba(0 128 255 / 50%)'), '#0080FF80');
    assert.equal(toHex('hsl(120deg 100% 50%)'), '#00FF00');
    assert.equal(toHex('oklch(70% 0.1 200)'), null);

    assert.equal(formatColor('#abc', '#112233'), '#112233');
    assert.equal(formatColor('#ABC', '#112233'), '#112233');
    assert.equal(formatColor('#abcdef', '#AABBCC'), '#aabbcc');
    assert.equal(formatColor('rgb(1, 2, 3)', '#FF000080'), 'rgba(255, 0, 0, 0.5)');
    assert.equal(formatColor('rgb(1 2 3)', '#00FF00'), 'rgb(0 255 0)');
    assert.equal(formatColor('hsl(0, 0%, 0%)', '#FF0000'), 'hsl(0, 100%, 50%)');
    assert.equal(formatColor('red', '#00FF00'), '#00FF00');
});

test('suspects finds invisible, bidirectional and look-alike characters', () => {
    let text = 'let a​ = "‮"; let pаssword = 1; let привет = 2;',
        found = suspects(text);

    assert.deepEqual(found.map((item) => [item.kind, item.code]), [
        ['invisible', 0x200b],
        ['bidi', 0x202e],
        ['confusable', 0x0430]
    ]);
    assert.equal(text[found[2].from], 'а');
    assert.match(describeSuspect(found[0]), /U\+200B zero width space/);
    assert.match(describeSuspect(found[2]), /Cyrillic letter that looks like the ASCII 'a'/);
    assert.deepEqual(suspects('plain ascii text'), []);
    assert.deepEqual(suspects('a b').map((item) => item.kind), ['invisible']);
});

test('linksIn finds URLs, trimming punctuation, and local paths only on request', () => {
    let text = 'See https://example.com/a_(b). or (http://x.dev/path), file:///tmp/a.txt and ./src/view.ts';

    assert.deepEqual(linksIn(text, false).map((link) => link.url), ['https://example.com/a_(b)', 'http://x.dev/path']);
    assert.deepEqual(linksIn(text, true).map((link) => link.url), [
        'https://example.com/a_(b)',
        'http://x.dev/path',
        'file:///tmp/a.txt',
        './src/view.ts'
    ]);

    let [first] = linksIn(text, false);

    assert.equal(text.slice(first.from, first.to), first.url);
});

test('keymap merges keybinding overrides over the defaults', () => {
    let windows = keymap(false, { 'ctrl+shift+K': 'nextProblem', 'Ctrl+Z': null, 'F8': null, 'mod+e': 'bogus' }),
        apple = keymap(true, { 'Cmd+Alt+n': 'nextChange', 'Ctrl+k': null });

    assert.equal(windows(key('k', { ctrlKey: true, shiftKey: true })), 'nextProblem');
    assert.equal(windows(key('z', { ctrlKey: true })), null);
    assert.equal(windows(key('F8')), null);
    assert.equal(windows(key('F8', { shiftKey: true })), 'previousProblem');
    assert.equal(windows(key('e', { ctrlKey: true })), null);
    assert.equal(windows(key('y', { ctrlKey: true })), 'redo');
    assert.equal(windows(key('F5', { altKey: true })), 'nextChange');
    assert.equal(windows(key('F8', { altKey: true, shiftKey: true })), 'previousConflict');

    assert.equal(apple(key('n', { altKey: true, metaKey: true })), 'nextChange');
    assert.equal(apple(key('k', { ctrlKey: true })), null);
    assert.equal(apple(key('e', { ctrlKey: true })), 'lineEnd');
});

test('chord spells keys the way keydowns are matched', () => {
    assert.equal(chord('shift+ctrl+K', false), 'Mod+Shift+k');
    assert.equal(chord('Ctrl+K', true), 'Ctrl+k');
    assert.equal(chord('Cmd+Option+up', true), 'Mod+Alt+ArrowUp');
    assert.equal(chord('Cmd+a', false), 'Meta+a');
    assert.equal(chord('Mod++', false), 'Mod++');
    assert.equal(chord('f8', false), 'F8');
    assert.equal(chord('Hyper+x', false), null);
});

test('commands lists every command with its label and default keys', () => {
    let byId = new Map(COMMANDS.map((command) => [command.id, command]));

    assert.deepEqual(byId.get('nextChange').keys, ['Alt+F5']);
    assert.deepEqual(byId.get('previousChange').keys, ['Alt+Shift+F5']);
    assert.deepEqual(byId.get('nextProblem').keys, ['F8']);
    assert.deepEqual(byId.get('previousProblem').keys, ['Shift+F8']);
    assert.deepEqual(byId.get('nextConflict').keys, ['Alt+F8']);
    assert.deepEqual(byId.get('previousConflict').keys, ['Alt+Shift+F8']);
    assert.deepEqual(byId.get('undo').keys, ['Mod+z']);
    assert.ok(COMMANDS.every((command) => typeof command.label === 'string' && command.label.length > 0));
    assert.equal(new Set(COMMANDS.map((command) => command.id)).size, COMMANDS.length);
});

test('lineChanges reports added, modified and deleted runs against the baseline', () => {
    let changes = lineChanges('a\nb\nc\nd\ne\n', 'a\nB\nc\nx\ny\nd\n');

    assert.deepEqual(changes, [
        { from: 1, kind: 'modified', original: { from: 1, to: 2 }, to: 2 },
        { from: 3, kind: 'added', original: { from: 3, to: 3 }, to: 5 },
        { from: 6, kind: 'deleted', original: { from: 4, to: 5 }, to: 6 }
    ]);
    assert.deepEqual([...changeLines(changes, 7).entries()], [[1, 'modified'], [3, 'added'], [4, 'added'], [6, 'deleted']]);
    assert.deepEqual(lineChanges('same\n', 'same\n'), []);
});

test('revertChange puts the baseline lines back, at the end of the text too', () => {
    let check = (baseline, text) => {
        let changes = lineChanges(baseline, text),
            doc = new EditorDocument(text);

        for (let i = changes.length - 1; i >= 0; i--) {
            doc.transact([revertChange(baseline, doc.value, changes[i], doc.eol)]);
        }

        assert.equal(doc.value, baseline);
    };

    check('a\nb\nc\nd\ne\n', 'a\nB\nc\nx\ny\nd\n');
    check('a\nb', 'a\nb\nc');
    check('a\nb\nc', 'a\nb');
    check('a\nb', 'a\nc');
    check('', 'x\ny');
    check('x\ny', '');
    check('a\r\nb\r\n', 'a\r\nz\r\nb\r\n');
});

test('detectIndent reads tabs or the most common step', () => {
    assert.deepEqual(detectIndent('a {\n  b {\n    c;\n  }\n}\n'), { size: 2, tabs: false });
    assert.deepEqual(detectIndent('a {\n    b;\n    c;\n}\n/**\n * doc\n */\n'), { size: 4, tabs: false });
    assert.deepEqual(detectIndent('a {\n\tb;\n\tc;\n}\n'), { size: 0, tabs: true });
    assert.equal(detectIndent('flat\ntext\n'), null);
});

test('stickyFolds pins the enclosing headers of the top line, outermost first', () => {
    let text = [
            'class A {',
            '    method() {',
            '        if (x) {',
            '            one();',
            '            two();',
            '            three();',
            '        }',
            '    }',
            '    other() {',
            '        four();',
            '    }',
            '}'
        ].join('\n'),
        folds = structures(text, 'typescript').folds;

    assert.deepEqual(stickyFolds(folds, 4, 5).map((fold) => fold.line), [1, 2, 3]);
    assert.deepEqual(stickyFolds(folds, 4, 2).map((fold) => fold.line), [1, 2]);
    assert.deepEqual(stickyFolds(folds, 10, 5).map((fold) => fold.line), [1]);
    assert.deepEqual(stickyFolds(folds, 1, 5), []);
});
