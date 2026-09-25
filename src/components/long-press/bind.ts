import { reactive } from '@esportsplus/reactivity';
import type { Attributes } from '@esportsplus/template';


type LongPress = {
    attributes: Attributes<HTMLElement>;
    state: { fired: boolean; holding: boolean; step: number };
    steps: number;
};

type Options = {
    disabled?: boolean;
    duration?: number;
    haptic?: boolean;
    moveTolerance?: number;
    onlongpress: VoidFunction;
    onlongpresscancel?: VoidFunction;
    steps?: number;
};


// Hold on the filled state briefly so the confirmation registers before resetting.
const SETTLE = 260;


export default ({ disabled = false, duration = 550, haptic = true, moveTolerance = 8, onlongpress, onlongpresscancel, steps = 12 }: Options): LongPress => {
    let cells = Math.max(1, Math.round(steps)),
        frame = 0,
        origin: { x: number; y: number } | null = null,
        phase: 'fired' | 'holding' | 'idle' = 'idle',
        settle: ReturnType<typeof setTimeout> | undefined,
        startedAt = 0,
        state = reactive({ fired: false, holding: false, step: 0 });

    function begin(point?: { x: number; y: number }) {
        if (disabled || phase !== 'idle') {
            return;
        }

        phase = 'holding';
        origin = point ?? null;
        startedAt = performance.now();
        state.holding = true;
        state.step = 0;

        frame = requestAnimationFrame(tick);
    }

    function end() {
        if (phase !== 'holding') {
            return;
        }

        reset();
        onlongpresscancel?.();
    }

    function reset() {
        cancelAnimationFrame(frame);
        clearTimeout(settle);

        frame = 0;
        origin = null;
        phase = 'idle';
        state.fired = false;
        state.holding = false;
        state.step = 0;
    }

    function tick(now: number) {
        let progress = Math.min(1, (now - startedAt) / duration),
            step = Math.floor(progress * cells);

        if (state.step !== step) {
            state.step = step;
        }

        if (progress < 1) {
            frame = requestAnimationFrame(tick);
            return;
        }

        frame = 0;
        phase = 'fired';
        state.fired = true;
        state.holding = false;
        state.step = cells;

        if (haptic) {
            navigator.vibrate?.(12);
        }

        onlongpress();

        settle = setTimeout(() => {
            if (phase === 'fired') {
                reset();
            }
        }, SETTLE);
    }

    return {
        attributes: {
            onblur: end,
            // Swallow the click that trails a completed hold so it can't double-fire a parent handler.
            onclick: (e: MouseEvent) => {
                if (phase === 'fired') {
                    e.preventDefault();
                    e.stopPropagation();
                }
            },
            oncontextmenu: (e: MouseEvent) => e.preventDefault(),
            ondisconnect: reset,
            ondocumentvisibilitychange: () => {
                if (document.hidden) {
                    end();
                }
            },
            onkeydown: (e: KeyboardEvent) => {
                if (e.repeat) {
                    return;
                }

                if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    begin();
                }
            },
            onkeyup: (e: KeyboardEvent) => {
                if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
                    end();
                }
            },
            onpointercancel: end,
            onpointerdown: (e: PointerEvent) => {
                if (e.button !== 0 && e.pointerType === 'mouse') {
                    return;
                }

                (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                begin({ x: e.clientX, y: e.clientY });
            },
            onpointerleave: end,
            onpointermove: (e: PointerEvent) => {
                if (phase !== 'holding' || !origin) {
                    return;
                }

                if (Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > moveTolerance) {
                    end();
                }
            },
            onpointerup: end,
            onwindowblur: end
        },
        state,
        steps: cells
    };
};
