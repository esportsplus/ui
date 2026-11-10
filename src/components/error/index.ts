import { effect, onCleanup, reactive, root, untrack } from '@esportsplus/reactivity';
import { component, html, setProperties, type Attributes, type Element as Bound } from '@esportsplus/template';
import { overlay, type GlassMode } from '~/modifiers/glass';
import { observe } from '~/shared/resize';
import '~/components/tooltip/scss/index.scss';
import './scss/index.scss';


type A = Attributes & {
    direction?: Direction;
    // Milliseconds an error shows before it clears 'state.error' itself, counted from its latest failure; left out, it
    // shows until its owner clears it.
    duration?: number;
    // Frosts the message over whatever it overlays with the glass modifier's blur layer, and marks the wrapper
    // 'error--glass'. The layer alone, not the modifier's '--glass' class, which would position the message in place.
    glass?: GlassMode;
    onconnect?: never;
    onfocusout?: never;
    state: { error: string };
};

// Where a message wider than the control runs: centered on it, from its start edge, or from its end edge.
type Direction = 's' | 'se' | 'sw';


const ERROR_STATE = Symbol('error.control');


// The consumer's control, which its own template renders, so the error marks it invalid through a store bound on it.
function validity(element: Element) {
    let store = element as Element & { [ERROR_STATE]?: { invalid: 'false' | 'true' | undefined } };

    return store[ERROR_STATE] ??= root(() => {
        let state = reactive({ invalid: undefined as 'false' | 'true' | undefined });

        setProperties(element as Bound, { 'aria-invalid': () => state.invalid });

        return state;
    });
}


// Wraps one control, so it works on any element that keeps its error in 'state.error': the control shakes and its
// edge turns red, and the message shows in a tooltip that wraps the control, a gap's width out on every side, behind it
// and over everything around it, with the message under the control; it overlays what follows instead of pushing it
// down. The control's height and corners, which only layout knows, are measured so the tooltip clears and rounds
// around it. The wrapper is the tooltip's trigger and holds still while the control shakes inside it, so the tooltip stays put. Focus
// leaving the wrapper clears 'state.error'; a select's menu renders inside it, so picking an option isn't leaving. A
// repeat of the same message is written as '' and then the message, flushed in between, which shakes the control again
// without closing the tooltip.
export default component<A>(({ direction = 'sw', duration, glass: frost, state, ...attributes }, content) => {
    let control: Element | null = null,
        expire: ReturnType<typeof setTimeout> | undefined,
        local = reactive({ active: false, height: 0, leaving: false, message: '', radius: undefined as string | undefined, shake: 0 }),
        pending = 0,
        settle = 0;

    // The message goes at once, and the control drops its red in the same frame rather than fading back; 'leaving'
    // holds its transitions off until that frame has painted.
    function close() {
        local.active = false;
        settle = requestAnimationFrame(() => {
            local.leaving = false;
        });
    }

    function measure() {
        if (!control) {
            return;
        }

        local.height = (control as HTMLElement).offsetHeight;
        local.radius = getComputedStyle(control).borderTopLeftRadius;
    }

    function show(text: string) {
        cancelAnimationFrame(pending);
        cancelAnimationFrame(settle);
        local.active = true;
        local.leaving = false;
        local.message = text;
        // Alternating the parity swaps between identical keyframes, restarting the shake.
        local.shake = local.shake === 1 ? 2 : 1;
    }

    effect(() => {
        let text = state.error;

        untrack(() => {
            clearTimeout(expire);

            if (control) {
                validity(control).invalid = text ? 'true' : 'false';
            }

            if (text) {
                show(text);

                if (duration) {
                    expire = setTimeout(() => {
                        state.error = '';
                    }, duration);
                }

                return;
            }

            // Set with the control's validity, which is what its transitions would fade.
            local.leaving = local.active;

            // A frame late, so a repeat's '' followed at once by the message shakes rather than closes.
            cancelAnimationFrame(pending);
            pending = requestAnimationFrame(close);
        });
    });

    onCleanup(() => {
        cancelAnimationFrame(pending);
        cancelAnimationFrame(settle);
        clearTimeout(expire);
    });

    return html`
        <div
            class='error tooltip'
            ${attributes}
            ${{
                class: [
                    () => local.active && '--active',
                    frost && 'error--glass',
                    () => state.error && 'error--invalid',
                    () => local.leaving && 'error--leaving',
                    () => local.shake && `error--shake-${local.shake}`
                ],
                onconnect: (el: HTMLElement) => {
                    control = el.firstElementChild;

                    if (control) {
                        onCleanup(observe(control, measure));
                    }
                },
                onfocusout: (e: FocusEvent) => {
                    let next = e.relatedTarget as Node | null;

                    if (next && (e.currentTarget as HTMLElement).contains(next)) {
                        return;
                    }

                    state.error = '';
                }
            }}
        >
            ${content}
            <div
                aria-hidden='true'
                class='error-message error-message--${direction} tooltip-message'
                ${{
                    style: () => ({
                        '--error-host-height': `${local.height}px`,
                        '--error-host-radius': local.radius
                    })
                }}
            >
                ${frost && overlay(frost)}
                ${() => local.message}
            </div>
            <span aria-live='polite' class='error-live'>${() => state.error}</span>
        </div>
    `;
});

export type { Direction };
