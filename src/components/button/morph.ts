import { component, html, type Attributes } from '@esportsplus/template';
import { effect, reactive } from '@esportsplus/reactivity';
import { timing } from '~/shared/animation';
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


function busy(status: Status) {
    return status === 'loading' || status === 'success';
}


export default component(
    function(this: { attributes?: Partial<A> } | void, { label = 'Save changes', onsave, retryLabel = 'Try again', state = reactive({ status: 'idle' as Status }), successFor = 1500, ...attributes }: A) {
        let attempt = 0,
            morph: Animation | undefined,
            reset: ReturnType<typeof setTimeout> | undefined;

        function resize(element: HTMLElement, compact: boolean) {
            let computed = getComputedStyle(element),
                from = computed.width,
                resize = timing(computed, 'morph-resize');

            morph?.cancel();
            element.style.width = compact ? 'var(--morph-height)' : '';

            if (!resize) {
                return;
            }

            morph = element.animate([{ width: from }, { width: computed.width }], resize);
        }

        async function save() {
            if (busy(state.status)) {
                return;
            }

            let id = ++attempt;

            clearTimeout(reset);
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

                        effect(() => {
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
                    }
                }}
            >
                <span
                    aria-hidden='true'
                    class='button-morph-content'
                    ${this?.attributes?.[BUTTON_MORPH_CONTENT]}
                    ${attributes[BUTTON_MORPH_CONTENT]}
                >
                    <span class='button-morph-text ${() => state.status === 'idle' && '--active'}'>${label}</span>
                    <span class='button-morph-text ${() => state.status === 'error' && '--active'}'>${retryLabel}</span>
                    <svg class='button-morph-icon button-morph-icon--loading'><use class='button-morph-spinner' href='#${spinner}' /></svg>
                    <svg class='button-morph-icon button-morph-icon--success'><use href='#${check}' /></svg>
                </span>
                <span aria-live='polite' class='button-morph-live'>${() => ANNOUNCE[state.status]}</span>
            </button>
        `;
    },
    { content: BUTTON_MORPH_CONTENT }
);
