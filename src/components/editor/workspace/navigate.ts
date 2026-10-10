import { effect, root } from '@esportsplus/reactivity';
import { mac } from '~/shared/platform';
import { keymap, type Command } from '../code/keymap';
import type { CodeController } from '../code/view';
import type { Selection } from '../code/document';
import type { FileTreeController, FileTreeJump } from '../tree';
import type { EditorWorkspaceModel, WorkspaceTab } from './model';
import type { WorkspaceEditorController } from './index';
import type hosted from './session';


type Options = {
    // The chords the shown editor runs commands on, so a rebound command moves across files under its new keys.
    bindings: () => Readonly<Record<string, Command | null>> | undefined;
    hosting: ReturnType<typeof hosted>;
    model: EditorWorkspaceModel;
    tree: () => FileTreeController | undefined;
};

type Step = 'moved' | 'none' | 'wrapped';


const COMMANDS: Partial<Record<Command, [FileTreeJump, boolean]>> = {
    nextChange: ['change', false],
    nextProblem: ['problem', false],
    previousChange: ['change', true],
    previousProblem: ['problem', true]
};

// Diagnostics for a file just opened come from its language server a moment later.
const PROBLEMS_WAIT = 1500;


function caret(selection: Selection) {
    return selection.direction === 'backward' ? selection.start : selection.end;
}

function code(controller: WorkspaceEditorController | undefined): controller is CodeController {
    return !!controller && 'nextChange' in controller && 'nextProblem' in controller;
}

// The editor's own commands wrap around within the file; a caret that went back past where it was has wrapped.
function step(controller: CodeController, kind: FileTreeJump, backward: boolean): Step {
    let before = caret(controller.document.selection),
        moved = kind === 'change'
            ? (backward ? controller.previousChange() : controller.nextChange())
            : (backward ? controller.previousProblem() : controller.nextProblem());

    if (!moved) {
        return 'none';
    }

    let after = caret(controller.document.selection);

    return (backward ? after >= before : after <= before) ? 'wrapped' : 'moved';
}

function reported(controller: CodeController) {
    return new Promise<void>((resolve) => {
        let stop = root((dispose) => {
                effect(() => {
                    let { errors, warnings } = controller.state.problems;

                    if (errors || warnings) {
                        queueMicrotask(finish);
                    }
                });

                return dispose;
            }),
            timer = setTimeout(finish, PROBLEMS_WAIT);

        function finish() {
            clearTimeout(timer);
            stop();
            resolve();
        }
    });
}


// Next and previous change or problem across files: within the shown file first, through the editor's own
// commands, and once none are left that way, on to the next file the explorer marks, starting from its first.
const navigate = ({ bindings, hosting, model, tree }: Options) => {
    let bound: ReturnType<Options['bindings']> | null = null,
        resolve = keymap(mac());

    async function go(kind: FileTreeJump, backward = false) {
        let active = model.state.active,
            controller = active && (await hosting.whenShown(active)),
            left: Selection | undefined,
            result: Step = 'none';

        if (active && code(controller) && model.state.active === active) {
            left = controller.document.selection;
            result = step(controller, kind, backward);

            if (result === 'moved') {
                return true;
            }
        }

        hosting.mark();

        let explorer = tree(),
            element = explorer && (await (backward ? explorer.previous(kind) : explorer.next(kind)));

        if (!element || element.id === active?.path) {
            if (result === 'none') {
                model.status(kind === 'change' ? 'No changes' : 'No problems');
            }

            return result !== 'none';
        }

        // The file left behind keeps its caret where it was, not where the wrap put it.
        if (result === 'wrapped' && code(controller) && left) {
            controller.select(left, false);
        }

        let tab = await model.open(element.id);

        return !!tab && model.state.active === tab && arrive(tab, kind, backward);
    }

    async function arrive(tab: WorkspaceTab, kind: FileTreeJump, backward: boolean) {
        let controller = await hosting.whenShown(tab);

        if (!code(controller) || model.state.active !== tab) {
            return !!controller;
        }

        if (kind === 'change') {
            let text = await hosting.loaded(tab.path);

            if (text != null) {
                controller.setBaseline(text);
            }
        }
        else if (!controller.state.problems.errors && !controller.state.problems.warnings) {
            await reported(controller);
        }

        if (model.state.active !== tab) {
            return false;
        }

        // From the far end, the editor's own wrap lands on the file's first one, or its last going backward.
        controller.select({ start: backward ? 0 : controller.document.value.length }, false);
        step(controller, kind, backward);

        return true;
    }

    function keydown(event: KeyboardEvent) {
        if (event.defaultPrevented || event.isComposing) {
            return;
        }

        let next = bindings();

        if (next !== bound) {
            bound = next;
            resolve = keymap(mac(), next);
        }

        let command = resolve(event),
            jump = command && COMMANDS[command];

        if (!jump) {
            return;
        }

        // Ahead of the editor, which would only wrap around within its own file.
        event.preventDefault();
        event.stopPropagation();
        void go(jump[0], jump[1]);
    }

    return {
        connect(element: HTMLElement) {
            let listening = new AbortController();

            element.addEventListener('keydown', keydown, { capture: true, signal: listening.signal });

            return () => listening.abort();
        },
        go
    };
};


export default navigate;
export { step };
