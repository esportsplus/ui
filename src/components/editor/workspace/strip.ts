import { flush, reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import icon from '~/components/icon';
import tooltip from '~/components/tooltip';
import type { Controller as MenuController, Item } from '~/components/tooltip/menu';
import { mac } from '~/shared/platform';
import diffs from '../diffs';
import type { WorkspaceEditor } from './index';
import type { EditorWorkspaceModel, WorkspaceTab } from './model';
import { sides, type MergeSides } from './tabs';
import pin from '@esportsplus/ui/svg/pin.svg';
import './scss/tabs.scss';


type Options = {
    isFile: (path: string) => boolean;
    model: EditorWorkspaceModel;
    // Puts the active tab in the pane again, so a merge starting or ending on it takes effect.
    remount: VoidFunction;
    reveal: (path: string) => void;
};


function name(path: string) {
    return path.slice(path.lastIndexOf('/') + 1);
}


/** Pinned and preview tabs, the tab context menu, merging a conflicted tab and comparing two files. */
const strip = ({ isFile, model, remount, reveal }: Options) => {
    let chosen = '',
        controller: MenuController | undefined,
        merging = new WeakMap<WorkspaceTab, MergeSides>(),
        subject = reactive({ compare: false, conflicted: false, path: '', pinned: false });

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
                                remount();
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
                        remount();
                        void model.save(tab);
                    }
                })}
            </div>
        `;
    }

    let items: Item[] = [
            {
                hidden: () => subject.compare || subject.pinned,
                label: 'Pin',
                onselect: () => model.pin(subject.path)
            },
            {
                hidden: () => !subject.pinned,
                label: 'Unpin',
                onselect: () => model.unpin(subject.path)
            },
            {
                hidden: () => !subject.conflicted,
                label: 'Merge Conflicts',
                onselect: () => {
                    void api.merge(subject.path);
                }
            },
            {
                hint: mac() ? '⌘W' : 'Ctrl+W',
                label: 'Close',
                onselect: () => {
                    void model.close(subject.path);
                }
            },
            {
                label: 'Close Others',
                onselect: () => {
                    let path = subject.path;

                    void model.closeOthers(path).then((closed) => closed && model.activate(path));
                }
            },
            {
                label: 'Close to the Right',
                onselect: () => {
                    let path = subject.path;

                    void model.closeRight(path).then((closed) => closed && model.activate(path));
                }
            },
            {
                label: 'Close Saved',
                onselect: () => {
                    void model.closeSaved();
                }
            },
            {
                hidden: () => subject.compare,
                label: 'Copy Path',
                onselect: () => {
                    void model.copyPath(subject.path);
                }
            },
            {
                hidden: () => subject.compare,
                label: 'Reveal in Explorer',
                onselect: () => reveal(subject.path)
            }
        ];

    let api = {
        // Spread on a tab: its preview and pinned looks, its context menu, and a double click that keeps a preview.
        attributes(tab: WorkspaceTab) {
            let modifiers = [tab.pinned && 'code-workspace-tab--pinned', tab.preview && 'code-workspace-tab--preview'].filter(Boolean);

            return {
                ...(modifiers.length ? { class: modifiers.join(' ') } : {}),
                oncontextmenu: (event: MouseEvent) => api.open(tab, event),
                ondblclick: () => {
                    if (tab.preview) {
                        void model.open(tab.path);
                    }
                }
            };
        },

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
            remount();
        },

        menu: () => tooltip.context(
            {
                class: 'code-workspace-menu',
                controller: (value: MenuController) => {
                    controller = value;
                },
                items,
                [tooltip.context.panel]: { 'aria-label': 'Tab actions', class: 'code-workspace-menu-panel' }
            },
            ''
        ),

        open(tab: WorkspaceTab, event: MouseEvent) {
            if (!controller) {
                return;
            }

            event.preventDefault();

            // A context menu key reports no pointer, so the menu opens under the tab instead.
            let box = event.button === 2 ? undefined : (event.currentTarget as HTMLElement).getBoundingClientRect();

            subject.compare = !!tab.compare;
            subject.conflicted = !tab.compare && !!sides(tab.document.value);
            subject.path = tab.path;
            subject.pinned = tab.pinned;
            flush();
            controller.open(box ? { x: box.left, y: box.bottom } : { x: event.clientX, y: event.clientY });
        },

        pin(tab: WorkspaceTab) {
            return tab.pinned && icon({ 'aria-label': 'Pinned', class: 'code-workspace-tab-pin', role: 'img' }, pin);
        },

        title(tab: WorkspaceTab) {
            return tab.compare ? `${tab.compare.paths[0]} ↔ ${tab.compare.paths[1]}` : tab.path;
        }
    };

    return api;
};


export default strip;
