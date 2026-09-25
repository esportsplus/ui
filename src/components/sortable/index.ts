import type { Attributes } from '@esportsplus/template';
import './scss/index.scss';


type Options = {
    // Selector for the part of an item that starts a drag; the whole item when omitted.
    handle?: string;
    onsort?: (item: HTMLElement, from: number, to: number) => void;
};

type Rect = {
    bottom: number;
    left: number;
    right: number;
    top: number;
};


// Touch has to hold still briefly before a drag starts, otherwise swiping across the items could never scroll.
const DELAY = 180;

const DROP: KeyframeAnimationOptions = { duration: 260, easing: 'cubic-bezier(0.34, 1.3, 0.64, 1)', fill: 'forwards' };

const ENTER = 0.15;

// Treats the item as hanging below the grab point, so a centered grab still swings.
const HANG = 0.5;

const SHIFT: KeyframeAnimationOptions = { composite: 'add', duration: 220, easing: 'cubic-bezier(0.2, 0, 0, 1)' };

// Seconds; low-pass on pointer velocity so uneven pointer/frame timing doesn't jolt the swing.
const SMOOTHING = 0.04;

const THRESHOLD = 4;


function child(container: HTMLElement, node: Node | null) {
    while (node && node.parentNode !== container) {
        node = node.parentNode;
    }

    return node instanceof HTMLElement ? node : null;
}

function drag(container: HTMLElement, item: HTMLElement, e: PointerEvent, onsort: Options['onsort']) {
    let animations = new Map<HTMLElement, Animation>(),
        baseLeft = 0,
        baseTop = 0,
        cssText = '',
        frame = 0,
        from = index(item),
        layout = new Map<HTMLElement, Rect>(),
        originX = e.clientX,
        originY = e.clientY,
        placeholder: HTMLElement | null = null,
        pointer = e.pointerId,
        previousX = e.clientX,
        previousY = e.clientY,
        reduced = matchMedia('(prefers-reduced-motion: reduce)').matches,
        swing: ReturnType<typeof inertia> | null = null,
        time = 0,
        touch = e.pointerType === 'touch',
        timer = touch ? setTimeout(activate, DELAY) : undefined,
        x = e.clientX,
        y = e.clientY;

    function activate() {
        clearTimeout(timer);

        let rect = item.getBoundingClientRect(),
            computed = getComputedStyle(item),
            style = item.style;

        placeholder = document.createElement('div');
        placeholder.className = 'sortable-placeholder';
        placeholder.style.cssText = `
            --radius: ${computed.borderRadius};
            grid-column: ${computed.gridColumn};
            grid-row: ${computed.gridRow};
            height: ${rect.height}px;
            margin: ${computed.margin};
            width: ${rect.width}px;
        `;

        baseLeft = rect.left;
        baseTop = rect.top;
        cssText = style.cssText;
        swing = reduced ? null : inertia(computed, rect, originX - rect.left, originY - rect.top);

        reflow(() => {
            item.before(placeholder!);

            style.boxSizing = 'border-box';
            style.height = `${rect.height}px`;
            style.left = `${rect.left}px`;
            style.margin = '0';
            style.position = 'fixed';
            style.top = `${rect.top}px`;
            style.transformOrigin = `${originX - rect.left}px ${originY - rect.top}px`;
            style.width = `${rect.width}px`;

            // A transformed or filtered ancestor becomes the containing block for 'position: fixed'; correct
            // by the offset it introduced, measured before the lift/swing transforms apply.
            let moved = item.getBoundingClientRect();

            style.left = `${rect.left * 2 - moved.left}px`;
            style.top = `${rect.top * 2 - moved.top}px`;

            container.classList.add('--active');
            item.classList.add('--dragging');
        });

        getSelection()?.removeAllRanges();
        frame = requestAnimationFrame(tick);
    }

    function cleanup() {
        cancelAnimationFrame(frame);
        clearTimeout(timer);

        document.removeEventListener('contextmenu', prevent);
        document.removeEventListener('dragstart', prevent);
        document.removeEventListener('pointercancel', release);
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', release);
        document.removeEventListener('selectstart', prevent);
        document.removeEventListener('touchmove', scroll);
    }

    function drop() {
        let slot = placeholder!,
            style = item.style;

        cleanup();
        animations.get(slot)?.finish();

        let { rotate, scale, translate } = getComputedStyle(item),
            target = slot.getBoundingClientRect();

        item.classList.add('--dropping');

        let animation = item.animate([
            { rotate, scale, transform: style.transform, translate },
            { rotate: '0deg', scale: '1', transform: `translate3d(${target.left - baseLeft}px, ${target.top - baseTop}px, 0)`, translate: '0px 0px' }
        ], DROP);

        animation.onfinish = () => {
            // Reinserting the item gives it a fresh style, so restoring its inline styles and dropping the
            // drag classes can't trigger its own transitions (e.g. on 'transform').
            style.cssText = cssText;
            slot.replaceWith(item);
            item.classList.remove('--dragging', '--dropping');
            animation.cancel();
            container.classList.remove('--active');

            let to = index(item);

            if (onsort && to !== from) {
                onsort(item, from, to);
            }
        };

        // The pointerup that ended the drag is followed by a click on whatever sits under the pointer.
        addEventListener('click', swallow, true);
        setTimeout(() => removeEventListener('click', swallow, true));
    }

    function move(e: PointerEvent) {
        if (e.pointerId !== pointer) {
            return;
        }

        x = e.clientX;
        y = e.clientY;

        if (placeholder || Math.hypot(x - originX, y - originY) < THRESHOLD) {
            return;
        }

        if (touch) {
            cleanup();
        }
        else {
            activate();
        }
    }

    function reflow(mutate: VoidFunction) {
        let first = new Map<Element, DOMRect>();

        for (let element of container.children) {
            if (element !== item) {
                first.set(element, element.getBoundingClientRect());
            }
        }

        mutate();

        for (let animation of animations.values()) {
            animation.cancel();
        }

        animations.clear();
        layout.clear();

        let bounds = container.getBoundingClientRect(),
            left = bounds.left - container.scrollLeft,
            top = bounds.top - container.scrollTop;

        for (let element of container.children) {
            if (element === item || !(element instanceof HTMLElement)) {
                continue;
            }

            let rect = element.getBoundingClientRect(),
                start = first.get(element);

            layout.set(element, {
                bottom: rect.bottom - top,
                left: rect.left - left,
                right: rect.right - left,
                top: rect.top - top
            });

            if (!start || reduced || (start.left === rect.left && start.top === rect.top)) {
                continue;
            }

            animations.set(element, element.animate([
                { translate: `${start.left - rect.left}px ${start.top - rect.top}px` },
                { translate: '0px 0px' }
            ], SHIFT));
        }
    }

    function release(e: PointerEvent) {
        if (e.pointerId !== pointer) {
            return;
        }

        if (placeholder) {
            drop();
        }
        else {
            cleanup();
        }
    }

    function scroll(e: TouchEvent) {
        if (placeholder) {
            e.preventDefault();
        }
    }

    function sort() {
        let bounds = container.getBoundingClientRect(),
            left = x - bounds.left + container.scrollLeft,
            slot = layout.get(placeholder!),
            top = y - bounds.top + container.scrollTop;

        if (!slot) {
            return;
        }

        for (let [element, rect] of layout) {
            if (element === placeholder || left < rect.left || left > rect.right || top < rect.top || top > rect.bottom) {
                continue;
            }

            let row = rect.top < slot.bottom && rect.bottom > slot.top,
                depth = row
                    ? (rect.left > slot.left ? left - rect.left : rect.right - left)
                    : (rect.top > slot.top ? top - rect.top : rect.bottom - top),
                size = row ? rect.right - rect.left : rect.bottom - rect.top;

            // How far the pointer must travel into the hovered item (from the edge facing the placeholder)
            // before they swap. Same-size items swap almost on entry; a larger item needs half its surplus
            // over the placeholder, which leaves the pointer short of the swap-back point afterwards.
            if (depth > Math.max(0, (size - (row ? slot.right - slot.left : slot.bottom - slot.top)) / 2) + size * ENTER) {
                reflow(() => {
                    if (placeholder!.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING) {
                        element.after(placeholder!);
                    }
                    else {
                        element.before(placeholder!);
                    }
                });
            }

            return;
        }
    }

    function tick(now: number) {
        frame = requestAnimationFrame(tick);

        // Capped so a stalled tab resumes without the spring integrating one huge, unstable step.
        let dt = time ? Math.min((now - time) / 1000, 1 / 30) : 0,
            angle = swing ? swing(x - previousX, y - previousY, dt) : 0;

        previousX = x;
        previousY = y;
        time = now;
        item.style.transform = `translate3d(${x - originX}px, ${y - originY}px, 0) rotate(${angle}deg)`;

        sort();
    }

    document.addEventListener('contextmenu', prevent);
    document.addEventListener('dragstart', prevent);
    document.addEventListener('pointercancel', release);
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', release);
    document.addEventListener('selectstart', prevent);
    document.addEventListener('touchmove', scroll, { passive: false });
}

function index(element: Element) {
    return Array.prototype.indexOf.call(element.parentElement!.children, element);
}

// Under-damped spring pulling the item's angle toward a lean set by pointer velocity: it swings while
// dragged, overshoots and wobbles when the pointer stops or turns, then comes to rest. The lean is the
// inertial torque of the item's center about the grab point, so vertical motion swings off-center grabs too.
function inertia(computed: CSSStyleDeclaration, rect: DOMRect, grabX: number, grabY: number) {
    let angle = 0,
        damping = parseFloat(computed.getPropertyValue('--swing-damping')),
        max = parseFloat(computed.getPropertyValue('--swing-angle')),
        size = Math.max(rect.width, rect.height),
        leverX = (rect.width / 2 - grabX) / size,
        leverY = (rect.height / 2 - grabY) / size + HANG,
        spin = 0,
        stiffness = parseFloat(computed.getPropertyValue('--swing-stiffness')),
        strength = parseFloat(computed.getPropertyValue('--swing-strength')),
        vx = 0,
        vy = 0;

    return (dx: number, dy: number, dt: number) => {
        if (dt <= 0) {
            return angle;
        }

        let smoothing = 1 - Math.exp(-dt / SMOOTHING);

        vx += (dx / dt - vx) * smoothing;
        vy += (dy / dt - vy) * smoothing;

        let lean = Math.max(-max, Math.min(max, (leverY * vx - leverX * vy) * strength));

        spin += (stiffness * (lean - angle) - damping * spin) * dt;
        angle += spin * dt;

        return angle;
    };
}

function prevent(e: Event) {
    e.preventDefault();
}

function swallow(e: Event) {
    e.preventDefault();
    e.stopPropagation();
}


export default ({ handle, onsort }: Options = {}): Attributes => ({
    class: 'sortable',
    onpointerdown: (e: PointerEvent) => {
        let container = e.currentTarget as HTMLElement;

        if (e.button !== 0 || !e.isPrimary || container.classList.contains('--active')) {
            return;
        }

        let item = child(container, e.target as Node);

        if (!item || (handle && !item.contains((e.target as Element).closest(handle)))) {
            return;
        }

        drag(container, item, e, onsort);
    }
});
