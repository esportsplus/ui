import { html, type Attributes } from '@esportsplus/template';
import { effect, onCleanup, reactive } from '@esportsplus/reactivity';
import './scss/index.scss';


type State = {
    savedAt: number | null;
    status: Status;
};

type Status = 'saved' | 'saving' | 'unsaved';


const MINUTE = 60_000;


// Reads like a person would say it, and only changes when those words would.
function text({ savedAt, status }: State, now: number) {
    if (status === 'saving') {
        return 'Saving';
    }

    if (status === 'unsaved') {
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


export default ({ state = reactive<State>({ savedAt: null, status: 'saved' }), ...attributes }: Attributes & { state?: State }) => {
    let clock = reactive({ now: Date.now() }),
        current = 0,
        slots = [
            reactive({ phase: '', text: '' }),
            reactive({ phase: '', text: '' })
        ],
        stopLabel = effect(
            () => text(state, clock.now),
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
        ),
        stopTick = effect(() => {
            if (state.status !== 'saved' || state.savedAt === null) {
                return;
            }

            let timer = setInterval(() => clock.now = Date.now(), MINUTE / 2);

            onCleanup(() => clearInterval(timer));
        });

    onCleanup(() => {
        stopLabel();
        stopTick();
    });

    return html`
        <div class='autosave' ${attributes} ${{ 'data-status': () => state.status }}>
            <span aria-hidden='true' class='autosave-icon'>
                <span class='autosave-dot' style='--i: 0;'></span>
                <span class='autosave-dot' style='--i: 1;'></span>
                <span class='autosave-dot' style='--i: 2;'></span>
                <svg class='autosave-check' viewBox='0 0 16 16'>
                    <path d='M3.75 8.25l2.75 2.75 5.75-6' pathLength='1' />
                </svg>
            </span>
            <span class='autosave-label'>
                ${slots.map((slot) => html`
                    <span
                        aria-hidden='${() => slot.phase === 'exit' ? 'true' : 'false'}'
                        data-phase='${() => slot.phase}'
                    >
                        ${() => slot.text}
                    </span>
                `)}
            </span>
            <span aria-live='polite' class='autosave-announcement'>
                ${() => state.status === 'saved' && state.savedAt !== null ? 'All changes saved' : ''}
            </span>
        </div>
    `;
};

export type { State, Status };
