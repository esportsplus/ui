import { flush, reactive, read, signal, write, type ReactiveArray, type Signal } from '@esportsplus/reactivity';
import { html, type Attributes, type Renderable } from '@esportsplus/template';
import { finished, measure, slide, timing } from '~/shared/animation';
import press from '~/shared/press';
import './scss/index.scss';


// One container's list. A dragged item moves through the lists live, standing in its own place; the copy that
// follows the pointer belongs to the list it was picked up from.
type List<T> = {
    container?: HTMLElement;
    // The item dragged out of this list, shown by its copy until it has landed.
    dragging: Signal<T | null>;
    // The copy, in the top layer.
    ghost?: HTMLElement;
    // The dragged item while it sits in this list.
    held: Signal<T | null>;
    items: ReactiveArray<T>;
    motion: Motion;
    press: ReturnType<typeof press>;
    // Shows the dropped item again, once its copy starts to fade.
    reveal?: VoidFunction;
    // The dropped item while it shows again with every transition off.
    revealing: Signal<T | null>;
    slot?: { flush(): void };
};

// Where the copy is drawn: the box it was picked up from, then the pointer's offset from there and the swing.
type Motion = {
    angle: number;
    dropping: boolean;
    height: number;
    left: number;
    origin: string;
    radius: string;
    top: number;
    width: number;
    x: number;
    y: number;
};

type Options<T> = {
    // Renders the copy that follows the pointer; the item's own template when omitted.
    drag?: (item: T) => Renderable<unknown>;
    // Containers sharing a group name trade items; the list the drag started in receives 'onsort'.
    group?: string;
    // Selector for the part of an item that starts a drag; the whole item when omitted.
    handle?: string;
    onsort?: (item: T, from: number, to: number, source: ReactiveArray<T>, target: ReactiveArray<T>) => void;
};

// 'index' is the item's place in its list.
type Rect = {
    bottom: number;
    element: HTMLElement;
    index: number;
    left: number;
    list: List<unknown>;
    right: number;
    top: number;
};


// Touch has to hold still briefly before a drag starts, otherwise swiping across the items could never scroll.
const DELAY = 180;

const ENTER = 0.15;

// Treats the item as hanging below the grab point, so a centered grab still swings.
const HANG = 0.5;

// Seconds; low-pass on pointer velocity so uneven pointer/frame timing doesn't jolt the swing.
const SMOOTHING = 0.04;


// Connected lists per group name, so a drag reaches every list it can drop into.
let groups = new Map<string, Set<List<unknown>>>();


function drag(source: List<unknown>, item: HTMLElement, value: unknown, e: PointerEvent, { group, onsort }: Options<unknown>) {
    // 'current' is the list the item sits in now.
    let current = source,
        frame = 0,
        from = source.items.indexOf(value),
        hole: Rect | null = null,
        // The pointer in the hovered list's own coordinates when it was last hit-tested.
        lastLeft = NaN,
        lastTop = NaN,
        layout: Rect[] = [],
        lists = group ? [...(groups.get(group) ?? [source])] : [source],
        motion = source.motion,
        originX = e.clientX,
        originY = e.clientY,
        previousX = e.clientX,
        previousY = e.clientY,
        // From the container's CSS, read on lift; no duration is no slide.
        shift: KeyframeAnimationOptions | null = null,
        swing: ReturnType<typeof inertia> | null = null,
        time = 0,
        x = e.clientX,
        y = e.clientY;

    function activate() {
        let rect = item.getBoundingClientRect(),
            computed = getComputedStyle(item);

        shift = timing(computed, 'shift');
        swing = inertia(computed, rect, originX - rect.left, originY - rect.top);

        reflow(() => {
            motion.angle = 0;
            motion.dropping = false;
            motion.height = rect.height;
            motion.left = rect.left;
            motion.origin = `${originX - rect.left}px ${originY - rect.top}px`;
            motion.radius = computed.borderRadius;
            motion.top = rect.top;
            motion.width = rect.width;
            motion.x = 0;
            motion.y = 0;
            write(source.dragging, value);
            write(source.held, value);
        });

        frame = requestAnimationFrame(tick);
    }

    function drop() {
        let ghost = source.ghost,
            slot = hole?.element;

        if (ghost && slot) {
            // Its box where the copy lands, not partway through a shift.
            for (let animation of slot.getAnimations()) {
                animation.finish();
            }

            let box = slot.getBoundingClientRect();

            // CSS shrinks the copy onto it and fades it out, taking its size too, since another list can lay it out
            // differently.
            motion.angle = 0;
            motion.dropping = true;
            motion.height = box.height;
            motion.width = box.width;
            motion.x = box.left - motion.left;
            motion.y = box.top - motion.top;
            flush();
        }

        // The item shows again under the copy as the copy starts to fade, three quarters through landing, so the two
        // cross; at the latest when the copy goes.
        let reveal = source.reveal = () => {
            if (read(current.held) === null) {
                return;
            }

            write(current.held, null);
            write(current.revealing, value);
            flush();

            // Restyled with its transitions off, it shows at once; they come back with nothing left to animate.
            slot?.getBoundingClientRect();
            write(current.revealing, null);
            flush();
        };

        // Its dropping style turns its animation off, so only the landing's transitions are left to wait for.
        void (ghost ? finished(ghost) : Promise.resolve()).then(() => {
            let to = current.items.indexOf(value);

            reveal();
            source.reveal = undefined;
            write(source.dragging, null);
            flush();

            if (onsort && (current !== source || to !== from)) {
                onsort(value, from, to, source.items, current.items);
            }
        });
    }

    // Into the list the pointer has crossed into, after its items that come before the pointer in reading order: the
    // rows above it, then those to its left in its own row.
    function enter(target: List<unknown>) {
        // The layout is still the last reflow's, in the list's own coordinates.
        let bounds = target.container!.getBoundingClientRect(),
            index = 0,
            left = x - bounds.left + target.container!.scrollLeft,
            top = y - bounds.top + target.container!.scrollTop;

        for (let i = 0, n = layout.length; i < n; i++) {
            let rect = layout[i];

            if (rect.list === target && (rect.bottom <= top || (rect.top < top && rect.right <= left))) {
                index++;
            }
        }

        relocate(target, index);
    }

    // A drag lands where it was let go; one whose list went with it just stops.
    function end(e: PointerEvent | null, started: boolean) {
        cancelAnimationFrame(frame);

        if (!started) {
            return;
        }

        if (e) {
            drop();
            return;
        }

        write(current.held, null);
        write(source.dragging, null);
    }

    function over() {
        if (lists.length === 1) {
            return source;
        }

        for (let i = 0, n = lists.length; i < n; i++) {
            let rect = lists[i].container?.getBoundingClientRect();

            if (rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                return lists[i];
            }
        }

        return null;
    }

    function reflow(mutate: VoidFunction) {
        for (let i = 0, n = lists.length; i < n; i++) {
            measure(lists[i].container?.children ?? []);
        }

        mutate();

        for (let i = 0, n = lists.length; i < n; i++) {
            lists[i].slot?.flush();
        }

        flush();

        // The held item by its place, since a move between lists renders it afresh.
        let at = current.items.indexOf(value);

        hole = null;
        lastLeft = NaN;
        layout.length = 0;

        for (let i = 0, n = lists.length; i < n; i++) {
            let list = lists[i],
                parent = list.container;

            if (!parent) {
                continue;
            }

            let bounds = parent.getBoundingClientRect(),
                index = 0,
                left = bounds.left - parent.scrollLeft,
                top = bounds.top - parent.scrollTop;

            for (let element of parent.children as HTMLCollectionOf<HTMLElement>) {
                // Only the items: the copy is a child too, out in the top layer.
                if (element.classList.contains('sortable-drag')) {
                    continue;
                }

                // Slid from where it was drawn, and laid out where it slides to; one new to the list just is.
                let rect = slide(element, shift) ?? element.getBoundingClientRect(),
                    entry = {
                        bottom: rect.bottom - top,
                        element,
                        index: index++,
                        left: rect.left - left,
                        list,
                        right: rect.right - left,
                        top: rect.top - top
                    };

                if (list === current && entry.index === at) {
                    hole = entry;
                }

                layout.push(entry);
            }
        }
    }

    // Within its list the item is sorted into place, keeping its node and the touch dragging it; into another it is
    // spliced, rendering afresh there.
    function relocate(target: List<unknown>, to: number) {
        if (target === current) {
            let rest = target.items.filter((v) => v !== value);

            rest.splice(to, 0, value);

            let rank = new Map(rest.map((v, i) => [v, i]));

            target.items.sort((a, b) => rank.get(a)! - rank.get(b)!);
            return;
        }

        current.items.splice(current.items.indexOf(value), 1);
        write(current.held, null);
        write(target.held, value);
        target.items.splice(to, 0, value);
        current = target;
    }

    function sort() {
        let slot = hole,
            target = over();

        if (!slot || !target) {
            return;
        }

        if (target !== current) {
            reflow(() => enter(target));
            return;
        }

        let bounds = target.container!.getBoundingClientRect(),
            left = x - bounds.left + target.container!.scrollLeft,
            top = y - bounds.top + target.container!.scrollTop;

        // Nothing moved under the pointer: not the pointer, the page or the list's own scroll.
        if (left === lastLeft && top === lastTop) {
            return;
        }

        lastLeft = left;
        lastTop = top;

        for (let i = 0, n = layout.length; i < n; i++) {
            let rect = layout[i];

            if (
                rect === slot ||
                rect.list !== target ||
                left < rect.left ||
                left > rect.right ||
                top < rect.top ||
                top > rect.bottom
            ) {
                continue;
            }

            let row = rect.top < slot.bottom && rect.bottom > slot.top,
                depth = row
                    ? (rect.left > slot.left ? left - rect.left : rect.right - left)
                    : (rect.top > slot.top ? top - rect.top : rect.bottom - top),
                size = row ? rect.right - rect.left : rect.bottom - rect.top;

            // How far the pointer must travel into the hovered item (from the edge facing the held one) before
            // they swap. Same-size items swap almost on entry; a larger item needs half its surplus over the held
            // one, which leaves the pointer short of the swap-back point afterwards.
            if (depth > Math.max(0, (size - (row ? slot.right - slot.left : slot.bottom - slot.top)) / 2) + size * ENTER) {
                reflow(() => relocate(target, rect.index));
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
        motion.angle = angle;
        motion.x = x - originX;
        motion.y = y - originY;

        sort();
    }

    source.press.begin(e, {
        end,
        move: (e) => {
            x = e.clientX;
            y = e.clientY;
        },
        start: activate
    });
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


// Spread 'attributes' on the container and render the items inside it; each item renders one element, with the
// attributes its template is handed spread on it. Dropping reorders 'items', or moves an item between the lists of a
// group. A move between lists splices it out of one array and into the other, so a reactive object moved that way is
// disposed with its old place.
export default <T>(
    items: ReactiveArray<T>,
    template: (item: T, attributes: Attributes) => Renderable<unknown>,
    { drag: copy, group, handle, onsort }: Options<T> = {}
) => {
    let list: List<T> = {
            dragging: signal<T | null>(null),
            held: signal<T | null>(null),
            items,
            motion: reactive({ angle: 0, dropping: false, height: 0, left: 0, origin: '', radius: '', top: 0, width: 0, x: 0, y: 0 }),
            press: press(DELAY),
            revealing: signal<T | null>(null)
        };

    // Follows the pointer from the top layer, so no ancestor clips it or becomes its containing block.
    function ghost(item: T) {
        let motion = list.motion;

        return html`
            <div
                class='sortable-drag'
                inert
                popover='manual'
                ${{
                    class: () => motion.dropping && 'sortable-drag--dropping',
                    onconnect: (element: HTMLElement) => {
                        list.ghost = element;
                        element.showPopover();
                    },
                    // Its own fade, not one bubbling up from the content (the overlay fades too).
                    ontransitionstart: (e: TransitionEvent) => {
                        if (e.target === e.currentTarget && e.propertyName === 'opacity') {
                            list.reveal?.();
                        }
                    },
                    style: [
                        () => `--sortable-height: ${motion.height}px; --sortable-left: ${motion.left}px; --sortable-origin: ${motion.origin}; --sortable-radius: ${motion.radius}; --sortable-top: ${motion.top}px; --sortable-width: ${motion.width}px;`,
                        () => `--sortable-angle: ${motion.angle}deg; --sortable-x: ${motion.x}px; --sortable-y: ${motion.y}px;`
                    ]
                }}
            >
                ${copy ? copy(item) : template(item, {})}
            </div>
        `;
    }

    // Spread on the item's element. Only the held item reads the selector's true, so lift and drop restyle it alone. A
    // press goes to the nearest element with a pointerdown handler, so a nested list's item, or a control inside an
    // item with its own, keeps the press from this one.
    function hold(item: T): Attributes {
        return {
            class: () => signal.selector(list.held, item)
                ? 'sortable-item--held'
                : signal.selector(list.revealing, item) && 'sortable-item--revealing',
            onpointerdown: (e: PointerEvent) => {
                let element = e.currentTarget as HTMLElement;

                if (e.button !== 0 || !e.isPrimary || list.press.busy() || read(list.dragging) !== null) {
                    return;
                }

                if (handle && !element.contains((e.target as Element).closest(handle))) {
                    return;
                }

                drag(list as List<unknown>, element, item, e, { group, onsort: onsort as Options<unknown>['onsort'] });
            }
        };
    }

    return {
        attributes: {
            ...list.press.attributes,
            class: 'sortable',
            onconnect: (element: HTMLElement) => {
                list.container = element;

                if (!group) {
                    return;
                }

                let joined = groups.get(group);

                if (!joined) {
                    joined = new Set();
                    groups.set(group, joined);
                }

                joined.add(list as List<unknown>);
            },
            ondisconnect: () => {
                list.press.cancel();

                if (!group) {
                    return;
                }

                let joined = groups.get(group);

                joined?.delete(list as List<unknown>);

                if (joined?.size === 0) {
                    groups.delete(group);
                }
            }
        },
        // Lands changes made to 'items' this task now, for a caller that measures the list straight after.
        flush: () => list.slot?.flush(),
        render: () => {
            let slot = html.reactive(items, (item) => html`${template(item, hold(item))}`);

            list.slot = slot;

            return html`${slot}${() => {
                let item = read(list.dragging);

                return item !== null && ghost(item);
            }}`;
        }
    };
};
export type { Options as SortableOptions };
