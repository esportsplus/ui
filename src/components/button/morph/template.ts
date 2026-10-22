import { html, type Attributes, type Renderable } from '@esportsplus/template';
import { effect, reactive } from '@esportsplus/reactivity';
import { timing } from '~/shared/animation';


type A = Attributes & {
    [BUTTON_MORPH_CONTENT]?: Attributes;
    announce?: Partial<Record<Status, string>>;
    compact?: (status: Status) => boolean;
    onaction: () => Promise<unknown>;
    onclick?: never;
    onconnect?: never;
    ondisconnect?: never;
    state?: State;
    successFor?: number;
};

type State = { status: Status };

type Status = 'error' | 'idle' | 'loading' | 'success';


const BUTTON_MORPH_CONTENT = Symbol.for('@esportsplus/ui/button.morph.content');


function busy(status: Status) {
    return status === 'loading' || status === 'success';
}


// The button runs `onaction` through idle → loading → success | error and carries the status as a
// 'button--morph-{status}' class; content layers key off that class (or `state`) to swap in place.
export default function(
    this: { attributes?: Partial<A> } | void,
    { announce, compact = busy, onaction, state = reactive({ status: 'idle' as Status }), successFor = 1500, ...attributes }: A,
    content: Renderable<unknown>
) {
    let attempt = 0,
        morph: Animation | undefined,
        reset: ReturnType<typeof setTimeout> | undefined;

    function resize(element: HTMLElement, compacted: boolean) {
        let computed = getComputedStyle(element),
            from = computed.width,
            resize = timing(computed, 'resize');

        morph?.cancel();
        element.style.width = compacted ? 'var(--height)' : '';

        if (!resize) {
            return;
        }

        morph = element.animate([{ width: from }, { width: computed.width }], resize);
    }

    async function run() {
        if (busy(state.status)) {
            return;
        }

        let id = ++attempt;

        clearTimeout(reset);
        state.status = 'loading';

        try {
            await onaction();

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
                class: () => `button--morph-${state.status}`,
                onclick: run,
                onconnect: (element: HTMLElement) => {
                    let compacted = compact(state.status);

                    if (compacted) {
                        element.style.width = 'var(--height)';
                    }

                    effect(() => {
                        let next = compact(state.status);

                        if (next !== compacted) {
                            compacted = next;
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
                class='button-morph-content'
                ${this?.attributes?.[BUTTON_MORPH_CONTENT]}
                ${attributes[BUTTON_MORPH_CONTENT]}
            >
                ${content}
            </span>
            <span aria-live='polite' class='button-morph-live'>${() => announce?.[state.status] ?? ''}</span>
        </button>
    `;
}
export { BUTTON_MORPH_CONTENT };
export type { A, State, Status };
