import assert from 'node:assert/strict';
import test from 'node:test';
import './resolve.mjs';
const { bind, conflict, declare, fromChord, fromRecorder, label, matches, merge, reset, rows, sanitize, sequence, unassign } =
    await import('../src/components/editor/workspace/keybindings.ts');
const { COMMANDS, keymap } = await import('../src/components/editor/code/keymap.ts');
const { EditorWorkspaceModel } = await import('../src/components/editor/workspace/model.ts');
const { createMemoryWorkspaceHost } = await import('../docs/src/examples/code-editor/fixtures/workspace.ts');
const find = (list, id) => list.find((row) => row.id === id);
const key = (key, modifiers = {}) => {
    const event = {
        altKey: false,
        code: '',
        ctrlKey: false,
        defaultPrevented: false,
        isComposing: false,
        key,
        metaKey: false,
        propagationStopped: false,
        shiftKey: false,
        target: null,
        ...modifiers,
        preventDefault() {
            event.defaultPrevented = true;
        },
        stopPropagation() {
            event.propagationStopped = true;
        }
    };
    return event;
};
// What the editor's keymap runs for a keydown under these keybindings.
const runs = (keybindings, event) => keymap(false, keybindings)(event);

test('rows list every command with its default chords and source', () => {
    const list = rows({}, false);
    assert.equal(list.length, COMMANDS.length);
    assert.deepEqual(find(list, 'undo'), { builtin: [], chords: ['Mod+z'], id: 'undo', label: 'Undo', user: false });
    assert.deepEqual(find(list, 'selectAllOccurrences').chords, ['Mod+Shift+a', 'Mod+Shift+l']);
    assert.ok(list.every((row) => !row.user));
});

test('bind replaces a command\'s chords and the result drives the editor keymap', () => {
    const next = bind({}, false, 'undo', 'Ctrl+Alt+u');
    assert.deepEqual(next, { 'Mod+Alt+u': 'undo', 'Mod+z': null });
    const row = find(rows(next, false), 'undo');
    assert.deepEqual(row.chords, ['Mod+Alt+u']);
    assert.equal(row.user, true);
    assert.equal(runs(next, key('u', { altKey: true, ctrlKey: true })), 'undo');
    assert.equal(runs(next, key('z', { ctrlKey: true })), null);
});

test('binding a chord back to its default leaves no override behind', () => {
    const moved = bind({}, false, 'undo', 'Mod+Alt+u');
    assert.deepEqual(bind(moved, false, 'undo', 'Mod+z'), {});
});

test('conflicts name the other owner; taking the chord unbinds it from that command only', () => {
    assert.equal(conflict({}, false, 'undo', 'Mod+d'), 'nextOccurrence');
    assert.equal(conflict({}, false, 'undo', 'Mod+z'), null);
    assert.equal(conflict({}, false, 'undo', 'Mod+Alt+F12'), null);
    const next = bind({}, false, 'undo', 'Mod+d');
    assert.equal(find(rows(next, false), 'nextOccurrence').chords.length, 0);
    assert.equal(find(rows(next, false), 'nextOccurrence').user, true);
    assert.equal(runs(next, key('d', { ctrlKey: true })), 'undo');
    const occurrences = bind({}, false, 'undo', 'Mod+Shift+l');
    assert.deepEqual(find(rows(occurrences, false), 'selectAllOccurrences').chords, ['Mod+Shift+a']);
});

test('unassign removes defaults and user chords; reset restores one command; others keep taken chords', () => {
    const cleared = unassign(bind({}, false, 'redo', 'Mod+Alt+r'), false, 'redo');
    assert.deepEqual(find(rows(cleared, false), 'redo').chords, []);
    assert.deepEqual(cleared, { 'Mod+Shift+z': null, 'Mod+y': null });
    assert.deepEqual(reset(cleared, false, 'redo'), {});
    const taken = bind(bind({}, false, 'undo', 'Mod+d'), false, 'nextOccurrence', 'Mod+Alt+n');
    const restored = reset(taken, false, 'nextOccurrence');
    assert.deepEqual(restored, { 'Mod+d': 'undo', 'Mod+z': null });
    assert.deepEqual(find(rows(restored, false), 'nextOccurrence').chords, []);
    assert.deepEqual(reset(restored, false, 'undo'), {});
});

test('bind leaves keybindings alone for a chord that does not parse', () => {
    const keybindings = { 'Mod+z': null };
    assert.equal(bind(keybindings, false, 'undo', 'Hyper+z'), keybindings);
});

test('recorder values convert to keymap chords and back on both platforms', () => {
    assert.equal(fromRecorder('Mod+Shift+K', false), 'Mod+Shift+k');
    assert.equal(fromRecorder('Mod+Alt+↓', false), 'Mod+Alt+ArrowDown');
    assert.equal(fromRecorder('Mod+↵', false), 'Mod+Enter');
    assert.equal(fromRecorder('Mod+Shift+{', false), 'Mod+Shift+[');
    assert.equal(fromRecorder('Mod++', false), 'Mod++');
    assert.equal(fromRecorder('Ctrl+Alt+Shift+Mod+K', true), 'Mod+Ctrl+Alt+Shift+k');
    assert.equal(fromRecorder('', false), null);
    assert.equal(fromChord('Mod+Alt+ArrowDown', false), 'Mod+Alt+↓');
    assert.equal(fromChord('Mod+Ctrl+Alt+Shift+k', true), 'Ctrl+Alt+Shift+Mod+K');
    assert.equal(fromChord('Mod+Enter', false), 'Mod+↵');
    for (const { keys } of COMMANDS)
        for (const chord of keys)
            for (const apple of [false, true]) {
                const normalized = fromRecorder(fromChord(chord, apple), apple);
                assert.equal(fromRecorder(fromChord(normalized, apple), apple), normalized, chord);
            }
});

test('labels read like the platform writes shortcuts', () => {
    assert.equal(label('Mod+Shift+k', false), 'Ctrl+Shift+K');
    assert.equal(label('Mod+Shift+k', true), '⇧⌘K');
    assert.equal(label('Mod++', false), 'Ctrl++');
    assert.equal(label('Alt+ArrowUp', true), '⌥↑');
});

test('search matches label, command id or chord in any spelling', () => {
    const undo = find(rows({}, false), 'undo');
    for (const query of ['', 'und', 'UNDO', 'mod+z', 'ctrl+z', '  Undo '])
        assert.ok(matches(undo, query, false), query);
    assert.ok(matches(undo, '⌘Z', true));
    assert.ok(!matches(undo, 'redo', false));
    assert.ok(!matches(undo, 'ctrl+y', false));
});

test('sanitize keeps parseable chords bound to known commands or null', () => {
    assert.deepEqual(sanitize({ 'Mod+z': 'undo', 'Mod+q': null, 'Mod+x': 'explode', 'Hyper+z': 'undo', 'Mod+e': 4 }), {
        'Mod+q': null,
        'Mod+z': 'undo'
    });
    for (const value of [undefined, null, 'Mod+z', ['undo'], 4])
        assert.deepEqual(sanitize(value), {});
});

test('merge lays the user keybindings over the editor options and keeps identity when there are none', () => {
    const user = { 'Mod+z': null };
    assert.equal(merge(undefined, user), user);
    assert.deepEqual(merge({ 'Mod+z': 'redo', F2: 'toggleComment' }, user), { 'Mod+z': null, F2: 'toggleComment' });
});

test('model validates keybindings on load and in setPreferences, keeping the other preferences', async (t) => {
    const host = createMemoryWorkspaceHost({ 'a.ts': 'a' }),
        written = [];
    host.preferences = {
        get: async () => ({ keybindings: { 'Mod+z': 'undo', 'Mod+x': 'bogus', F2: 'toggleComment' }, wrapText: true }),
        set: async (value) => {
            written.push(value);
        }
    };
    const model = new EditorWorkspaceModel(host, '/project', { keybindings: { 'Mod+y': 'nope' } });
    t.after(() => model.dispose());
    assert.deepEqual(model.state.preferences.keybindings, {});
    await model.start();
    assert.deepEqual(model.state.preferences.keybindings, { 'Mod+z': 'undo', F2: 'toggleComment' });
    assert.equal(model.state.preferences.wrapText, true);
    const before = model.state.preferences.keybindings;
    model.setPreferences({ showWhitespace: true });
    assert.equal(model.state.preferences.keybindings, before);
    model.setPreferences({ keybindings: { 'Mod+k': 'deleteLine', 'Mod+j': 'unknown' } });
    assert.deepEqual(model.state.preferences.keybindings, { 'Mod+k': 'deleteLine' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.deepEqual(written.at(-1).keybindings, { 'Mod+k': 'deleteLine' });
});

test('sequence waits for the second chord, consumes it, and times out', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let opened = 0,
        accepting = true;
    const states = [],
        chords = sequence({
            accept: () => accepting,
            actions: { 'Mod+s': () => opened++ },
            apple: false,
            onpending: (pending) => states.push(pending),
            prefix: 'Mod+k'
        });
    const plain = key('s', { ctrlKey: true });
    chords.keydown(plain);
    assert.equal(plain.defaultPrevented, false);
    const first = key('k', { ctrlKey: true });
    chords.keydown(first);
    assert.ok(first.defaultPrevented && first.propagationStopped);
    assert.equal(chords.pending(), true);
    chords.keydown(key('Control', { ctrlKey: true }));
    assert.equal(chords.pending(), true);
    const second = key('s', { ctrlKey: true });
    chords.keydown(second);
    assert.ok(second.defaultPrevented && second.propagationStopped);
    assert.equal(opened, 1);
    assert.deepEqual(states, [true, false]);
    chords.keydown(key('k', { ctrlKey: true }));
    const other = key('x');
    chords.keydown(other);
    assert.ok(other.defaultPrevented);
    assert.equal(opened, 1);
    chords.keydown(key('k', { ctrlKey: true }));
    t.mock.timers.tick(1500);
    assert.equal(chords.pending(), false);
    assert.deepEqual(states, [true, false, true, false, true, false]);
    accepting = false;
    const outside = key('k', { ctrlKey: true });
    chords.keydown(outside);
    assert.equal(outside.defaultPrevented, false);
    assert.equal(chords.pending(), false);
    accepting = true;
    chords.keydown(key('k', { metaKey: true }));
    assert.equal(chords.pending(), false);
    const apple = sequence({ accept: () => true, actions: { 'Mod+s': () => opened++ }, apple: true, prefix: 'Mod+k' });
    apple.keydown(key('k', { metaKey: true }));
    apple.keydown(key('s', { metaKey: true }));
    assert.equal(opened, 2);
    chords.keydown(key('k', { ctrlKey: true }));
    chords.cancel();
    assert.equal(chords.pending(), false);
});

test('sequence leaves a prefix it does not accept, and the key after it, untouched', () => {
    let opened = 0;
    const seen = [],
        chords = sequence({
            accept: (event) => {
                seen.push(event.target);
                return event.target === 'inside';
            },
            actions: { 'Mod+s': () => opened++ },
            apple: false,
            onpending: () => assert.fail('no chord should be pending'),
            prefix: 'Mod+k'
        });
    for (const event of [key('k', { ctrlKey: true, target: 'outside' }), key('s', { ctrlKey: true, target: 'outside' }), key('a', { target: 'outside' })]) {
        chords.keydown(event);
        assert.equal(event.defaultPrevented, false);
        assert.equal(event.propagationStopped, false);
    }
    assert.deepEqual(seen, ['outside']);
    assert.equal(chords.pending(), false);
    assert.equal(opened, 0);
});

test('built-in keys show read-only on commands the keymap leaves out, and count as conflicts', () => {
    const list = rows({}, false);
    for (const row of list)
        assert.ok(row.chords.length || row.builtin.length || ['deleteLineEnd', 'splitLine', 'transpose'].includes(row.id), row.id);
    assert.deepEqual(find(list, 'deleteCharacterBackward'), {
        builtin: ['Backspace'],
        chords: [],
        id: 'deleteCharacterBackward',
        label: 'Delete character before',
        user: false
    });
    assert.deepEqual(find(list, 'deleteWordBackward').builtin, ['Mod+Backspace']);
    assert.deepEqual(find(list, 'autocomplete').builtin, ['Mod+ ']);
    assert.deepEqual(find(rows({}, true), 'deleteWordBackward').builtin, ['Alt+Backspace', 'Ctrl+Alt+h']);
    assert.deepEqual(find(rows({}, true), 'deleteLineEnd').builtin, ['Ctrl+k']);
    for (const row of rows({}, true))
        assert.ok(row.chords.length || row.builtin.length, row.id);
    assert.equal(label('Mod+ ', false), 'Ctrl+Space');
    assert.ok(matches(find(list, 'deleteCharacterForward'), 'delete', false));
    assert.ok(matches(find(list, 'autocomplete'), 'ctrl+space', false));
    assert.equal(conflict({}, false, 'undo', 'Backspace'), 'deleteCharacterBackward');
    assert.equal(conflict({}, false, 'deleteCharacterBackward', 'Backspace'), null);
    const taken = bind({}, false, 'undo', 'Mod+Backspace');
    assert.deepEqual(find(rows(taken, false), 'deleteWordBackward').builtin, []);
    assert.equal(find(rows(taken, false), 'deleteWordBackward').user, false);
    const added = bind({}, false, 'deleteCharacterBackward', 'Mod+Alt+b');
    const row = find(rows(added, false), 'deleteCharacterBackward');
    assert.deepEqual([row.chords, row.builtin, row.user], [['Mod+Alt+b'], ['Backspace'], true]);
    assert.deepEqual(unassign(added, false, 'deleteCharacterBackward'), {});
    assert.deepEqual(reset(added, false, 'deleteCharacterBackward'), {});
});

test('declare adds both Mod+K forms to aria-keyshortcuts and keeps what is there', () => {
    assert.equal(declare(null, 'Mod+k'), 'Control+K Meta+K');
    assert.equal(declare('', 'Mod+k'), 'Control+K Meta+K');
    assert.equal(declare('Alt+L  control+k', 'Mod+k'), 'Alt+L control+k Meta+K');
    assert.equal(declare(declare('F2', 'Mod+k'), 'Mod+k'), 'F2 Control+K Meta+K');
});
