import { component, html, type Attributes } from '@esportsplus/template';
import { effect, flush, onCleanup, reactive, untrack } from '@esportsplus/reactivity';
import { morph, morphing } from '~/components/tooltip/utilities';
import '~/components/tooltip/scss/index.scss';
import './scss/index.scss';


type A = Attributes & {
    direction?: Direction;
    // Milliseconds an error shows before it clears 'state.error' itself, counted from its latest failure; left out, it
    // shows until its owner clears it.
    duration?: number;
    onanimationcancel?: never;
    onanimationend?: never;
    onanimationstart?: never;
    onconnect?: never;
    ontransitioncancel?: never;
    ontransitionend?: never;
    ontransitionrun?: never;
    state: { error: string };
};

type Direction = 'e' | 'en' | 'es' | 'n' | 'ne' | 'nw' | 's' | 'se' | 'sw' | 'w' | 'wn' | 'ws';


// The morph tooltip's '--morph-close-duration', plus a frame: a new message reopens once the old one has landed.
const CLOSE = 180;


// Wraps one control, so it works on any element that keeps its error in 'state.error': the control shakes and its
// edge turns red, and the message grows out of it in the morph tooltip. The wrapper is the tooltip's trigger and holds
// still while the control shakes inside it, so the tooltip stays put. A repeat of the same message is written as ''
// and then the message, flushed in between, which shakes the control again without closing the tooltip.
export default component<A>(({ direction = 'ne', duration, state, ...attributes }, content) => {
    let control: Element | null = null,
        disposed = false,
        element: HTMLElement | undefined,
        expire: ReturnType<typeof setTimeout> | undefined,
        frame = 0,
        local = reactive({ active: false, message: '', morphing: false, shake: 0 }),
        opening: VoidFunction | undefined,
        pending = 0,
        reopen: ReturnType<typeof setTimeout> | undefined,
        shown = '',
        tooltip: HTMLElement | undefined;

    function close() {
        clearTimeout(reopen);
        opening?.();
        opening = undefined;
        local.active = false;
        land();
    }

    // The close lands on the control's box as the open measured it, but the control can change size in the meantime,
    // so the landing is measured again every frame the close runs, with the same insets the open seeds.
    function land() {
        cancelAnimationFrame(frame);

        let until = performance.now() + CLOSE;

        (function measure() {
            if (!element || !tooltip) {
                return;
            }

            let box = tooltip.getBoundingClientRect(),
                rect = element.getBoundingClientRect(),
                style = tooltip.style;

            style.setProperty('--morph-bottom', `${box.bottom - rect.bottom}px`);
            style.setProperty('--morph-left', `${rect.left - box.left}px`);
            style.setProperty('--morph-right', `${box.right - rect.right}px`);
            style.setProperty('--morph-top', `${rect.top - box.top}px`);

            if (performance.now() < until) {
                frame = requestAnimationFrame(measure);
            }
        })();
    }

    // Flushed before the open measures the tooltip's box, which the message sizes. The morph starts from the wrapper's
    // corners, so the wrapper takes the control's.
    function open(text: string) {
        if (!element) {
            return;
        }

        cancelAnimationFrame(frame);
        shown = text;
        local.message = text;
        flush();

        if (control) {
            element.style.borderRadius = getComputedStyle(control).borderRadius;
        }

        opening = morph(element, () => {
            opening = undefined;
            local.active = true;
        });
    }

    function show(text: string) {
        cancelAnimationFrame(pending);
        clearTimeout(reopen);
        // Alternating the parity swaps between identical keyframes, restarting the shake.
        local.shake = local.shake === 1 ? 2 : 1;

        if (!local.active && !opening) {
            open(text);
        }
        else if (text !== shown) {
            close();
            reopen = setTimeout(() => open(text), CLOSE);
        }
    }

    onCleanup(effect(() => {
        let text = state.error;

        untrack(() => {
            clearTimeout(expire);
            control?.setAttribute('aria-invalid', text ? 'true' : 'false');

            if (text) {
                // After the pass running this effect, where the open's flush would be a no-op.
                queueMicrotask(() => {
                    if (!disposed && state.error === text) {
                        show(text);
                    }
                });

                if (duration) {
                    expire = setTimeout(() => {
                        state.error = '';
                    }, duration);
                }

                return;
            }

            // A frame late, so a repeat's '' followed at once by the message shakes rather than closes.
            cancelAnimationFrame(pending);
            pending = requestAnimationFrame(close);
        });
    }));

    onCleanup(() => {
        disposed = true;
        cancelAnimationFrame(frame);
        cancelAnimationFrame(pending);
        clearTimeout(expire);
        clearTimeout(reopen);
        opening?.();
    });

    return html`
        <div
            class='error tooltip'
            ${attributes}
            ${{
                class: [
                    () => local.active && '--active',
                    () => state.error && 'error--invalid',
                    () => local.morphing && 'tooltip--morphing',
                    () => local.shake && `error--shake-${local.shake}`
                ],
                onanimationcancel: morphing(local, false),
                onanimationend: morphing(local, false),
                onanimationstart: morphing(local, true),
                onconnect: (el: HTMLElement) => {
                    control = el.firstElementChild;
                },
                onrender: (el: HTMLElement) => {
                    element = el;
                },
                ontransitioncancel: morphing(local, false),
                ontransitionend: morphing(local, false),
                ontransitionrun: morphing(local, true)
            }}
        >
            ${content}
            <div
                aria-hidden='true'
                class='error-message tooltip-content tooltip-content--${direction} tooltip-content--morph'
                ${{ onrender: (el: HTMLElement) => { tooltip = el; } }}
            >
                <span>${() => local.message}</span>
            </div>
            <span aria-live='polite' class='error-live'>${() => state.error}</span>
        </div>
    `;
});

export type { Direction };
