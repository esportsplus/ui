import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { codeEditor, fileTree } from '@esportsplus/ui/components';
import { EditorDocument, type Controller } from '@esportsplus/ui/components/code-editor';
import 'docs/examples/code-editor/scss/index.scss';
import { featureExamples } from './feature-examples';
import { workspaceExample } from './workspace-example';


const SOURCE = `// A small, editable TypeScript document.
type Greeting = { name: string };

export function greet({ name }: Greeting) {
    return "Hello, " + name + "!";
}
`;


export default {
    name: 'code-editor',
    variants: [
        {
            title: 'editing, history, find and replace',
            render: () => {
                let document = new EditorDocument(SOURCE),
                    state = reactive({ saved: 'Ready', position: 'Ln 1, Col 1' }),
                    editor: Controller | undefined;

                return html`
                    <section class='code-editor-demo'>
                        <div class='code-editor-demo-toolbar'>
                            <button type='button' onclick=${() => editor?.undo()}>Undo</button>
                            <button type='button' onclick=${() => editor?.redo()}>Redo</button>
                            <button type='button' onclick=${() => editor?.openFind(true)}>Find / replace</button>
                            <button type='button' onclick=${() => editor?.openGoToLine()}>Go to line</button>
                            <button type='button' onclick=${() => editor?.save()}>Save draft</button>
                        </div>
                        ${codeEditor({
                            controller: value => { editor = value; },
                            document,
                            options: { fileName: 'greeting.ts', label: 'TypeScript example' },
                            onChange: () => { state.saved = document.state.dirty ? 'Unsaved changes' : 'Ready'; },
                            onSelection: (_, position) => { state.position = `Ln ${position.line}, Col ${position.column}`; },
                            onSave: () => { document.markSaved(); state.saved = 'Saved in memory'; }
                        })}
                        <div class='code-editor-demo-status'>
                            <span aria-live='polite'>${() => state.saved}</span>
                            <span>${() => state.position}</span>
                        </div>
                        <p>Try Tab, Shift+Tab, Ctrl/Cmd+/, Ctrl/Cmd+F, and Ctrl/Cmd+Z. Escape then Tab moves focus out of the editor.</p>
                    </section>
                `;
            }
        },
        {
            title: 'file tree with independent document drafts',
            render: () => {
                let documents = new Map([
                        ['greeting.ts', new EditorDocument(SOURCE)],
                        ['package.json', new EditorDocument('{\n  "name": "editor-demo",\n  "private": true\n}\n')],
                        ['README.md', new EditorDocument('# Editor demo\n\nSelect a file in the tree. Each document retains its own edits and undo history.\n')]
                    ]),
                    state = reactive({ path: 'greeting.ts' });

                return html`
                    <section class='code-editor-demo'>
                        <div class='code-editor-demo-workspace'>
                            ${fileTree({
                                elements: [...documents.keys()].map(name => ({ id: name, name })),
                                label: 'Example files',
                                open: file => { state.path = file.id; },
                                selected: 'greeting.ts'
                            })}
                            <div class='code-editor-demo-document'>
                                <div class='code-editor-demo-filename'>${() => state.path}</div>
                                ${() => codeEditor({
                                    document: documents.get(state.path)!,
                                    options: { fileName: state.path, label: state.path }
                                })}
                            </div>
                        </div>
                        <p>Drafts stay in memory when switching files. The host application supplies file loading and persistence.</p>
                    </section>
                `;
            }
        },
        workspaceExample,
        ...featureExamples,
        {
            title: 'read-only JSON',
            render: () => codeEditor({
                options: { fileName: 'settings.json', label: 'Read-only settings', readonly: true },
                value: '{\n  "theme": "dark",\n  "editor": { "tabSize": 4 },\n  "enabled": true\n}\n'
            })
        }
    ]
};
