import { reactive } from '@esportsplus/reactivity';


type Handlers = {
    // A composition is starting; capture the selection it replaces.
    begin: VoidFunction;
    // It ended. 'conflict' is true when the document changed underneath it, so its native text must be discarded.
    commit: (conflict: boolean) => void;
};


// IME composition for a native text field: nothing may write the field while it lasts, and its result is committed
// once, as one undo step, after the final input. Engines differ on whether that input comes before or after
// 'compositionend', so the commit waits for whichever is last.
const composition = ({ begin, commit }: Handlers) => {
    let conflict = false,
        pending = false,
        state = reactive({ composing: false }),
        timer: ReturnType<typeof setTimeout> | undefined;

    function finish() {
        if (state.composing || !pending) {
            return;
        }

        clearTimeout(timer);
        pending = false;
        timer = undefined;

        let conflicted = conflict;

        conflict = false;
        commit(conflicted);
    }

    return {
        attributes: {
            oncompositionend: () => {
                pending = true;
                state.composing = false;
                timer = setTimeout(finish, 0);
            },
            oncompositionstart: () => {
                finish();
                begin();
                conflict = false;
                state.composing = true;
            }
        },
        // True while composing or waiting to commit; writes to the field must wait.
        busy: () => state.composing || pending,
        // The document changed under an active composition.
        conflict: () => {
            if (state.composing || pending) {
                conflict = true;
            }
        },
        // Commits now, mid-composition included; for teardown.
        flush: () => {
            if (state.composing) {
                pending = true;
                state.composing = false;
            }

            finish();
        },
        // Call first from the field's input handler: true when the input belongs to the composition.
        input: (e: InputEvent) => {
            if (state.composing || e.isComposing) {
                return true;
            }

            if (pending) {
                finish();
                return true;
            }

            return false;
        },
        state
    };
};


export { composition };
