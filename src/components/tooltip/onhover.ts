import { component, html, Attributes } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import { content, morph, morphing } from './utilities';


type A = Attributes & {
    onanimationcancel?: never,
    onanimationend?: never,
    onanimationstart?: never,
    onmouseover?: never,
    onmouseout?: never,
    onpointermove?: never,
    ontransitioncancel?: never,
    ontransitionend?: never,
    ontransitionrun?: never,
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
        style = element.style,
        top = Math.min(y, box.top);

    for (let i = 0, n = points.length; i < n; i++) {
        polygon += `${i ? ', ' : ''}${points[i][0] - left}px ${points[i][1] - top}px`;
    }

    style.setProperty('--safe-area', `polygon(${polygon})`);
    style.setProperty('--safe-height', `${Math.max(y, box.bottom) - top}px`);
    style.setProperty('--safe-left', `${left - rect.left - element.clientLeft}px`);
    style.setProperty('--safe-top', `${top - rect.top - element.clientTop}px`);
    style.setProperty('--safe-width', `${Math.max(x, box.right) - left}px`);
}


export default component<A>(
    ({ state = reactive({ active: false }), ...attributes }, content) => {
        let cancel: VoidFunction | undefined,
            settled = morphing(false),
            x = 0,
            y = 0;

        return html`
            <div
                class='tooltip'
                ${attributes}
                ${{
                    class: () => state.active && '--active',
                    onanimationcancel: settled,
                    onanimationend: settled,
                    onanimationstart: morphing(true),
                    onmouseover: (e: MouseEvent) => {
                        let element = e.currentTarget as HTMLElement;

                        // Moving between the trigger and its own children isn't entering it.
                        if (state.active || cancel || element.contains(e.relatedTarget as Node | null)) {
                            return;
                        }

                        cancel = morph(element, () => {
                            cancel = undefined;
                            state.active = true;
                        });
                    },
                    onmouseout: (e: MouseEvent) => {
                        if ((e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) {
                            return;
                        }

                        cancel?.();
                        cancel = undefined;
                        state.active = false;
                    },
                    onpointermove: (e: PointerEvent) => {
                        let element = e.currentTarget as HTMLElement;

                        x = e.clientX;
                        y = e.clientY;

                        if (state.active) {
                            safe(element, x, y);
                        }
                    },
                    ontransitioncancel: settled,
                    // Content animates in; re-measure once it settles so the cone targets its final position.
                    ontransitionend: (e: TransitionEvent) => {
                        settled(e);

                        if (state.active) {
                            safe(e.currentTarget as HTMLElement, x, y);
                        }
                    },
                    ontransitionrun: morphing(true)
                }}
            >
                ${content}
            </div>
        `;
    }
);
