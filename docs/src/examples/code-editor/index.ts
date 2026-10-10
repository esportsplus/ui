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
import type { CodeEditorState, Command, Conflict, Controller, MarkdownController, Selection } from '@esportsplus/ui/components/editor';
import type { Entry } from 'docs/types';
import { samples, workspaceFiles } from './fixtures/files';
import { demoLanguageTransport } from './fixtures/language';
import { workspaceExample } from './workspace-example';
import 'docs/examples/code-editor/scss/index.scss';


type Hint = {
    keys: string[];
    label: string;
};


const ANNOTATED = [
    '// Mod+click a link: https://github.com/esportsplus/ui or ./src/components/editor/code/view.ts',
    'export const palette = {',
    "    accent: '#5B8DEF',",
    "    danger: 'rgb(229 72 77)',",
    "    success: 'hsl(152, 57%, 42%)',",
    "    warning: 'oklch(80% 0.15 80)'",
    '};',
    '',
    '// A zero width space hides between these quotes: \'​\', and the second “a” in pаlette is Cyrillic.',
    'export const pаlette = palette;',
    '',
    'export class Theme {',
    '    private applied = 0;',
    '',
    '    constructor(private readonly name: string) {}',
    '',
    '    apply(element: HTMLElement) {',
    '        for (let [key, value] of Object.entries(palette)) {',
    "            if (value.startsWith('#')) {",
    '                element.style.setProperty(`--${key}`, value);',
    '                continue;',
    '            }',
    '',
    ...Array.from({ length: 24 }, (_, i) => `            element.style.setProperty('--' + key + '-${i + 1}', value);`),
    '        }',
    '',
    '        this.applied = TODO_ERROR;',
    '    }',
    '',
    '    describe() {',
    '        return `${this.name}: ${Object.keys(palette).length} colors, applied ${this.applied} times`;',
    '    }',
    '',
    '    reset(element: HTMLElement) {',
    '        for (let key of Object.keys(palette)) {',
    '            element.style.removeProperty(`--${key}`);',
    '        }',
    '',
    '        this.applied = TODO_ERROR;',
    '    }',
    '}',
    ''
].join('\n');

// The same file as it was committed: one color differs, a line was added since and one removed.
const ANNOTATED_HEAD = ANNOTATED
    .replace("accent: '#5B8DEF'", "accent: '#4A7BD8'")
    .replace('    private applied = 0;\n\n', '')
    .replace('    describe() {\n', '    // Summarizes the theme.\n    describe() {\n');

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

const CONFLICTED = [
    'import { tokens } from "./tokens";',
    '',
    '<<<<<<< HEAD',
    'export const accent = tokens.blue[400];',
    'export const radius = 6;',
    '||||||| base',
    'export const accent = tokens.blue[500];',
    '=======',
    'export const accent = tokens.violet[500];',
    '>>>>>>> feature/violet',
    '',
    'export function surface(depth: number) {',
    '<<<<<<< HEAD',
    '    return `elevation-${depth}`;',
    '=======',
    '    return `surface-${Math.min(depth, 3)}`;',
    '>>>>>>> feature/violet',
    '}',
    ''
].join('\n');

// A keybinding override for the features example: F2 toggles a line comment, and Mod+D adds nothing.
const KEYBINDINGS: Readonly<Record<string, Command | null>> = { F2: 'toggleComment', 'Mod+d': null };

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
        <button class='button code-editor-demo-action' onclick='${run}' type='button'>
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

// Sticky scroll, color swatches, links, unicode warnings, rulers, the git gutter, keybinding overrides and problem
// navigation, each behind a switch.
function annotated() {
    let controller: Controller | undefined,
        state = reactive({
            baseline: true,
            colors: true,
            keybindings: false,
            links: true,
            opened: '',
            ready: false,
            rulers: true,
            sticky: true,
            unicode: true
        }),
        transport = demoLanguageTransport();

    return html`
        <div class='code-editor-demo'>
            <div class='code-editor-demo-actions'>
                ${flag('Sticky scroll', () => state.sticky, (value) => {
                    state.sticky = value;
                })}
                ${flag('Color swatches', () => state.colors, (value) => {
                    state.colors = value;
                })}
                ${flag('Links', () => state.links, (value) => {
                    state.links = value;
                })}
                ${flag('Unicode warnings', () => state.unicode, (value) => {
                    state.unicode = value;
                })}
                ${flag('Rulers at 80 and 120', () => state.rulers, (value) => {
                    state.rulers = value;
                })}
                ${flag('Git gutter', () => state.baseline, (value) => {
                    state.baseline = value;
                })}
                ${flag('F2 comments, Mod+D unbound', () => state.keybindings, (value) => {
                    state.keybindings = value;
                })}
            </div>
            <div class='code-editor-demo-actions'>
                ${action('Previous change', () => controller?.previousChange())}
                ${action('Next change', () => controller?.nextChange())}
                ${action('Previous problem', () => controller?.previousProblem())}
                ${action('Next problem', () => controller?.nextProblem())}
            </div>
            ${editor.code({
                class: 'code-editor-demo-editor code-editor-demo-editor--tall',
                controller: (value) => {
                    controller = value;
                    state.ready = true;
                },
                options: () => ({
                    baseline: state.baseline ? ANNOTATED_HEAD : null,
                    colors: state.colors,
                    fileName: 'theme.ts',
                    keybindings: state.keybindings ? KEYBINDINGS : undefined,
                    label: 'Editor features example',
                    links: state.links && ((url: string) => {
                        if (url.startsWith('.')) {
                            state.opened = url;
                            return;
                        }

                        window.open(url, '_blank', 'noopener,noreferrer');
                    }),
                    rulers: state.rulers ? [80, 120] : [],
                    services: { cwd: '/demo', transport },
                    sticky: state.sticky,
                    unicode: state.unicode
                }),
                value: ANNOTATED
            })}
            <div aria-live='polite' class='code-editor-demo-status'>
                <span>${() => state.ready && controller ? summary(controller.state) : ''}</span>
                <span>${() => state.opened && `Opened ${state.opened}`}</span>
            </div>
            ${hints([
                { keys: ['Alt+F5', 'Shift+Alt+F5'], label: 'Next and previous change against the baseline' },
                { keys: ['F8', 'Shift+F8'], label: 'Next and previous problem, with its message' },
                { keys: ['Mod+Click'], label: 'Open the link under the pointer' }
            ])}
            <p class='code-editor-demo-caption'>
                Scroll inside <code>apply</code> to see its headers stick, click a swatch to pick a color, hover the
                boxed characters, and click a bar in the gutter to see what the line was at the baseline and revert it.
            </p>
        </div>
    `;
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

// Merge conflict markers: tinted sides, a lens per block, and navigation between blocks.
function conflicts() {
    let controller: Controller | undefined,
        state = reactive({ compared: '', remaining: 2 });

    return html`
        <div class='code-editor-demo'>
            <div class='code-editor-demo-actions'>
                ${action('Previous conflict', () => controller?.previousConflict())}
                ${action('Next conflict', () => controller?.nextConflict())}
                ${action('Accept every incoming', () => {
                    for (let conflict = controller?.conflicts()[0]; conflict; conflict = controller?.conflicts()[0]) {
                        controller?.resolveConflict(conflict, 'incoming');
                    }
                })}
                ${action('Restore', () => controller?.setValue(CONFLICTED))}
            </div>
            ${editor.code({
                controller: (value) => {
                    controller = value;
                },
                onChange: () => {
                    state.remaining = controller?.conflicts().length ?? 0;
                },
                options: {
                    fileName: 'theme.ts',
                    label: 'Merge conflicts example',
                    onMerge: (conflict: Conflict) => {
                        state.compared = `Compare requested for the conflict on line ${conflict.line}`;
                    }
                },
                value: CONFLICTED
            })}
            <div aria-live='polite' class='code-editor-demo-status'>
                <span>${() => state.remaining === 1 ? '1 conflict left' : `${state.remaining} conflicts left`}</span>
                <span>${() => state.compared}</span>
            </div>
            ${hints([
                { keys: ['Alt+F8', 'Shift+Alt+F8'], label: 'Next and previous conflict' }
            ])}
        </div>
    `;
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
        state = reactive({ dirty: false, fold: false, minimap: false });

    return html`
        <div class='code-editor-demo'>
            <div class='code-editor-demo-actions'>
                ${action('Bold', () => controller?.bold(), bold)}
                ${action('Italic', () => controller?.italic(), italic)}
                ${action('Undo', () => controller?.undo(), undo)}
                ${action('Redo', () => controller?.redo(), redo)}
                ${action('Load 1,500 sections', () => controller?.setValue(SECTIONS))}
                ${action('Restore', () => controller?.setValue(workspaceFiles['README.md']))}
                ${flag('Fold', () => state.fold, (value) => {
                    state.fold = value;
                })}
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
                options: () => ({ fold: state.fold, label: 'Markdown example', minimap: state.minimap })
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
                Edit the rendered text directly: the Markdown underneath updates as you type and its syntax never shows.
                Type # for a heading, - for a list, [] for a to-do and > for a quote. Task checkboxes toggle in place and
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

// The status a workspace would show for an editor.
function summary(state: CodeEditorState) {
    let { errors, warnings } = state.problems;

    return [
        `${state.selections === 1 ? '1 selection' : `${state.selections} selections`}`,
        state.indent.tabs ? `Tab size: ${state.indent.size}` : `Spaces: ${state.indent.size}`,
        state.lineEnding.toUpperCase(),
        `${errors} errors, ${warnings} warnings`,
        state.language
    ].join(' · ');
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

function viewer() {
    let flags = reactive({ minimap: true, whitespace: false, wrap: false }),
        state = reactive({ active: false, error: '', selected: LANGUAGES[0].value as string });

    return html`
        <div class='code-editor-demo'>
            <div class='code-editor-demo-actions'>
                <div class='code-editor-demo-field'>
                    <span aria-hidden='true'>Language</span>
                    ${select({ label: 'Language', options: LANGUAGES.map((language) => ({ ...language })), state })}
                </div>
                ${flag('Wrap', () => flags.wrap, (value) => {
                    flags.wrap = value;
                })}
                ${flag('Whitespace', () => flags.whitespace, (value) => {
                    flags.whitespace = value;
                })}
                ${flag('Minimap', () => flags.minimap, (value) => {
                    flags.minimap = value;
                })}
            </div>
            ${() => {
                let path = String(state.selected),
                    { minimap, whitespace, wrap } = flags;

                return untrack(() => editor.viewer({
                    class: 'code-editor-demo-viewer',
                    copy: true,
                    filename: path,
                    minimap,
                    value: workspaceFiles[path as keyof typeof workspaceFiles],
                    whitespace,
                    wrap
                }));
            }}
            <p class='code-editor-demo-caption'>
                The viewer renders source without the editor: syntax colors, line numbers, folding, wrap, visible
                whitespace, a minimap and a copy button, and the text selects and copies like any page text.
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
            render: viewer,
            title: 'viewer: syntax colors, line numbers, folding, wrap, whitespace, minimap and copy, without the editor'
        },
        {
            render: services,
            title: 'language services: completion, hover and diagnostics over a transport'
        },
        {
            render: annotated,
            title: 'features: sticky scroll, color swatches, links, unicode warnings, rulers, git gutter and keybindings'
        },
        {
            render: conflicts,
            title: 'merge conflicts: accept current, incoming or both, and compare'
        },
        {
            render: markdown,
            title: 'markdown: edited as rendered, its syntax never shown'
        },
        workspaceExample
    ]
} satisfies Entry;
