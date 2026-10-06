import { effect, reactive, untrack } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { editor, icon, select, switch as toggle } from '@esportsplus/ui/components';
import { EditorDocument } from '@esportsplus/ui/components/editor';
import { mac } from '@esportsplus/ui/shared/platform';
import bold from '@esportsplus/ui/svg/bold.svg';
import italic from '@esportsplus/ui/svg/italic.svg';
import plus from '@esportsplus/ui/svg/plus.svg';
import redo from '@esportsplus/ui/svg/redo.svg';
import save from '@esportsplus/ui/svg/save.svg';
import search from '@esportsplus/ui/svg/search.svg';
import undo from '@esportsplus/ui/svg/undo.svg';
import type { Controller, MarkdownController, Selection } from '@esportsplus/ui/components/editor';
import type { Entry } from 'docs/types';
import { samples, workspaceFiles } from './fixtures/files';
import { demoLanguageTransport } from './fixtures/language';
import { workspaceExample } from './workspace-example';
import 'docs/examples/code-editor/scss/index.scss';


type Hint = {
    keys: string[];
    label: string;
};


const APPLE: Record<string, string> = {
    Alt: '⌥',
    Ctrl: '⌃',
    Mod: '⌘',
    Shift: '⇧'
};

const GLYPHS: Record<string, string> = {
    ArrowDown: '↓',
    ArrowUp: '↑',
    Mod: 'Ctrl'
};

const LANGUAGES = [
    { detail: 'greeting.ts', label: 'TypeScript', value: 'src/greeting.ts' },
    { detail: 'card.tsx', label: 'TSX', value: 'src/card.tsx' },
    { detail: 'reset.css', label: 'CSS', value: 'src/reset.css' },
    { detail: 'theme.scss', label: 'SCSS', value: 'src/theme.scss' },
    { detail: 'index.html', label: 'HTML', value: 'src/index.html' },
    { detail: 'package.json', label: 'JSON', value: 'package.json' },
    { detail: 'report.py', label: 'Python', value: 'scripts/report.py' },
    { detail: 'README.md', label: 'Markdown', value: 'README.md' }
] as const;

const SECTIONS = Array.from(
    { length: 1500 },
    (_, i) => `## Section ${i + 1}\n\nParagraph ${i + 1} with **bold** text and a [link](https://example.com).\n\n`
).join('');


function action(label: string, run: VoidFunction, glyph?: string) {
    return html`
        <button class='button --background-white --border-border --color-text code-editor-demo-action' onclick='${run}' type='button'>
            ${glyph && icon({ 'aria-hidden': 'true', class: 'code-editor-demo-icon' }, glyph)}
            ${label}
        </button>
    `;
}

// Every range of 'word' in 'text', as selections.
function all(text: string, word: string) {
    let ranges: Partial<Selection>[] = [];

    for (let at = text.indexOf(word); at !== -1; at = text.indexOf(word, at + word.length)) {
        ranges.push({ end: at + word.length, start: at });
    }

    return ranges;
}

// One shortcut as keycaps, in the platform's own names; 'button.kbd' would also light up on presses, which a list of
// shortcuts sharing modifiers doesn't want.
function chord(keys: string) {
    return html`
        <kbd class='button-kbd'>
            ${keys.split('+').map((key, i) => html`
                ${i > 0 && icon({ 'aria-hidden': true, class: 'button-kbd-plus' }, plus)}
                <kbd class='button button--kbd'>${(mac() ? APPLE[key] : undefined) ?? GLYPHS[key] ?? key}</kbd>
            `)}
        </kbd>
    `;
}

// The hex color on each line that has one: a rectangle, since the fixture aligns them in one column.
function column(text: string) {
    let ranges: Partial<Selection>[] = [];

    for (let line = 0, offset = 0, lines = text.split('\n'), n = lines.length; line < n; line++) {
        let at = lines[line].indexOf('#');

        if (at !== -1) {
            ranges.push({ end: offset + at + 7, start: offset + at });
        }

        offset += lines[line].length + 1;
    }

    return ranges;
}

function editing() {
    let document = new EditorDocument(samples.editing),
        controller: Controller | undefined,
        state = reactive({ dirty: false, position: 'Ln 1, Col 1' });

    return html`
        <div class='code-editor-demo'>
            <div class='code-editor-demo-actions'>
                ${action('Undo', () => controller?.undo(), undo)}
                ${action('Redo', () => controller?.redo(), redo)}
                ${action('Find', () => controller?.openFind(), search)}
                ${action('Replace', () => controller?.openFind(true))}
                ${action('Go to line', () => controller?.openGoToLine())}
                ${action('Save', () => controller?.save(), save)}
            </div>
            ${editor.code({
                controller: (value) => {
                    controller = value;
                },
                document,
                onChange: (_, __, snapshot) => {
                    state.dirty = snapshot.dirty;
                },
                onSave: () => {
                    document.markSaved();
                    state.dirty = false;
                },
                onSelection: (_, position) => {
                    state.position = `Ln ${position.line}, Col ${position.column}`;
                },
                options: { fileName: 'greeting.ts', label: 'Editing example' }
            })}
            <div aria-live='polite' class='code-editor-demo-status'>
                <span>${() => state.dirty ? 'Unsaved changes' : 'Saved'}</span>
                <span>${() => state.position}</span>
            </div>
            ${hints([
                { keys: ['Mod+Z', 'Mod+Shift+Z'], label: 'Undo and redo' },
                { keys: ['Mod+F', 'Mod+H'], label: 'Find, find and replace' },
                { keys: ['Mod+Alt+G'], label: 'Go to line' },
                { keys: ['Mod+/'], label: 'Toggle a line comment' },
                { keys: ['Alt+ArrowUp', 'Alt+ArrowDown'], label: 'Move the line' },
                { keys: ['Escape', 'Tab'], label: 'Leave the editor (Tab indents)' }
            ])}
        </div>
    `;
}

// A switch named by the text beside it, which toggles it too.
function flag(label: string, value: () => boolean, change: (value: boolean) => void) {
    return html`
        <label class='code-editor-demo-field'>
            ${toggle({
                class: 'code-editor-demo-switch',
                [toggle.input]: {
                    checked: value,
                    onchange: (event: Event) => {
                        change((event.target as HTMLInputElement).checked);
                    }
                }
            })}
            ${label}
        </label>
    `;
}

function hints(list: Hint[]) {
    return html`
        <dl class='code-editor-demo-hints'>
            ${list.map(({ keys, label }) => html`
                <dt class='code-editor-demo-keys'>${keys.map(chord)}</dt>
                <dd class='code-editor-demo-hint'>${label}</dd>
            `)}
        </dl>
    `;
}

function languages() {
    let documents = new Map<string, EditorDocument>(),
        controller: Controller | undefined,
        state = reactive({ active: false, error: '', selected: LANGUAGES[0].value as string });

    // One editor, one document per sample: switching keeps each sample's draft, history, folds and scroll.
    function open(path: string) {
        let document = documents.get(path);

        if (!document) {
            document = new EditorDocument(workspaceFiles[path as keyof typeof workspaceFiles]);
            documents.set(path, document);
        }

        return document;
    }

    function settings(path: string) {
        return { fileName: path, label: `${path} source` };
    }

    effect(() => {
        let path = String(state.selected);

        untrack(() => controller?.setDocument(open(path), settings(path)));
    });

    return html`
        <div class='code-editor-demo'>
            <div class='code-editor-demo-actions'>
                <div class='code-editor-demo-field'>
                    <span aria-hidden='true'>Language</span>
                    ${select({ label: 'Language', options: LANGUAGES.map((language) => ({ ...language })), state })}
                </div>
            </div>
            ${editor.code({
                controller: (value) => {
                    controller = value;
                },
                document: open(LANGUAGES[0].value),
                options: settings(LANGUAGES[0].value)
            })}
            <p class='code-editor-demo-caption'>
                The language follows the file name. Switching hands the same editor another document, so each sample
                keeps its own draft, undo history, folds and scroll position.
            </p>
        </div>
    `;
}

function markdown() {
    let document = new EditorDocument(workspaceFiles['README.md']),
        controller: MarkdownController | undefined,
        state = reactive({ dirty: false, minimap: false });

    return html`
        <div class='code-editor-demo'>
            <div class='code-editor-demo-actions'>
                ${action('Bold', () => controller?.bold(), bold)}
                ${action('Italic', () => controller?.italic(), italic)}
                ${action('Undo', () => controller?.undo(), undo)}
                ${action('Redo', () => controller?.redo(), redo)}
                ${action('Load 1,500 sections', () => controller?.setValue(SECTIONS))}
                ${action('Restore', () => controller?.setValue(workspaceFiles['README.md']))}
                ${flag('Minimap', () => state.minimap, (value) => {
                    state.minimap = value;
                })}
            </div>
            ${editor.markdown({
                class: 'code-editor-demo-editor code-editor-demo-editor--tall',
                controller: (value) => {
                    controller = value;
                },
                document,
                onChange: (_, __, snapshot) => {
                    state.dirty = snapshot.dirty;
                },
                onSave: () => {
                    document.markSaved();
                    state.dirty = false;
                },
                options: () => ({ label: 'Markdown example', minimap: state.minimap })
            })}
            <div aria-live='polite' class='code-editor-demo-status'>
                <span>${() => state.dirty ? 'Unsaved changes' : 'Saved'}</span>
            </div>
            ${hints([
                { keys: ['Mod+B', 'Mod+I'], label: 'Bold and italic' },
                { keys: ['Mod+Z', 'Mod+Shift+Z'], label: 'Undo and redo, across blocks' },
                { keys: ['Mod+S'], label: 'Save' }
            ])}
            <p class='code-editor-demo-caption'>
                Click a block to edit its Markdown source; the rest stay rendered. Task checkboxes toggle in place and
                every edit lands in the same document and undo history.
            </p>
        </div>
    `;
}

function multiple() {
    let document = new EditorDocument(samples.palette),
        controller: Controller | undefined,
        state = reactive({ selections: 1 });

    function pick(ranges: Partial<Selection>[]) {
        controller?.selectMany(ranges);
        controller?.focus();
    }

    return html`
        <div class='code-editor-demo'>
            <div class='code-editor-demo-actions'>
                ${action('Select every “swatch”', () => pick(all(document.value, 'swatch')))}
                ${action('Select the color column', () => pick(column(document.value)))}
            </div>
            ${editor.code({
                controller: (value) => {
                    controller = value;
                },
                document,
                onSelection: () => {
                    state.selections = document.state.selections.length;
                },
                options: { fileName: 'swatches.css', label: 'Multiple cursors example' }
            })}
            <div aria-live='polite' class='code-editor-demo-status'>
                <span>${() => state.selections === 1 ? '1 selection' : `${state.selections} selections`}</span>
            </div>
            ${hints([
                { keys: ['Alt+Click'], label: 'Add a caret' },
                { keys: ['Alt+Shift+Drag'], label: 'Select a rectangle' },
                { keys: ['Mod+Alt+ArrowUp', 'Mod+Alt+ArrowDown'], label: 'Add a caret above or below' },
                { keys: ['Mod+D'], label: 'Add the next occurrence' },
                { keys: ['Mod+Shift+L'], label: 'Select every occurrence' },
                { keys: ['Mod+U'], label: 'Undo the last selection change' }
            ])}
        </div>
    `;
}

function services() {
    return html`
        <div class='code-editor-demo'>
            ${editor.code({
                options: {
                    fileName: 'services.ts',
                    label: 'Language services example',
                    services: { cwd: '/demo', transport: demoLanguageTransport() }
                },
                value: samples.services
            })}
            ${hints([
                { keys: ['Ctrl+Space'], label: 'Complete the word at the caret, as after “gre”' },
                { keys: ['Escape'], label: 'Close completions' }
            ])}
            <p class='code-editor-demo-caption'>
                A sample server in the page answers over the same transport a real language server would: hover
                <code>person</code>, <code>greet</code> or <code>Person</code> for their types, and replace
                <code>TODO_ERROR</code> with a number to clear its diagnostic.
            </p>
        </div>
    `;
}

function view() {
    let controller: Controller | undefined,
        state = reactive({ fold: true, lineNumbers: true, minimap: true, whitespace: false, wrap: false }),
        tabs = reactive({ active: false, error: '', selected: '4' });

    return html`
        <div class='code-editor-demo'>
            <div class='code-editor-demo-actions'>
                ${flag('Wrap', () => state.wrap, (value) => {
                    state.wrap = value;
                })}
                ${flag('Whitespace', () => state.whitespace, (value) => {
                    state.whitespace = value;
                })}
                ${flag('Folding', () => state.fold, (value) => {
                    state.fold = value;
                })}
                ${flag('Minimap', () => state.minimap, (value) => {
                    state.minimap = value;
                })}
                ${flag('Line numbers', () => state.lineNumbers, (value) => {
                    state.lineNumbers = value;
                })}
                <div class='code-editor-demo-field'>
                    <span aria-hidden='true'>Tab size</span>
                    ${select({ label: 'Tab size', options: { 2: '2', 4: '4', 8: '8' }, state: tabs })}
                </div>
            </div>
            <div class='code-editor-demo-actions'>
                ${action('Fold all', () => controller?.foldAll())}
                ${action('Unfold all', () => controller?.unfoldAll())}
            </div>
            ${editor.code({
                class: 'code-editor-demo-editor code-editor-demo-editor--tall',
                controller: (value) => {
                    controller = value;
                },
                options: () => ({
                    fileName: 'layout.ts',
                    fold: state.fold,
                    indent: '\t',
                    label: 'View options example',
                    lineNumbers: state.lineNumbers,
                    minimap: state.minimap,
                    tabSize: Number(tabs.selected),
                    whitespace: state.whitespace,
                    wrap: state.wrap
                }),
                value: samples.layout
            })}
            ${hints([
                { keys: ['Mod+Shift+[', 'Mod+Shift+]'], label: 'Fold and unfold the block at the caret' },
                { keys: ['Ctrl+Alt+[', 'Ctrl+Alt+]'], label: 'Fold and unfold everything' },
                { keys: ['Mod+Shift+\\'], label: 'Jump to the matching bracket' }
            ])}
            <p class='code-editor-demo-caption'>
                Click a gutter chevron to fold a block, and click, drag or scroll the minimap to move through the
                document.
            </p>
        </div>
    `;
}


export default {
    name: 'code-editor',
    variants: [
        {
            render: editing,
            title: 'editing: undo and redo, find and replace, go to line'
        },
        {
            render: languages,
            title: 'syntax colors: TypeScript, TSX, CSS, SCSS, HTML, JSON, Python and Markdown'
        },
        {
            render: view,
            title: 'view options: wrap, whitespace, folding, minimap, line numbers and tab size'
        },
        {
            render: multiple,
            title: 'multiple cursors and rectangular selection'
        },
        {
            render: () => editor.code({
                class: 'code-editor-demo-editor code-editor-demo-editor--compact',
                options: { fileName: 'settings.json', label: 'Read-only settings', readonly: true },
                value: samples.settings
            }),
            title: 'read-only: selection, find, copy and folding without edits'
        },
        {
            render: services,
            title: 'language services: completion, hover and diagnostics over a transport'
        },
        {
            render: markdown,
            title: 'markdown: rendered in place, edited one block at a time'
        },
        workspaceExample
    ]
} satisfies Entry;
