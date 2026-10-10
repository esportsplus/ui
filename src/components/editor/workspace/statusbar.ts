import { flush, peek, reactive, read, signal, untrack, write } from '@esportsplus/reactivity';
import { html, type Renderable } from '@esportsplus/template';
import icon from '~/components/icon';
import status from '~/components/inline-edit/status';
import tooltip from '~/components/tooltip';
import type { Controller as MenuController, Item } from '~/components/tooltip/menu';
import type { Controller as CodeController, Language, Options } from '../code';
import type { WorkspaceEditorController } from '.';
import type { EditorWorkspaceModel, WorkspaceTab } from './model';
import {
    AUTO_SAVE_MODES,
    AutoSave,
    INDENT_SIZES,
    indentation,
    indentLabel,
    LANGUAGES,
    lineEndings,
    type AutoSaveMode,
    type Indentation
} from './status';
import alert from '@esportsplus/ui/svg/circle-alert.svg';
import check from '@esportsplus/ui/svg/check.svg';
import warning from '@esportsplus/ui/svg/warning.svg';
import '~/components/inline-edit/scss/index.scss';
import './scss/status.scss';


type Choice = 'autoSave' | 'indent' | 'language';


const CHOICES: Record<Choice, string> = {
    autoSave: 'Auto save',
    indent: 'Indentation',
    language: 'Language'
};


function isCode(controller: WorkspaceEditorController): controller is CodeController {
    return 'nextProblem' in controller && 'state' in controller;
}

function mark(selected: () => boolean) {
    return () => html`${() => selected() && icon({ 'aria-hidden': 'true', class: 'code-workspace-choice-icon' }, check)}`;
}


// The status bar's editor items, the auto save status that takes the save button's place, and the menu their small
// choices open in.
const statusbar = (model: EditorWorkspaceModel, nextProblem: () => Promise<boolean>) => {
    let autosave = new AutoSave(model),
        choice = signal<Choice>('language'),
        editor = signal<CodeController | undefined>(undefined),
        menu: MenuController | undefined,
        // Language and indentation picked for a tab, over the workspace's editor options.
        overrides = new WeakMap<WorkspaceTab, Options>(),
        revision = signal(0),
        view = reactive({ autoSave: 'off' as AutoSaveMode });

    function choose(next: Choice, element: HTMLElement, below = false) {
        let bounds = element.getBoundingClientRect();

        write(choice, next);
        // Items hide by the choice; the menu focuses its first visible one as it opens.
        flush();
        menu?.open({ x: bounds.left, y: below ? bounds.bottom : bounds.top });
    }

    function code(render: (controller: CodeController) => Renderable<unknown>) {
        return () => {
            let controller = read(editor);

            return controller && render(controller);
        };
    }

    function item(kind: string, label: () => string, onclick: (event: MouseEvent) => void, title: string | (() => string) = label) {
        return html`
            <button
                class='button code-workspace-status-item code-workspace-status-item--${kind}'
                type='button'
                ${{ 'aria-label': title, onclick, title }}
            >
                ${label}
            </button>
        `;
    }

    function override(next: Options) {
        let tab = model.state.active;

        if (!tab) {
            return;
        }

        overrides.set(tab, { ...overrides.get(tab), ...next });
        write(revision, peek(revision) + 1);
        peek(editor)?.focus();
    }

    let indents: Indentation[] = [false, true].flatMap((tabs) => INDENT_SIZES.map((size) => ({ size, tabs }))),
        items: Item[] = [
            ...(Object.keys(LANGUAGES) as Language[]).map((language): Item => ({
                hidden: () => read(choice) !== 'language',
                icon: mark(() => read(editor)?.state.language === language),
                label: LANGUAGES[language],
                onselect: () => override({ language })
            })),
            ...indents.map((indent): Item => ({
                hidden: () => read(choice) !== 'indent',
                icon: mark(() => {
                    let current = read(editor)?.state.indent;

                    return current?.size === indent.size && current.tabs === indent.tabs;
                }),
                label: indent.tabs ? `Indent using tabs, size ${indent.size}` : `Indent using ${indent.size} spaces`,
                onselect: () => override(indentation(indent))
            })),
            ...(['off', 'delay', 'focus'] as const).map((mode): Item => ({
                hidden: () => read(choice) !== 'autoSave',
                icon: mark(() => view.autoSave === mode),
                label: AUTO_SAVE_MODES[mode],
                onselect: () => model.setPreferences({ autoSave: mode })
            }))
        ];

    return {
        attach: (controller: WorkspaceEditorController | undefined) => {
            write(editor, controller && isCode(controller) ? controller : undefined);
        },
        connect: (element: HTMLElement) => {
            let listening = new AbortController(),
                update = () => {
                    view.autoSave = model.state.preferences.autoSave;
                },
                disconnect = autosave.connect(),
                unsubscribe = model.subscribe(update);

            update();
            element.ownerDocument.defaultView?.addEventListener('blur', () => autosave.blur(true), { signal: listening.signal });
            element.addEventListener('focusout', (event) => {
                let panel = (event.target as Element).closest('.code-workspace-editor');

                if (panel && !panel.contains(event.relatedTarget as Node | null)) {
                    autosave.blur();
                }
            }, { signal: listening.signal });

            return () => {
                listening.abort();
                unsubscribe();
                disconnect();
                write(editor, undefined);
            };
        },
        items: () => html`
            <div class='code-workspace-status-items'>
                ${code((controller) => {
                    let state = controller.state,
                        problems = () => `${state.problems.errors} errors, ${state.problems.warnings} warnings: go to the next problem`;

                    return html`
                        ${() => state.selections > 1 && html`<span class='code-workspace-status-item code-workspace-status-item--selections'>${state.selections} selections</span>`}
                        <button
                            class='button code-workspace-status-item code-workspace-status-item--problems'
                            type='button'
                            ${{
                                'aria-label': problems,
                                disabled: () => !state.problems.errors && !state.problems.warnings,
                                onclick: () => {
                                    void nextProblem().then((moved) => {
                                        if (moved) {
                                            peek(editor)?.focus();
                                        }
                                    });
                                },
                                title: problems
                            }}
                        >
                            ${icon({ 'aria-hidden': 'true', class: 'code-workspace-status-icon' }, alert)}
                            ${() => state.problems.errors}
                            ${icon({ 'aria-hidden': 'true', class: 'code-workspace-status-icon' }, warning)}
                            ${() => state.problems.warnings}
                        </button>
                        ${item(
                            'language',
                            () => LANGUAGES[state.language],
                            (event) => choose('language', event.currentTarget as HTMLElement),
                            'Select language'
                        )}
                        ${item(
                            'indent',
                            () => indentLabel(state.indent),
                            (event) => choose('indent', event.currentTarget as HTMLElement),
                            'Select indentation'
                        )}
                        ${item(
                            'eol',
                            () => (state.lineEnding === 'crlf' ? 'CRLF' : 'LF'),
                            () => {
                                lineEndings(controller.document, state.lineEnding === 'crlf' ? 'lf' : 'crlf');
                            },
                            () => (state.lineEnding === 'crlf' ? 'Convert line endings to LF' : 'Convert line endings to CRLF')
                        )}
                        <span class='code-workspace-status-item code-workspace-status-item--encoding' title='Encoding'>UTF-8</span>
                    `;
                })}
                ${item(
                    'autosave',
                    () => `Auto Save: ${AUTO_SAVE_MODES[view.autoSave]}`,
                    (event) => choose('autoSave', event.currentTarget as HTMLElement),
                    'Select auto save'
                )}
            </div>
        `,
        menu: () => tooltip.context(
            {
                class: 'code-workspace-menu',
                controller: (value: MenuController) => {
                    menu = value;
                },
                items,
                [tooltip.context.panel]: { 'aria-label': () => CHOICES[read(choice)], class: 'code-workspace-choices code-workspace-menu-panel' }
            },
            ''
        ),
        options: (tab: WorkspaceTab) => {
            read(revision);

            return overrides.get(tab);
        },
        // While auto save is on, its status stands where the save button was.
        save: (button: () => Renderable<unknown>) => () => {
            if (view.autoSave === 'off') {
                return button();
            }

            return html`
                <button
                    class='button code-workspace-autosave'
                    type='button'
                    ${{
                        'aria-label': () => `Auto save: ${AUTO_SAVE_MODES[view.autoSave]}`,
                        onclick: (event: MouseEvent) => choose('autoSave', event.currentTarget as HTMLElement, true),
                        title: () => `Auto save: ${AUTO_SAVE_MODES[view.autoSave]}`
                    }}
                >
                    ${untrack(() => status.render(autosave.status))}
                </button>
            `;
        }
    };
};


export default statusbar;
