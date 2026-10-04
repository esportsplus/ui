import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { codeEditor } from '@esportsplus/ui/components';
import { EditorDocument, mountLanguageServices, type LanguageServices, type MarkdownController } from '@esportsplus/ui/components/code-editor';
import { workspaceFiles } from './fixtures/files';
import { demoLanguageTransport } from './fixtures/language';

export const featureExamples = [
    {
        title: 'completion, hover and diagnostics',
        render: () => {
            let services: LanguageServices | undefined;
            return html`
                <section class='code-editor-demo' aria-label='Language services example'>
                    ${codeEditor({
                        document: new EditorDocument('const score = TODO_ERROR;\n\ngre\n'),
                        options: { fileName: 'services.ts', label: 'Language services source' },
                        controller: editor => {
                            services?.dispose();
                            services = mountLanguageServices(editor.textarea.closest('.code-editor') as HTMLElement, editor, {
                                fileName: 'services.ts', cwd: '/demo', transport: demoLanguageTransport()
                            });
                        },
                        ondisconnect: () => { services?.dispose(); services = undefined; }
                    })}
                    <p>This example uses a deterministic sample language server. Press Ctrl+Space after “gre” for completion, hover over text, or click a diagnostic to select its source.</p>
                </section>
            `;
        }
    },
    {
        title: 'in-place Markdown editing',
        render: () => {
            let document = new EditorDocument(workspaceFiles['README.md']),
                state = reactive({ status: 'Ready' }), editor: MarkdownController | undefined;
            return html`
                <section class='code-editor-demo' aria-label='Markdown example'>
                    <div class='code-editor-demo-toolbar'>
                        <button type='button' onclick=${() => editor?.bold()}>Bold</button>
                        <button type='button' onclick=${() => editor?.italic()}>Italic</button>
                        <button type='button' onclick=${() => editor?.undo()}>Undo</button>
                        <button type='button' onclick=${() => editor?.redo()}>Redo</button>
                        <button type='button' onclick=${() => editor?.save()}>Save draft</button>
                        <button type='button' onclick=${() => editor?.setValue(Array.from({ length: 1500 }, (_, index) => `## Section ${index + 1}\n\nParagraph ${index + 1} with **bold** and a [link](https://example.com).\n\n`).join(''))}>Load large document</button>
                        <button type='button' onclick=${() => editor?.setValue(workspaceFiles['README.md'])}>Restore example</button>
                    </div>
                    ${codeEditor.markdown({
                        document, options: { label: 'Markdown source' },
                        controller: value => { editor = value; },
                        onChange: () => { state.status = document.state.dirty ? 'Unsaved changes' : 'Ready'; },
                        onSave: () => { document.markSaved(); state.status = 'Saved in memory'; }
                    })}
                    <div class='code-editor-demo-status' aria-live='polite'>${() => state.status}</div>
                    <p>Click a block to edit its Markdown source. Other blocks retain their formatting. Task checkboxes, formatting shortcuts, and undo update the same document.</p>
                </section>
            `;
        }
    }
];
