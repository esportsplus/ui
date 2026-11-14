import { html } from '@esportsplus/template';
import icon from '~/components/icon';
import type { Item } from '~/components/tooltip/menu';
import { mac } from '~/shared/platform';
import diffs from '../diffs';
import { fileTreeIcon } from '../tree';
import type { WorkspaceEditor } from './index';
import type { EditorWorkspaceModel, WorkspaceTab } from './model';
import { sides, type MergeSides } from './tabs';
import pin from '@esportsplus/ui/svg/pin.svg';


type Options = {
    isFile: (path: string) => boolean;
    model: EditorWorkspaceModel;
    // Puts the tab in its pane again, so a merge starting or ending on it takes effect.
    remount: (tab: WorkspaceTab) => void;
    reveal: (path: string) => void;
};


function name(path: string) {
    return path.slice(path.lastIndexOf('/') + 1);
}


/** Pinned and preview tabs, the tab context menu, merging a conflicted tab and comparing two files. */
const strip = ({ isFile, model, remount, reveal }: Options) => {
    let chosen = '',
        merging = new WeakMap<WorkspaceTab, MergeSides>();

    function compare(tab: WorkspaceTab): WorkspaceEditor {
        let { modified, original, paths } = tab.compare!;

        return () => diffs({
            class: 'code-workspace-document code-workspace-compare',
            filename: `${paths[0]} ↔ ${paths[1]}`,
            modified,
            original
        });
    }

    function merge(tab: WorkspaceTab, found: MergeSides): WorkspaceEditor {
        return () => html`
            <div class='code-workspace-document code-workspace-merge'>
                <div class='code-workspace-merge-bar'>
                    <span class='code-workspace-merge-title'>Merging ${tab.path}</span>
                    <button
                        class='button code-workspace-merge-cancel'
                        type='button'
                        ${{
                            onclick: () => {
                                merging.delete(tab);
                                remount(tab);
                            }
                        }}
                    >
                        Cancel merge
                    </button>
                </div>
                ${diffs.merge({
                    base: found.base,
                    class: 'code-workspace-merge-editor',
                    current: found.current,
                    filename: tab.path,
                    incoming: found.incoming,
                    onresolve: (result) => {
                        merging.delete(tab);
                        tab.document.setValue(result);
                        remount(tab);
                        void model.save(tab);
                    }
                })}
            </div>
        `;
    }

    let api = {
        // The view a tab shows in place of its editor: a compare tab's diff, or the merge started on it.
        editor(tab: WorkspaceTab): WorkspaceEditor | undefined {
            if (tab.compare) {
                return compare(tab);
            }

            let found = merging.get(tab);

            return found && merge(tab, found);
        },

        // Tree context menu entries, against the paths the menu opened on.
        items(paths: () => string[]): Item[] {
            let files = () => paths().filter(isFile);

            return [
                {
                    hidden: () => paths().length !== 1 || files().length !== 1,
                    label: 'Select for Compare',
                    onselect: () => {
                        chosen = paths()[0];
                        model.status(`Selected ${chosen} for compare`);
                    }
                },
                {
                    hidden: () => {
                        let list = files();

                        return list.length !== paths().length || !(list.length === 2 || (list.length === 1 && !!chosen && chosen !== list[0]));
                    },
                    label: 'Compare with Selected',
                    onselect: () => {
                        let list = files();

                        void (list.length === 2 ? model.compare(list[0], list[1]) : model.compare(chosen, list[0]));
                    }
                },
                {
                    hidden: () => paths().length !== 1 || files().length !== 1,
                    label: 'Merge Conflicts',
                    onselect: () => {
                        void api.merge(paths()[0]);
                    }
                }
            ];
        },

        label(tab: WorkspaceTab) {
            return tab.compare ? `${name(tab.compare.paths[0])} ↔ ${name(tab.compare.paths[1])}` : name(tab.path);
        },

        // Shows the merge editor in place of the file's editor, with the versions its conflict markers hold.
        async merge(target: WorkspaceTab | string) {
            let tab = typeof target === 'string' ? await model.open(target) : target;

            if (!tab || tab.compare) {
                return;
            }

            let found = sides(tab.document.value);

            if (!found) {
                model.status(`${tab.path} has no conflict markers`);
                return;
            }

            merging.set(tab, found);
            model.activate(tab);
            remount(tab);
        },

        // A file tab's menu, against the surface it opened on; bulk closes stay in that tab's group.
        menu(surface: () => string): Item[] {
            let tab = () => model.find(surface()),
                compared = () => !!tab()?.compare,
                path = () => tab()?.path ?? '',
                pinned = () => !!tab()?.pinned;

            return [
                {
                    hidden: () => compared() || pinned(),
                    label: 'Pin',
                    onselect: () => model.pin(path())
                },
                {
                    hidden: () => !pinned(),
                    label: 'Unpin',
                    onselect: () => model.unpin(path())
                },
                {
                    hidden: () => {
                        let found = tab();

                        return !found || !!found.compare || !sides(found.document.value);
                    },
                    label: 'Merge Conflicts',
                    onselect: () => {
                        void api.merge(path());
                    }
                },
                {
                    hint: mac() ? '⌘W' : 'Ctrl+W',
                    label: 'Close',
                    onselect: () => {
                        void model.close(path());
                    }
                },
                {
                    label: 'Close Others',
                    onselect: () => {
                        let target = path();

                        void model.closeOthers(target).then((closed) => closed && model.activate(target));
                    }
                },
                {
                    label: 'Close to the Right',
                    onselect: () => {
                        let target = path();

                        void model.closeRight(target).then((closed) => closed && model.activate(target));
                    }
                },
                {
                    label: 'Close Saved',
                    onselect: () => {
                        void model.closeSaved();
                    }
                },
                {
                    hidden: compared,
                    label: 'Copy Path',
                    onselect: () => {
                        void model.copyPath(path());
                    }
                },
                {
                    hidden: compared,
                    label: 'Reveal in Explorer',
                    onselect: () => reveal(path())
                }
            ];
        },

        // A file tab's looks and its double click, which keeps a preview rather than maximizing the group.
        tab(tab: WorkspaceTab) {
            return {
                attributes: {
                    class: [
                        () => tab.pinned && 'code-workspace-tab--pinned',
                        () => tab.preview && 'code-workspace-tab--preview'
                    ],
                    ondblclick: (event: MouseEvent) => {
                        if (tab.preview) {
                            event.preventDefault();
                            void model.open(tab.path);
                        }
                    }
                },
                badges: () => html`
                    ${tab.pinned && icon({ 'aria-label': 'Pinned', class: 'code-workspace-tab-pin', role: 'img' }, pin)}
                    ${tab.dirty && html`<span aria-label='Unsaved changes' class='code-workspace-tab-dirty' role='img'></span>`}
                `,
                icon: () => fileTreeIcon({ name: api.label(tab), type: 'file' }, false)
            };
        },

        title(tab: WorkspaceTab) {
            return tab.compare ? `${tab.compare.paths[0]} ↔ ${tab.compare.paths[1]}` : tab.path;
        }
    };

    return api;
};


export default strip;
