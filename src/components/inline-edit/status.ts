import { html, type Attributes } from '@esportsplus/template';
import { effect, isPromise, onCleanup, reactive } from '@esportsplus/reactivity';
import check from '@esportsplus/ui/svg/check.svg';


type Phase = 'saved' | 'saving' | 'unsaved';

type Status = {
    phase: Phase;
    savedAt: number | null;
};


const INLINE_EDIT_STATUS = Symbol.for('@esportsplus/ui/inline-edit.status');

const MINUTE = 60_000;

// Long enough to notice after the field settles, short enough that the pencil is back before the next edit.
const SAVED_FOR = 1600;


// Reads like a person would say it, and only changes when those words would.
function text({ phase, savedAt }: Status, now: number) {
    if (phase === 'saving') {
        return 'Saving';
    }

    if (phase === 'unsaved') {
        return 'Unsaved changes';
    }

    if (savedAt === null) {
        return 'Saved';
    }

    let ago = now - savedAt;

    if (ago < 45_000) {
        return 'Saved just now';
    }

    if (ago < 60 * MINUTE) {
        return `Saved ${Math.max(1, Math.floor(ago / MINUTE))} min ago`;
    }

    return `Saved at ${new Date(savedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

// Drives the status from the field: unsaved while the edit differs from the saved value, saving while 'onsave's
// promise is pending, saved once it settles (unsaved again if it fails). Returns what reports a save's result.
function track(status: Status, dirty: () => boolean) {
    let sequence = 0;

    effect(dirty, (changed, previous) => {
        if (previous === undefined) {
            return;
        }

        if (changed) {
            // A save still pending no longer covers everything.
            sequence++;
            status.phase = 'unsaved';
        }
        else if (status.phase === 'unsaved') {
            status.phase = 'saved';
        }
    });

    return (result: unknown) => {
        let id = ++sequence;

        if (!isPromise(result)) {
            status.phase = 'saved';
            status.savedAt = Date.now();
            return;
        }

        status.phase = 'saving';
        result.then(
            () => {
                if (id === sequence) {
                    status.phase = 'saved';
                    status.savedAt = Date.now();
                }
            },
            () => {
                if (id === sequence) {
                    status.phase = 'unsaved';
                }
            }
        );
    };
}


// One set of three dots throughout: a single dot means there are changes, it splits into three that pulse while
// saving, and the three gather back into the middle as the check draws.
const render = (status: Status, context?: Attributes, attributes?: Attributes) => {
    let clock = reactive({ now: Date.now() }),
        current = 0,
        slots = [
            reactive({ phase: '', text: '' }),
            reactive({ phase: '', text: '' })
        ];

    effect(
        () => text(status, clock.now),
        (value, previous) => {
            if (previous === undefined) {
                slots[current].text = value;
                return;
            }

            if (value === previous) {
                return;
            }

            // Two stacked slots let the old words leave while the new ones arrive in the same spot.
            slots[current].phase = 'exit';
            current = current === 0 ? 1 : 0;
            slots[current].phase = 'enter';
            slots[current].text = value;
        }
    );

    effect(() => {
        if (status.phase !== 'saved' || status.savedAt === null) {
            return;
        }

        let timer = setInterval(() => clock.now = Date.now(), MINUTE / 2);

        onCleanup(() => clearInterval(timer));
    });

    return html`
        <div class='inline-edit-status' ${context} ${attributes} ${{ class: () => `inline-edit-status--${status.phase}` }}>
            <span aria-hidden='true' class='inline-edit-status-icon'>
                <span class='inline-edit-status-dot' style='--i: 0;'></span>
                <span class='inline-edit-status-dot' style='--i: 1;'></span>
                <span class='inline-edit-status-dot' style='--i: 2;'></span>
                <svg class='inline-edit-status-check'><use href='#${check}' /></svg>
            </span>
            <span class='inline-edit-status-label'>
                ${slots.map((slot) => html`
                    <span
                        aria-hidden='${() => slot.phase === 'exit' ? 'true' : 'false'}'
                        class='inline-edit-status-label-text ${() => slot.phase && `inline-edit-status-label-text--${slot.phase}`}'
                    >
                        ${() => slot.text}
                    </span>
                `)}
            </span>
            <span aria-live='polite' class='inline-edit-status-announcement'>
                ${() => status.phase === 'saved' && status.savedAt !== null && 'All changes saved'}
            </span>
        </div>
    `;
};

// What saving does, for either field: the value is taken, flagged saved for a moment and handed to 'onsave', and the
// status follows the result when 'option' asks for one ('true' for its own, or one passed in to read or drive it).
// 'dirty' is whether the edit differs from the saved value.
const saver = (
    state: { editing: boolean, saved: boolean, value: string },
    option: boolean | Status,
    dirty: () => boolean,
    onsave?: (value: string) => unknown
) => {
    let shown = option === true ? reactive<Status>({ phase: 'saved', savedAt: null }) : option || null,
        report = shown ? track(shown, () => state.editing && dirty()) : null,
        timer: ReturnType<typeof setTimeout> | undefined;

    return {
        dispose: () => {
            clearTimeout(timer);
        },
        save: (value: string) => {
            state.value = value;
            state.saved = true;
            report?.(onsave?.(value));
            clearTimeout(timer);
            timer = setTimeout(() => {
                state.saved = false;
            }, SAVED_FOR);
        },
        status: shown
    };
};


export default { render, saver };
export { INLINE_EDIT_STATUS };
export type { Phase, Status };
