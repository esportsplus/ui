import { autosave, input, textarea } from '@esportsplus/ui';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import type { State } from '~/components/autosave';


// Every edit resets the clock; the save starts once typing pauses, and a new keystroke mid-save goes back to waiting.
function editor() {
    let pause: ReturnType<typeof setTimeout> | undefined,
        saving: ReturnType<typeof setTimeout> | undefined,
        state = reactive<State>({ savedAt: null, status: 'saved' });

    function edited() {
        clearTimeout(pause);
        clearTimeout(saving);
        state.status = 'unsaved';

        pause = setTimeout(() => {
            state.status = 'saving';

            // Stands in for the request, which never takes the same time twice.
            saving = setTimeout(() => {
                state.savedAt = Date.now();
                state.status = 'saved';
            }, 650 + Math.random() * 350);
        }, 800);
    }

    return html`
        <div
            class='card'
            style='--padding-horizontal: var(--size-500); --padding-vertical: var(--size-500); --border-radius: var(--border-radius-400); --box-shadow: var(--box-shadow-300); --width: min(440px, 100%); background: var(--color-grey-300);'
        >
            <div class='--flex-row --flex-vertical' style='gap: var(--size-400);'>
                ${input({ 'aria-label': 'Title', class: '--flex-fill', oninput: edited, placeholder: 'Untitled', value: 'Trip notes' })}
                ${autosave({ state })}
            </div>
            ${textarea({
                'aria-label': 'Note',
                oninput: edited,
                placeholder: 'Start writing',
                rows: 4,
                style: 'margin-top: var(--size-300);',
                value: 'Pack light this time. Two shirts, the grey jacket, and the charger that actually works.'
            })}
        </div>
    `;
}


export default {
    name: 'autosave',
    variants: [
        {
            render: () => editor(),
            title: 'note editor'
        },
        {
            render: () => autosave({ state: { savedAt: null, status: 'unsaved' } }),
            title: 'unsaved'
        },
        {
            render: () => autosave({ state: { savedAt: null, status: 'saving' } }),
            title: 'saving'
        },
        {
            render: () => autosave({ state: { savedAt: Date.now() - 12 * 60_000, status: 'saved' } }),
            title: 'saved'
        }
    ]
};
