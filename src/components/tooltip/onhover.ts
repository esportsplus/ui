import { component, html, Attributes } from '@esportsplus/template';
import { onCleanup, reactive } from '@esportsplus/reactivity';
import { content, cool, morph, morphing, wait, warm, type Delay } from './utilities';


type A = Attributes & Options & {
    onanimationcancel?: never,
    onanimationend?: never,
    onanimationstart?: never,
    ondocumentkeydown?: never,
    onfocusin?: never,
    onfocusout?: never,
    onmouseover?: never,
    onmouseout?: never,
    onpointermove?: never,
    ontransitioncancel?: never,
    ontransitionend?: never,
    ontransitionrun?: never
};

type Options = {
    // Keyboard focus never waits for the open delay.
    delay?: Delay,
    state?: { active: boolean }
};

type Point = [number, number];


function cross(o: Point, a: Point, b: Point) {
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

// Andrew's monotone chain: convex hull of the pointer and the tooltip corners.
function hull(points: Point[]) {
    let lower: Point[] = [],
        upper: Point[] = [];

    points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

    for (let i = 0, n = points.length; i < n; i++) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], points[i]) <= 0) {
            lower.pop();
        }

        lower.push(points[i]);
    }

    for (let i = points.length - 1; i >= 0; i--) {
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], points[i]) <= 0) {
            upper.pop();
        }

        upper.push(points[i]);
    }

    lower.pop();
    upper.pop();

    return lower.concat(upper);
}

function safe(element: HTMLElement, x: number, y: number) {
    let rect = element.getBoundingClientRect();

    // Only follow the pointer while it is over the trigger; once it enters the
    // cone the apex stays put, so drifting sideways leaves the shape and closes.
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
        return;
    }

    let tooltip = content(element);

    if (!tooltip) {
        return;
    }

    let box = tooltip.getBoundingClientRect(),
        left = Math.min(x, box.left),
        points = hull([[x, y], [box.left, box.top], [box.right, box.top], [box.right, box.bottom], [box.left, box.bottom]]),
        polygon = '',
        top = Math.min(y, box.top);

    for (let i = 0, n = points.length; i < n; i++) {
        polygon += `${i ? ', ' : ''}${points[i][0] - left}px ${points[i][1] - top}px`;
    }

    return `
        --safe-area: polygon(${polygon});
        --safe-height: ${Math.max(y, box.bottom) - top}px;
        --safe-left: ${left - rect.left - element.clientLeft}px;
        --safe-top: ${top - rect.top - element.clientTop}px;
        --safe-width: ${Math.max(x, box.right) - left}px;
    `;
}


// The hover behaviour without an element of its own: spread it on any '.tooltip' element that holds a
// '.tooltip-content' or '.tooltip-message'.
function trigger({ delay: { close: closing = 0, open: opening = 0 } = {}, state = reactive({ active: false }) }: Options = {}) {
    let leaving: ReturnType<typeof setTimeout> | undefined,
        local = reactive({ instant: false, morphing: false, safe: '' }),
        morphed: VoidFunction | undefined,
        pending: VoidFunction | undefined,
        settled = morphing(local, false),
        x = 0,
        y = 0;

    function close() {
        clearTimeout(leaving);
        leaving = undefined;
        morphed?.();
        morphed = undefined;
        pending?.();
        pending = undefined;

        if (opening && state.active) {
            cool();
        }

        state.active = false;
    }

    function open(element: HTMLElement) {
        pending = undefined;
        morphed = morph(element, () => {
            morphed = undefined;
            state.active = true;
        });
    }

    // A wait that hasn't opened yet is dropped at once; only a showing tooltip waits out the close delay.
    function release() {
        pending?.();
        pending = undefined;

        if (!closing || !(state.active || morphed)) {
            close();
            return;
        }

        leaving ??= setTimeout(close, closing);
    }

    function stay() {
        clearTimeout(leaving);
        leaving = undefined;
    }

    onCleanup(() => {
        clearTimeout(leaving);
        pending?.();
    });

    return {
        class: [
            () => state.active && (local.instant ? '--active --instant' : '--active'),
            () => local.morphing && '--morphing'
        ],
        onanimationcancel: settled,
        onanimationend: settled,
        onanimationstart: morphing(local, true),
        // On the document, so Escape dismisses a hovered tooltip wherever focus is.
        ondocumentkeydown: (e: KeyboardEvent) => {
            if (e.key === 'Escape' && (state.active || pending)) {
                close();
            }
        },
        onfocusin: (e: FocusEvent) => {
            stay();

            if (state.active || morphed || !(e.target as Element).matches(':focus-visible')) {
                return;
            }

            pending?.();
            local.instant = false;
            open(e.currentTarget as HTMLElement);
        },
        onfocusout: (e: FocusEvent) => {
            if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) {
                release();
            }
        },
        onmouseover: (e: MouseEvent) => {
            let element = e.currentTarget as HTMLElement;

            // Moving between the trigger and its own children isn't entering it.
            if (element.contains(e.relatedTarget as Node | null)) {
                return;
            }

            stay();

            if (state.active || morphed || pending) {
                return;
            }

            local.instant = opening > 0 && warm();
            pending = wait(opening, () => open(element));
        },
        onmouseout: (e: MouseEvent) => {
            if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) {
                release();
            }
        },
        onpointermove: (e: PointerEvent) => {
            let element = e.currentTarget as HTMLElement;

            x = e.clientX;
            y = e.clientY;

            if (state.active) {
                local.safe = safe(element, x, y) ?? local.safe;
            }
        },
        ontransitioncancel: settled,
        // Content animates in; re-measure once it settles so the cone targets its final position.
        ontransitionend: (e: TransitionEvent) => {
            settled(e);

            if (state.active) {
                local.safe = safe(e.currentTarget as HTMLElement, x, y) ?? local.safe;
            }
        },
        ontransitionrun: morphing(local, true),
        style: () => local.safe
    };
}


export default component(
    ({ delay, state, ...attributes }: A, content) => html`
        <div class='tooltip' ${attributes} ${trigger({ delay, state })}>
            ${content}
        </div>
    `,
    { trigger }
);
