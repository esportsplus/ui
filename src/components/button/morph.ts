import { component, html, type Attributes } from '@esportsplus/template';
import { effect, reactive } from '@esportsplus/reactivity';
import { reduced } from '~/lib/animation';
import check from '@esportsplus/ui/svg/check.svg';
import spinner from '@esportsplus/ui/svg/spinner.svg';


type A = Attributes & {
    [BUTTON_MORPH_CONTENT]?: Attributes;
    label?: string;
    onclick?: never;
    onconnect?: never;
    ondisconnect?: never;
    onsave: () => Promise<unknown>;
    retryLabel?: string;
    state?: State;
    successFor?: number;
};

type State = { status: Status };

type Status = 'error' | 'idle' | 'loading' | 'success';


const ANNOUNCE: Record<Status, string> = {
    error: 'Couldn\'t save. Try again.',
    idle: '',
    loading: 'Saving',
    success: 'Changes saved'
};

const BUTTON_MORPH_CONTENT = Symbol.for('@esportsplus/ui/button.morph.content');

// Swings that die away, like a head shaking no.
const SHAKE: Keyframe[] = [
    { translate: '0' },
    { translate: '-6px' },
    { translate: '5px' },
    { translate: '-3px' },
    { translate: '2px' },
    { translate: '0' }
];

const SPRING = 'linear(0, 0.057, 0.18, 0.321, 0.455, 0.573, 0.671, 0.75, 0.812, 0.86, 0.896, 0.924, 0.944, 0.96, 0.971, 0.979, 0.985, 0.989, 0.992, 0.994, 0.996, 0.997, 0.998, 0.999, 1)';


function busy(status: Status) {
    return status === 'loading' || status === 'success';
}


export default component(
    function(this: { attributes?: Partial<A> } | void, { label = 'Save changes', onsave, retryLabel = 'Try again', state = reactive({ status: 'idle' as Status }), successFor = 1500, ...attributes }: A) {
        let attempt = 0,
            morph: Animation | undefined,
            reset: ReturnType<typeof setTimeout> | undefined,
            shake: Animation | undefined,
            stop: VoidFunction | undefined;

        function resize(element: HTMLElement, compact: boolean) {
            let from = getComputedStyle(element).width;

            morph?.cancel();
            element.style.width = compact ? 'var(--morph-height)' : '';

            if (reduced()) {
                return;
            }

            morph = element.animate(
                [{ width: from }, { width: getComputedStyle(element).width }],
                { duration: 300, easing: SPRING }
            );
        }

        async function save(this: HTMLElement) {
            if (busy(state.status)) {
                return;
            }

            let element = this,
                id = ++attempt;

            clearTimeout(reset);
            shake?.cancel();
            state.status = 'loading';

            try {
                await onsave();

                if (id !== attempt) {
                    return;
                }

                state.status = 'success';
                reset = setTimeout(() => {
                    state.status = 'idle';
                }, successFor);
            }
            catch {
                if (id !== attempt) {
                    return;
                }

                state.status = 'error';

                if (reduced()) {
                    return;
                }

                // Waits for the width to mostly open so it shakes the settled shape.
                shake = element.animate(SHAKE, { delay: 150, duration: 350, easing: 'ease-in-out' });
            }
        }

        return html`
            <button
                class='button button--morph'
                type='button'
                ${this?.attributes}
                ${attributes}
                ${{
                    'aria-disabled': () => busy(state.status) ? 'true' : 'false',
                    'aria-label': () => {
                        switch (state.status) {
                            case 'error':
                                return retryLabel;
                            case 'loading':
                                return 'Saving';
                            case 'success':
                                return 'Saved';
                            default:
                                return label;
                        }
                    },
                    class: () => `button--morph-${state.status}`,
                    onclick: save,
                    onconnect: (element: HTMLElement) => {
                        let compact = busy(state.status);

                        if (compact) {
                            element.style.width = 'var(--morph-height)';
                        }

                        stop = effect(() => {
                            let next = busy(state.status);

                            if (next !== compact) {
                                compact = next;
                                resize(element, next);
                            }
                        });
                    },
                    ondisconnect: () => {
                        attempt++;
                        clearTimeout(reset);
                        morph?.cancel();
                        shake?.cancel();
                        stop?.();
                    }
                }}
            >
                <span
                    aria-hidden='true'
                    class='button-morph-content'
                    ${this?.attributes?.[BUTTON_MORPH_CONTENT]}
                    ${attributes[BUTTON_MORPH_CONTENT]}
                >
                    <span class='button-morph-text button-morph-text--idle'>${label}</span>
                    <span class='button-morph-text button-morph-text--error'>${retryLabel}</span>
                    <svg class='button-morph-icon button-morph-icon--loading'><use class='button-morph-spinner' href='#${spinner}' /></svg>
                    <svg class='button-morph-icon button-morph-icon--success'><use href='#${check}' /></svg>
                </span>
                <span aria-live='polite' class='button-morph-live'>${() => ANNOUNCE[state.status]}</span>
            </button>
        `;
    },
    { content: BUTTON_MORPH_CONTENT }
);
