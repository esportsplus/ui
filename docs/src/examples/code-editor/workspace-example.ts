import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { editor } from '@esportsplus/ui/components';
import type { CodeEditorWorkspaceController } from '@esportsplus/ui/components/editor';
import pencil from '@esportsplus/ui/svg/pencil.svg';
import { workspaceFiles } from './fixtures/files';
import { demoLanguageTransport } from './fixtures/language';
import { createMemoryWorkspaceHost } from './fixtures/workspace';


const MARKDOWN = /\.(?:md|markdown)$/i;


const workspaceExample = {
    render: () => {
        let host = createMemoryWorkspaceHost(workspaceFiles),
            revision = 0,
            state = reactive({ message: 'Files and preferences are kept in memory for this example.' }),
            workspace: CodeEditorWorkspaceController | undefined;

        host.actions = [
            {
                icon: pencil,
                id: 'annotate',
                label: 'Annotate',
                run: (_cwd, paths) => {
                    state.message = `Annotate: ${paths.join(', ')}`;
                }
            }
        ];
        host.copyPath = async (_cwd, path) => {
            await navigator.clipboard.writeText(path);
            host.copiedPaths.push(path);
            state.message = `Copied: ${path}`;
        };

        return html`
            <section aria-label='Complete workspace example' class='code-editor-demo'>
                ${editor.workspace({
                    controller: (value) => {
                        workspace = value;
                    },
                    cwd: '/demo',
                    editorOptions: { minimap: true, services: { cwd: '/demo', transport: demoLanguageTransport() } },
                    host,
                    openTarget: { path: 'src/greeting.ts' },
                    editor: (tab) => (MARKDOWN.test(tab.path) ? editor.markdown : undefined),
                    style: '--height: 580px;'
                })}
                <div class='code-editor-demo-actions'>
                    <button
                        class='button --background-white --border-border --color-text code-editor-demo-action'
                        type='button'
                        onclick=${() => {
                            host.change('src/greeting.ts', workspaceFiles['src/greeting.ts'] + `\n// External update ${++revision}\n`);
                            state.message = 'Watcher delivered an external update to src/greeting.ts.';
                        }}
                    >
                        Simulate external update
                    </button>
                    <button
                        class='button --background-white --border-border --color-text code-editor-demo-action'
                        type='button'
                        onclick=${() => {
                            host.change('notes/new-file.txt', 'Created outside the editor.\n');
                            state.message = 'Watcher added notes/new-file.txt.';
                        }}
                    >
                        Simulate new file
                    </button>
                    <button
                        class='button --background-white --border-border --color-text code-editor-demo-action'
                        type='button'
                        onclick=${() => {
                            void workspace?.open('src/greeting.ts', 8, 5);
                        }}
                    >
                        Open greeting at line 8
                    </button>
                </div>
                <div aria-live='polite' class='code-editor-demo-status'>${() => state.message}</div>
                <p class='code-editor-demo-caption'>
                    Press Ctrl/Cmd+P over the workspace to open files. Tabs keep independent drafts and history. The
                    explorer menu supports rename, delete, copying paths and host actions such as Annotate; file
                    operations undo from the explorer toolbar.
                </p>
            </section>
        `;
    },
    title: 'complete editor workspace'
};


export { workspaceExample };
