import { html } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import clipboard from '~/components/clipboard';
import icon from '~/components/icon';
import { buildVisibleToastLayout, remove, state, toast } from './manager';
import { toasts } from './manager';
import type { Toast } from './manager';
import check from './svg/check.svg';
import close from './svg/close.svg';
import copy from './svg/copy.svg';
import error from './svg/error.svg';
import info from './svg/info.svg';
import loading from './svg/loading.svg';
import success from './svg/success.svg';
import warning from './svg/warning.svg';
import './scss/index.scss';


type Position = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';


type ToastElement = HTMLElement & { __toastObserver?: ResizeObserver };


const ICONS = { error, info, loading, success, warning };

const dismiss = toast.dismiss;


function row(toast: Toast, position: Position) {
    let swipe = reactive({ direction: '', x: 0, y: 0 }),
        horizontal = position.endsWith('left') || position.endsWith('right'),
        pointerId = -1,
        pressed = false,
        startX = 0,
        startY = 0,
        swiping = false,
        top = position.startsWith('top');

    const finish = () => {
        pressed = false;

        if (!swiping) {
            return;
        }

        swiping = false;

        if (Math.hypot(swipe.x, swipe.y) > 80) {
            swipe.direction = Math.abs(swipe.x) > Math.abs(swipe.y)
                ? (swipe.x < 0 ? 'left' : 'right')
                : (swipe.y < 0 ? 'up' : 'down');

            dismiss(toast.id);
        }
        else {
            swipe.direction = '';
            swipe.x = 0;
            swipe.y = 0;
        }
    };

    return html`
        <div
            class='${() => `toast toast--${toast.type}${toast.status === 'starting' ? ' toast--starting' : toast.status === 'ending' ? ' toast--ending' : ''}${swipe.x !== 0 || swipe.y !== 0 ? ' toast--swiping' : ''}`}'
            ${{
                style: () => {
                    let item = buildVisibleToastLayout([...toasts]).items.find((i) => i.toast === toast),
                        visibleIndex = item?.visibleIndex ?? 0, offsetY = item?.offsetY ?? 0;

                    return `
                        --toast-index:${visibleIndex};
                        --toast-offset-y:${offsetY}px;
                        --toast-height:${toast.height}px;
                        --toast-swipe-x:${swipe.x}px;
                        --toast-swipe-y:${swipe.y}px;`;
                },
                'data-swipe-direction': () => swipe.direction,
                onconnect: (el: HTMLElement) => {
                    // offsetHeight is the untransformed layout height; getBoundingClientRect
                    // would include the collapsed scale() transform and report shrunken
                    // heights, giving uneven offsets/spacing when the stack expands.
                    let observer = new ResizeObserver(() => { toast.height = el.offsetHeight; });

                    (el as ToastElement).__toastObserver = observer;
                    observer.observe(el);
                },
                ondisconnect: (el: HTMLElement) => {
                    (el as ToastElement).__toastObserver?.disconnect();
                },
                onpointerdown: (e: PointerEvent) => {
                    pointerId = e.pointerId;
                    pressed = true;
                    startX = e.clientX;
                    startY = e.clientY;
                },
                onpointermove: (e: PointerEvent) => {
                    if (!pressed) {
                        return;
                    }

                    let x = horizontal ? e.clientX - startX : 0,
                        y = top ? Math.min(0, e.clientY - startY) : Math.max(0, e.clientY - startY);

                    // Defer swipe + pointer capture until real movement, otherwise a
                    // plain click's captured pointer redirects the click off the
                    // close/action buttons and they never fire.
                    if (!swiping) {
                        if (Math.hypot(x, y) < 6) {
                            return;
                        }

                        swiping = true;
                        (e.currentTarget as HTMLElement).setPointerCapture(pointerId);
                    }

                    swipe.x = x;
                    swipe.y = y;
                },
                onpointerup: finish,
                onpointercancel: finish
            }}
        >
            <div class='toast-content'>
                ${toast.type !== 'message' ? icon({ class: 'toast-icon' }, ICONS[toast.type]) : ''}

                <div class='--flex-column --flex-fill'>
                    <div class='toast-title'>${toast.title}</div>
                    ${toast.description && html`
                        <div class='toast-description ${toast.type === 'error' && typeof toast.description === 'string' && toast.description.length > 180 && 'toast-description--clamp'}'>
                            ${toast.description}
                        </div>
                    `}
                </div>

                ${toast.type === 'error' && typeof toast.description === 'string' && clipboard.copy(
                    {
                        class: 'toast-copy button',
                        value: String(toast.description)
                    },
                    (state) => icon(state.copied ? check : copy)
                )}

                ${toast.action && html`
                    <div
                        class='toast-action button button--primary'
                        onclick=${() => {
                            toast.action?.onclick();
                            dismiss(toast.id);
                        }}
                    >
                        ${toast.action?.label}
                    </div>
                `}
            </div>

            ${() => toast.dismissible && html`
                <button class='toast-close' aria-label='Dismiss' onclick=${() => dismiss(toast.id)}>
                    ${icon(close)}
                </button>
            `}
        </div>
    `;
}


const toaster = (options?: { position?: Position }) => {
    let position = options?.position ?? 'top-right';

    return html`
        <div
            class='toaster ${() => state.active ? '--active' : ''}'
            data-position='${position}'
            ${{
                style: () => `--toast-frontmost-height:${buildVisibleToastLayout([...toasts]).frontmostHeight}px;`,
                onmouseenter: () => { state.active = true; },
                onmouseleave: () => { state.active = false; }
            }}
        >
            ${html.reactive(toasts, (value: Toast) => row(value, position))}
        </div>
    `;
};


export default toaster;
export { remove, toast };
export type { Position };
