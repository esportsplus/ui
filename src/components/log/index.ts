import { effect, onCleanup, reactive, untrack } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import './scss/index.scss';


type Progress = { revealed: number };


const STARS = [
    { scale: 1, x: 50, y: 46 },
    { scale: 0.55, x: 18, y: 22 },
    { scale: 0.45, x: 82, y: 26 },
    { scale: 0.55, x: 78, y: 76 },
    { scale: 0.4, x: 22, y: 78 }
];


const bridge = (active: () => boolean, height: number, offset: number) => html`
    <span
        class='log-bridge ${() => active() && '--active'}'
        aria-hidden='true'
        style='--height: ${height}px; --offset: ${offset}px;'
    ></span>
`;

const chevron = () => html`
    <svg class='log-chevron' aria-hidden='true' viewBox='0 0 24 24'>
        <path d='M11.9999 13.1714L16.9497 8.22168L18.3639 9.63589L11.9999 15.9999L5.63599 9.63589L7.0502 8.22168L11.9999 13.1714Z' fill='currentColor' />
    </svg>
`;

const guide = () => html`
    <span class='log-guide' aria-hidden='true'>
        <svg width='12' height='15' viewBox='0 0 12 15' fill='none'>
            <path d='M0.5 0 V8 Q0.5 14 6.5 14 H11.5' pathLength='1' stroke='currentColor' stroke-width='1' />
        </svg>
        <span class='log-guide-line'></span>
    </span>
`;

// Without `state` the log paces itself and holds one extra unit after the last
// step, so the final step shimmers for a beat before the run completes. With
// `state` the caller owns `revealed` and the run completes on the last unit.
const progress = ({ delay, onComplete, state, units }: {
    delay: (index: number) => number;
    onComplete?: VoidFunction;
    state?: Progress;
    units: number;
}) => {
    let completed = false,
        controlled = state !== undefined,
        counter = state ?? reactive({ revealed: 0 }),
        timer: ReturnType<typeof setTimeout> | undefined,
        total = units + (controlled ? 0 : 1);

    let revealed = () => Math.max(0, Math.min(counter.revealed, total)),
        stop = effect(() => {
            if (total === 0 || revealed() < total) {
                completed = false;
                return;
            }

            if (!completed) {
                completed = true;
                untrack(() => onComplete?.());
            }
        });

    function advance() {
        if (counter.revealed >= total) {
            return;
        }

        timer = setTimeout(() => {
            counter.revealed++;
            advance();
        }, delay(counter.revealed));
    }

    onCleanup(() => {
        clearTimeout(timer);
        stop();
    });

    return {
        revealed,
        start: () => {
            if (controlled) {
                return;
            }

            clearTimeout(timer);
            advance();
        },
        total
    };
};

const working = (label: string, active: () => boolean) => {
    let clock = reactive({ elapsed: 0 }),
        interval: ReturnType<typeof setInterval> | undefined;

    let stop = effect(() => {
        if (!active()) {
            clearInterval(interval);
            interval = undefined;
            return;
        }

        if (interval !== undefined) {
            return;
        }

        let start = performance.now();

        clock.elapsed = 0;
        interval = setInterval(() => {
            clock.elapsed = (performance.now() - start) / 1000;
        }, 100);
    });

    onCleanup(() => {
        clearInterval(interval);
        stop();
    });

    return html`
        <div
            class='log-unit log-working ${() => active() && '--active'}'
            role='status'
            ${{ inert: () => !active() }}
        >
            <div class='log-unit-content'>
                <div class='log-working-content'>
                    <span class='log-working-stars' aria-hidden='true'>
                        ${STARS.map(({ scale, x, y }, i) => html`
                            <svg
                                class='log-working-star'
                                viewBox='0 0 24 24'
                                style='--delay: ${(1.4 * i * 0.7) / 5}s; --size: ${14 * scale}px; left: ${x}%; top: ${y}%;'
                            >
                                <path d='M12 0C13 7 17 11 24 12C17 13 13 17 12 24C11 17 7 13 0 12C7 11 11 7 12 0Z' fill='currentColor' />
                            </svg>
                        `)}
                    </span>
                    <span class='log-working-label'>${label}</span>
                    <span class='log-working-timer'>${() => clock.elapsed.toFixed(1)}s</span>
                </div>
            </div>
        </div>
    `;
};


export { bridge, chevron, guide, progress, working };
export type { Progress };
