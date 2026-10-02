import { component, html, type Attributes } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import { check } from './icons';
import faces from './faces';


type A = Attributes & {
    action: () => unknown;
    disabled?: boolean;
    duration?: number;
    onblur?: never;
    oncontextmenu?: never;
    ondisconnect?: never;
    onkeydown?: never;
    onkeyup?: never;
    onpointercancel?: never;
    onpointerdown?: never;
    onpointermove?: never;
    onpointerup?: never;
    release?: number;
    success?: string;
    timeout?: number;
    tolerance?: number;
};


export default component<A, string>(
    ({ action, disabled = false, duration = 1800, release = 2.5, success = 'Confirmed', timeout = 1600, tolerance = 10, ...attributes }, content) => {
        let animation: Animation | undefined,
            fill: HTMLElement | undefined,
            origin: { x: number, y: number } | undefined,
            state = reactive({ status: 'idle' as 'holding' | 'idle' | 'releasing' | 'success' }),
            timer: ReturnType<typeof setTimeout> | undefined;

        function commit() {
            state.status = 'success';
            navigator.vibrate?.(14);
            action();

            if (timeout > 0) {
                timer = setTimeout(reset, timeout);
            }
        }

        function drain() {
            origin = undefined;

            if (state.status !== 'holding' || !animation) {
                return;
            }

            state.status = 'releasing';
            animation.updatePlaybackRate(-release);
        }

        function press() {
            if (disabled || !fill || state.status === 'holding' || state.status === 'success') {
                return;
            }

            if (!animation) {
                animation = fill.animate(
                    [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }],
                    { duration, easing: 'linear', fill: 'both' }
                );
                animation.onfinish = () => {
                    if (state.status === 'holding') {
                        commit();
                    }
                    else if (state.status === 'releasing') {
                        reset();
                    }
                };
            }
            else {
                animation.updatePlaybackRate(1);
                animation.play();
            }

            state.status = 'holding';
        }

        function reset() {
            animation?.cancel();
            animation = undefined;
            clearTimeout(timer);
            origin = undefined;
            state.status = 'idle';
        }

        return html`
            <button
                aria-description='${`Press and hold for ${duration / 1000} seconds to confirm`}'
                class='button button--feedback button--hold'
                type='button'
                ${attributes}
                ${{
                    'aria-disabled': () => (disabled || state.status === 'success') && 'true',
                    onblur: drain,
                    oncontextmenu: (e) => e.preventDefault(),
                    ondisconnect: reset,
                    onkeydown: (e) => {
                        if (e.key === 'Escape') {
                            drain();
                            return;
                        }

                        if (e.repeat || (e.key !== ' ' && e.key !== 'Enter')) {
                            return;
                        }

                        e.preventDefault();
                        press();
                    },
                    onkeyup: (e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                            drain();
                        }
                    },
                    onpointercancel: drain,
                    onpointerdown: function (e) {
                        if (e.button !== 0) {
                            return;
                        }

                        this.setPointerCapture(e.pointerId);
                        origin = { x: e.clientX, y: e.clientY };
                        press();
                    },
                    onpointermove: (e) => {
                        if (origin && Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > tolerance) {
                            drain();
                        }
                    },
                    onpointerup: drain
                }}
            >
                ${faces(() => state.status === 'success' ? 'success' : 'idle', [
                    { content, key: 'idle' },
                    { content: success, icon: check, key: 'success' }
                ])}
                <span aria-hidden='true' class='button-fill' ${{ onconnect: (element: HTMLElement) => fill = element }}>
                    ${faces(() => state.status === 'success' ? 'success' : 'idle', [
                        { content, key: 'idle' },
                        { content: success, icon: check, key: 'success' }
                    ])}
                </span>
            </button>
            <span class='button-status' role='status' aria-live='polite'>
                ${() => state.status === 'success' ? success : ''}
            </span>
        `;
    }
);
