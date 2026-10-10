import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { editor } from '@esportsplus/ui/components';
import { FileTreeDecorations, type CodeEditorWorkspaceController } from '@esportsplus/ui/components/editor';
import pencil from '@esportsplus/ui/svg/pencil.svg';
import { workspaceFiles } from './fixtures/files';
import { demoLanguageTransport } from './fixtures/language';
import { createMemoryWorkspaceHost } from './fixtures/workspace';


// What the files were at the last commit: the git gutter diffs against it, and the explorer marks what differs.
const HEAD: Record<string, string> = {
    ...workspaceFiles,
    'src/greeting.ts': workspaceFiles['src/greeting.ts']
        .replace('    return "Welcome";\n', '    return "Hi";\n')
        .replace('console.log(greet(person));\n', ''),
    'src/reset.css': workspaceFiles['src/reset.css'].replace(/\n@media[\s\S]*$/, '\n')
};

const MARKDOWN = /\.(?:md|markdown)$/i;

const SESSION = 'esportsplus-ui-workspace-session';


const workspaceExample = {
    render: () => {
        let git = new FileTreeDecorations(),
            host = createMemoryWorkspaceHost(workspaceFiles, {}, [], { head: HEAD, key: SESSION, storage: localStorage }),
            restoring = !!localStorage.getItem(SESSION),
            revision = 0,
            state = reactive({ message: 'Files and preferences are kept in memory; the session is kept in localStorage.' }),
            // Stands in for 'git status', which a host would read from the repository.
            status = () => {
                git.replace([...host.contents].flatMap(([path, text]): [string, { status: 'modified' | 'untracked' }][] => {
                    if (!(path in HEAD)) {
                        return [[path, { status: 'untracked' }]];
                    }

                    return text === HEAD[path] ? [] : [[path, { status: 'modified' }]];
                }));
            },
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
        status();
        void host.watch('/demo', status);
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
                    decorations: git,
                    editorOptions: { minimap: true, services: { cwd: '/demo', transport: demoLanguageTransport() } },
                    host,
                    openTarget: restoring ? undefined : { path: 'src/greeting.ts' },
                    editor: (tab) => (MARKDOWN.test(tab.path) ? editor.markdown : undefined),
                    style: '--height: 580px;'
                })}
                <div class='code-editor-demo-actions'>
                    <button
                        class='button code-editor-demo-action'
                        type='button'
                        onclick=${() => {
                            host.change('src/greeting.ts', workspaceFiles['src/greeting.ts'] + `\n// External update ${++revision}\n`);
                            state.message = 'Watcher delivered an external update to src/greeting.ts.';
                        }}
                    >
                        Simulate external update
                    </button>
                    <button
                        class='button code-editor-demo-action'
                        type='button'
                        onclick=${() => {
                            host.change('notes/new-file.txt', 'Created outside the editor.\n');
                            state.message = 'Watcher added notes/new-file.txt.';
                        }}
                    >
                        Simulate new file
                    </button>
                    <button
                        class='button code-editor-demo-action'
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
                    operations undo from the explorer toolbar. Open tabs, carets, folds, open folders and unsaved
                    drafts survive a reload. src/greeting.ts and src/reset.css differ from HEAD: the gutter shows how,
                    and Alt+F5 / Shift+Alt+F5 step through the changes across files, as F8 / Shift+F8 do problems.
                    Drop files from the desktop onto the explorer to import them, or drag a file out to export it.
                </p>
            </section>
        `;
    },
    title: 'complete editor workspace'
};


export { workspaceExample };
