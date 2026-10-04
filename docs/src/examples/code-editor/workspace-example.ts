import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { codeEditor } from '@esportsplus/ui/components';
import { isWorkspaceCodeEditor, mountLanguageServices, type CodeEditorWorkspaceController } from '@esportsplus/ui/components/code-editor';
import { workspaceFiles } from './fixtures/files';
import { demoLanguageTransport } from './fixtures/language';
import { createMemoryWorkspaceHost } from './fixtures/workspace';

export const workspaceExample = {
    title: 'complete editor workspace',
    render: () => {
        let host = createMemoryWorkspaceHost(workspaceFiles),
            state = reactive({ message: 'Files and preferences are kept in memory for this example.' }),
            workspace: CodeEditorWorkspaceController | undefined, revision = 0;
        host.mention = (_cwd, path) => { host.mentions.push(path); state.message = `Added to chat: ${path}`; };
        host.copyPath = async (_cwd, path) => {
            await navigator.clipboard.writeText(path);
            host.copiedPaths.push(path); state.message = `Copied: ${path}`;
        };
        return html`
            <section class='code-editor-demo code-editor-demo-full' aria-label='Complete workspace example'>
                ${codeEditor.workspace({
                    host, cwd: '/demo', openTarget: { path: 'src/greeting.ts' },
                    editorOptions: { minimap: true },
                    controller: value => { workspace = value; },
                    renderEditor: (tab, attributes) => /\.(?:md|markdown)$/i.test(tab.path) ? codeEditor.markdown(attributes) : undefined,
                    addons: ({ host, controller, tab }) => {
                        if (!isWorkspaceCodeEditor(controller)) return;
                        return mountLanguageServices(host, controller, {
                            cwd: '/demo', fileName: tab.path, transport: demoLanguageTransport()
                        }).dispose;
                    }
                })}
                <div class='code-editor-demo-toolbar'>
                    <button type='button' onclick=${() => {
                        host.change('src/greeting.ts', workspaceFiles['src/greeting.ts'] + `\n// External update ${++revision}\n`);
                        state.message = 'Watcher delivered an external update to src/greeting.ts.';
                    }}>Simulate external update</button>
                    <button type='button' onclick=${() => {
                        host.change('notes/new-file.txt', 'Created outside the editor.\n');
                        state.message = 'Watcher added notes/new-file.txt.';
                    }}>Simulate new file</button>
                    <button type='button' onclick=${() => { void workspace?.open('src/greeting.ts', 8, 5); }}>Open greeting at line 8</button>
                </div>
                <div class='code-editor-demo-status' aria-live='polite'>${() => state.message}</div>
                <p>Use Ctrl+P to open files. Tabs retain independent drafts and history. The explorer menu supports rename, delete, undo, chat mentions, and copying paths.</p>
            </section>
        `;
    }
};
