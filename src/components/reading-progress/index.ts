import { html, type Attributes } from '@esportsplus/template';
import { onCleanup, reactive } from '@esportsplus/reactivity';
import './scss/index.scss';


type Ref = () => HTMLElement | null | undefined;


function clamp(value: number) {
    if (!Number.isFinite(value) || value < 0) {
        return 0;
    }

    return value > 1 ? 1 : value;
}


export default ({ doneLabel = 'End', label = 'Reading progress', scroller, steps = 24, target, words = 0, wordsPerMinute = 220, ...attributes }: Attributes & {
    doneLabel?: string;
    label?: string;
    // Scroll container, when the article lives in a pane rather than the document.
    scroller?: Ref;
    // Quantizes the scroll, capping how many renders a full scroll can cost.
    steps?: number;
    // Article element; progress runs from its top edge to its last visible line.
    target?: Ref;
    words?: number;
    wordsPerMinute?: number;
}) => {
    let dispose: VoidFunction | undefined,
        frame = 0,
        state = reactive({ step: 0 }),
        total = words > 0 ? Math.max(1, Math.ceil(words / wordsPerMinute)) : 0;

    function minutes() {
        return Math.ceil(((1 - progress()) * words) / wordsPerMinute);
    }

    function progress() {
        return steps > 0 ? state.step / steps : 1;
    }

    function read() {
        frame = 0;

        let container = scroller?.() ?? null,
            element = target?.() ?? null,
            ratio: number,
            travel: number,
            viewport = container ? container.clientHeight : window.innerHeight;

        if (element) {
            let rect = element.getBoundingClientRect();

            travel = rect.height - viewport;
            ratio = travel <= 0 ? 1 : ((container ? container.getBoundingClientRect().top : 0) - rect.top) / travel;
        }
        else if (container) {
            travel = container.scrollHeight - container.clientHeight;
            ratio = travel <= 0 ? 1 : container.scrollTop / travel;
        }
        else {
            travel = document.documentElement.scrollHeight - viewport;
            ratio = travel <= 0 ? 1 : window.scrollY / travel;
        }

        let step = Math.round(clamp(ratio) * steps);

        if (state.step !== step) {
            state.step = step;
        }
    }

    function schedule() {
        if (frame) {
            return;
        }

        frame = requestAnimationFrame(read);
    }

    onCleanup(() => {
        cancelAnimationFrame(frame);
        dispose?.();
    });

    return html`
        <div
            class='reading-progress'
            ${attributes}
            ${{
                class: () => state.step >= steps && '--complete',
                // Refs resolve a frame after connect so elements rendered later in the same template exist.
                onconnect: () => {
                    frame = requestAnimationFrame(() => {
                        let container = scroller?.() ?? null,
                            element = target?.() ?? null,
                            observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule),
                            source: EventTarget = container ?? window;

                        source.addEventListener('scroll', schedule, { passive: true });
                        window.addEventListener('resize', schedule);

                        if (element) {
                            observer?.observe(element);
                        }

                        if (container) {
                            observer?.observe(container);
                        }

                        if (!element && !container) {
                            observer?.observe(document.documentElement);
                        }

                        dispose = () => {
                            source.removeEventListener('scroll', schedule);
                            window.removeEventListener('resize', schedule);
                            observer?.disconnect();
                        };

                        read();
                    });
                }
            }}
        >
            <div
                aria-label='${label}'
                aria-valuemax='${steps}'
                aria-valuemin='0'
                aria-valuenow='${() => state.step}'
                aria-valuetext='${() => `${Math.round(progress() * 100)}% read${words > 0 ? `, ${minutes()} min left` : ''}`}'
                class='reading-progress-track'
                role='progressbar'
            >
                <div class='reading-progress-fill' style='${() => `--progress: ${state.step / Math.max(1, steps)}`}'></div>
            </div>

            ${words > 0 && html`
                <div aria-hidden='true' class='reading-progress-readout'>
                    <span class='reading-progress-sizer'>
                        <span class='reading-progress-check'></span>
                        ${doneLabel} · ${total} min
                    </span>
                    <span class='reading-progress-remaining'>
                        ${() => minutes()} min left
                    </span>
                    <span class='reading-progress-done'>
                        <svg class='reading-progress-check' fill='none' viewBox='0 0 256 256'>
                            <polyline pathLength='1' points='216 72 104 184 48 128' />
                        </svg>
                        <span class='reading-progress-label'>
                            ${doneLabel} · ${total} min
                        </span>
                    </span>
                </div>
            `}
        </div>
    `;
};
