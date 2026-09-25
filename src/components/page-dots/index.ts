import { html, type Attributes } from '@esportsplus/template';
import { effect, onCleanup, reactive } from '@esportsplus/reactivity';
import './scss/index.scss';


type A = Attributes & {
    [PAGE_DOTS_DOT]?: Attributes;
    // Milliseconds the pill takes to fill while 'state.running'; omitted for plain dots.
    autoplay?: number;
    count: number;
    onelapsed?: (active: number) => void;
    onpage?: (index: number) => void;
    state?: State;
};

type State = {
    active: number;
    // Continuous page index (1.5 is halfway between the second and third page) so the dots follow a scroll or drag frame by frame.
    progress: number;
    running: boolean;
};


const PAGE_DOTS_DOT = Symbol.for('@esportsplus/ui/page-dots.dot');

// Paused partway, the fill eases back to full rather than snapping, so a paused pill reads as solid, not half done.
const SETTLE: KeyframeAnimationOptions = { duration: 200, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' };


function template(
    this: { attributes?: Partial<A> } | void,
    { autoplay, count, onelapsed, onpage, state = reactive({ active: 0, progress: 0, running: false }), ...attributes }: A
) {
    let element: HTMLElement | undefined,
        fill: HTMLElement | undefined,
        local = reactive({ connected: false }),
        settle: Animation | undefined,
        stops = [
            effect(() => {
                let active = Math.min(Math.max(Math.round(state.progress), 0), count - 1);

                element?.style.setProperty('--progress', String(state.progress));

                if (state.active !== active) {
                    state.active = active;
                }
            }),
            effect((cleanup) => {
                // Read before any early return so every input stays a dependency.
                let active = state.active,
                    running = local.connected && state.running;

                if (!autoplay || !fill || !running) {
                    return;
                }

                let target = fill;

                settle?.cancel();

                // The countdown is the timer: when the fill finishes, the page advances.
                let countdown = target.animate(
                    [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
                    { duration: autoplay, easing: 'linear' }
                );

                countdown.onfinish = () => onelapsed?.(active);

                cleanup(() => {
                    countdown.onfinish = null;

                    if (countdown.playState !== 'running') {
                        return;
                    }

                    let from = getComputedStyle(target).transform;

                    countdown.cancel();
                    settle = target.animate([{ transform: from }, { transform: 'scaleX(1)' }], SETTLE);
                });
            })
        ];

    onCleanup(() => {
        settle?.cancel();

        for (let i = 0, n = stops.length; i < n; i++) {
            stops[i]();
        }
    });

    return html`
        <div
            aria-label='Pages'
            class='page-dots ${autoplay && 'page-dots--autoplay'}'
            role='group'
            style='${`--count: ${count}; --progress: ${state.progress};`}'
            ${this?.attributes}
            ${attributes}
            ${{
                onconnect: () => {
                    local.connected = true;
                },
                ondisconnect: () => {
                    local.connected = false;
                },
                onrender: (el: HTMLElement) => {
                    element = el;
                }
            }}
        >
            ${Array.from({ length: count }, (_, i) => html`
                <button
                    aria-current='${() => state.active === i && 'page'}'
                    aria-label='${`Page ${i + 1} of ${count}`}'
                    class='page-dots-dot'
                    onclick='${() => onpage?.(i)}'
                    style='${`--index: ${i};`}'
                    type='button'
                    ${this?.attributes?.[PAGE_DOTS_DOT]}
                    ${attributes[PAGE_DOTS_DOT]}
                >
                    <span class='page-dots-mark'></span>
                </button>
            `)}
            <span aria-hidden='true' class='page-dots-pill'>
                ${autoplay && html`
                    <span class='page-dots-fill' onrender='${(el: HTMLElement) => { fill = el; }}'></span>
                `}
            </span>
        </div>
    `;
}


export default Object.assign(template, { dot: PAGE_DOTS_DOT } as const);
export type { State };
