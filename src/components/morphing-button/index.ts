import { html, type Attributes } from '@esportsplus/template';
import { effect, reactive } from '@esportsplus/reactivity';
import './scss/index.scss';


type A = Attributes & {
    [MORPHING_BUTTON_CONTENT]?: Attributes;
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

const MORPHING_BUTTON_CONTENT = Symbol.for('@esportsplus/ui/morphing-button.content');

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

function reduced() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
}


export default Object.assign(
    function(this: { attributes?: Partial<A> } | void, { label = 'Save changes', onsave, retryLabel = 'Try again', state = reactive({ status: 'idle' as Status }), successFor = 1500, ...attributes }: A) {
        let attempt = 0,
            morph: Animation | undefined,
            reset: ReturnType<typeof setTimeout> | undefined,
            shake: Animation | undefined,
            stop: VoidFunction | undefined;

        function resize(element: HTMLElement, compact: boolean) {
            let from = getComputedStyle(element).width;

            morph?.cancel();
            element.style.width = compact ? 'var(--morphing-button-height)' : '';

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
                class='button morphing-button'
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
                    class: () => `morphing-button--${state.status}`,
                    onclick: save,
                    onconnect: (element: HTMLElement) => {
                        let compact = busy(state.status);

                        if (compact) {
                            element.style.width = 'var(--morphing-button-height)';
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
                    class='morphing-button-content'
                    ${this?.attributes?.[MORPHING_BUTTON_CONTENT]}
                    ${attributes[MORPHING_BUTTON_CONTENT]}
                >
                    <span class='morphing-button-text morphing-button-text--idle'>${label}</span>
                    <span class='morphing-button-text morphing-button-text--error'>${retryLabel}</span>
                    <svg class='morphing-button-icon morphing-button-icon--loading' viewBox='0 0 16 16'>
                        <g class='morphing-button-spinner'>
                            <circle cx='8' cy='8' r='6' opacity='0.25' />
                            <path d='M8 2a6 6 0 0 1 6 6' />
                        </g>
                    </svg>
                    <svg class='morphing-button-icon morphing-button-icon--success' viewBox='0 0 16 16'>
                        <path d='m3.5 8.5 3 3 6-7' />
                    </svg>
                </span>
                <span aria-live='polite' class='morphing-button-live'>${() => ANNOUNCE[state.status]}</span>
            </button>
        `;
    },
    { content: MORPHING_BUTTON_CONTENT } as const
);
