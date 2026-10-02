import { flush, reactive, read, signal, write, type ReactiveArray, type Signal } from '@esportsplus/reactivity';
import { html, type Attributes, type Renderable } from '@esportsplus/template';
import { finished } from '~/shared/animation';
import './scss/index.scss';


// The drag a list started, from press to release; its container's document listeners hand events to it.
type Drag = {
    cancel: VoidFunction;
    move: (e: PointerEvent) => void;
    prevent: (e: Event) => void;
    release: (e: PointerEvent) => void;
    scroll: (e: TouchEvent) => void;
};

// An item's element, carrying the item it renders.
type Keyed = HTMLElement & { [SORTABLE_ITEM]?: unknown };

// One container's list. A drag only moves the placeholder; the items change once, on drop.
type List<T> = {
    active: Signal<boolean>;
    container?: HTMLElement;
    drag?: Drag;
    // The item the placeholder sits before, null past the last; undefined while it shows in another list or nowhere.
    gap: Signal<T | null | undefined>;
    // The item picked up from this list, until it is back in the flow.
    held: Signal<T | null>;
    items: ReactiveArray<T>;
    motion: Motion;
    // The dragged item's box, so the placeholder holds its slot.
    shape: Signal<string>;
    slot?: { flush(): void };
};

// Where the held item is drawn: the box it was picked up from, then the pointer's offset from there and the swing.
type Motion = {
    angle: number;
    height: number;
    left: number;
    origin: string;
    phase: Phase;
    top: number;
    width: number;
    x: number;
    y: number;
};

type Options<T> = {
    // Containers sharing a group name trade items; the list the drag started in receives 'onsort'.
    group?: string;
    // Selector for the part of an item that starts a drag; the whole item when omitted.
    handle?: string;
    onsort?: (item: T, from: number, to: number, source: ReactiveArray<T>, target: ReactiveArray<T>) => void;
};

// Its box before a reflow, so it can slide from there.
type Measured = Element & { [FIRST]?: DOMRect };

// 'lifting' places it out of flow, measured before the lift's scale and animation apply; 'settling' has it back in
// the flow with transitions off.
type Phase = '' | 'dragging' | 'dropping' | 'lifting' | 'settling';

// 'index' is the item's place in its list; -1 for the placeholder.
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

const FIRST = Symbol();

// Treats the item as hanging below the grab point, so a centered grab still swings.
const HANG = 0.5;

const SORTABLE_ITEM = Symbol();

// Seconds; low-pass on pointer velocity so uneven pointer/frame timing doesn't jolt the swing.
const SMOOTHING = 0.04;

const THRESHOLD = 4;


// Connected lists per group name, so a drag reaches every list it can drop into.
let groups = new Map<string, Set<List<unknown>>>();


function child(container: HTMLElement, node: Node | null) {
    while (node && node.parentNode !== container) {
        node = node.parentNode;
    }

    return node instanceof HTMLElement ? node : null;
}

function drag(source: List<unknown>, item: Keyed, e: PointerEvent, { group, onsort }: Options<unknown>) {
    let animations: Animation[] = [],
        baseLeft = 0,
        baseTop = 0,
        frame = 0,
        from = source.items.indexOf(item[SORTABLE_ITEM]),
        held = false,
        hole: Rect | null = null,
        // The pointer in the hovered list's own coordinates when it was last hit-tested.
        lastLeft = NaN,
        lastTop = NaN,
        layout: Rect[] = [],
        lists = group ? [...(groups.get(group) ?? [source])] : [source],
        motion = source.motion,
        // From the container's CSS, read on lift; no duration is no slide.
        shift: KeyframeAnimationOptions | null = null,
        originX = e.clientX,
        originY = e.clientY,
        pointer = e.pointerId,
        previousX = e.clientX,
        previousY = e.clientY,
        swing: ReturnType<typeof inertia> | null = null,
        time = 0,
        touch = e.pointerType === 'touch',
        timer = touch ? setTimeout(activate, DELAY) : undefined,
        value = item[SORTABLE_ITEM],
        x = e.clientX,
        y = e.clientY;

    function activate() {
        clearTimeout(timer);

        let rect = item.getBoundingClientRect(),
            computed = getComputedStyle(item),
            shape = `--radius: ${computed.borderRadius}; grid-column: ${computed.gridColumn}; grid-row: ${computed.gridRow}; height: ${rect.height}px; margin: ${computed.margin}; width: ${rect.width}px;`;

        let duration = computed.getPropertyValue('--shift-duration').trim();

        baseLeft = rect.left;
        baseTop = rect.top;
        held = true;
        shift = parseFloat(duration)
            ? {
                composite: 'add',
                duration: parseFloat(duration) * (duration.endsWith('ms') ? 1 : 1000),
                easing: computed.getPropertyValue('--shift-easing').trim()
            }
            : null;
        swing = inertia(computed, rect, originX - rect.left, originY - rect.top);

        reflow(() => {
            for (let i = 0, n = lists.length; i < n; i++) {
                write(lists[i].active, true);
                write(lists[i].shape, shape);
            }

            // The placeholder takes the item's slot, before it in the list, in the same pass the item leaves the
            // flow: a layout between them would lay out a shorter page and clamp its scroll.
            write(source.gap, value);
            write(source.held, value);
            motion.angle = 0;
            motion.height = rect.height;
            motion.left = rect.left;
            motion.origin = `${originX - rect.left}px ${originY - rect.top}px`;
            motion.phase = 'lifting';
            motion.top = rect.top;
            motion.width = rect.width;
            motion.x = 0;
            motion.y = 0;
            flush();

            // A transformed or filtered ancestor becomes the containing block for 'position: fixed'; correct
            // by the offset it introduced.
            let moved = item.getBoundingClientRect();

            motion.left = rect.left * 2 - moved.left;
            motion.phase = 'dragging';
            motion.top = rect.top * 2 - moved.top;
        });

        getSelection()?.removeAllRanges();
        frame = requestAnimationFrame(tick);
    }

    function cleanup() {
        cancelAnimationFrame(frame);
        clearTimeout(timer);
        source.drag = undefined;
    }

    // The items change once the item has landed on the placeholder: a move within the list sorts it, so its node
    // and whatever it holds stay; a move between lists takes it out of one and renders it in the other.
    function commit(target: List<unknown>) {
        let gap = read(target.gap),
            to: number;

        for (let i = 0, n = lists.length; i < n; i++) {
            write(lists[i].active, false);
            write(lists[i].gap, undefined);
        }

        if (target === source) {
            let rest = source.items.filter((v) => v !== value);

            to = gap === value ? from : gap === null ? rest.length : rest.indexOf(gap);

            if (to !== from) {
                rest.splice(to, 0, value);

                let rank = new Map(rest.map((v, i) => [v, i]));

                source.items.sort((a, b) => rank.get(a)! - rank.get(b)!);
            }
        }
        else {
            to = gap === null || gap === undefined ? target.items.length : target.items.indexOf(gap);
            source.items.splice(from, 1);
            target.items.splice(to, 0, value);
        }

        source.slot?.flush();
        target.slot?.flush();
        flush();

        if (onsort && (to !== from || target !== source)) {
            onsort(value, from, to, source.items, target.items);
        }
    }

    function drop() {
        let slot = hole?.element,
            target = hole?.list ?? source;

        cleanup();

        // Its box where the item lands, not partway through a shift.
        if (slot) {
            for (let animation of slot.getAnimations()) {
                animation.finish();
            }
        }

        let box = slot?.getBoundingClientRect() ?? { left: baseLeft, top: baseTop };

        // CSS carries it onto the placeholder.
        motion.angle = 0;
        motion.phase = 'dropping';
        motion.x = box.left - baseLeft;
        motion.y = box.top - baseTop;
        flush();

        void finished(item).then(() => {
            motion.phase = 'settling';
            flush();
            item.getBoundingClientRect();
            commit(target);
            motion.phase = '';
            write(source.held, null);
            flush();
        });

        // The pointerup that ended the drag is followed by a click on whatever sits under the pointer.
        addEventListener('click', swallow, true);
        setTimeout(() => removeEventListener('click', swallow, true));
    }

    // Slots the placeholder beside the target's item nearest the pointer, on the side the pointer is on:
    // left/right when that item shares a row with a sibling, above/below otherwise.
    function enter(target: List<unknown>) {
        for (let i = 0, n = lists.length; i < n; i++) {
            if (lists[i] !== target) {
                write(lists[i].gap, undefined);
            }
        }

        // The layout is still the last reflow's, in the list's own coordinates.
        let bounds = target.container!.getBoundingClientRect(),
            distance = Infinity,
            left = x - bounds.left + target.container!.scrollLeft,
            nearest: Rect | null = null,
            top = y - bounds.top + target.container!.scrollTop;

        for (let i = 0, n = layout.length; i < n; i++) {
            let rect = layout[i];

            if (rect.list !== target || rect.index === -1) {
                continue;
            }

            let d = Math.hypot(Math.max(rect.left - left, 0, left - rect.right), Math.max(rect.top - top, 0, top - rect.bottom));

            if (d < distance) {
                distance = d;
                nearest = rect;
            }
        }

        if (!nearest) {
            write(target.gap, null);
            return;
        }

        let row = false;

        for (let i = 0, n = layout.length; i < n; i++) {
            let other = layout[i];

            if (other === nearest || other.list !== target || other.index === -1) {
                continue;
            }

            if (other.top < nearest.bottom && other.bottom > nearest.top) {
                row = true;
                break;
            }
        }

        place(
            target,
            nearest.index,
            row ? left > (nearest.left + nearest.right) / 2 : top > (nearest.top + nearest.bottom) / 2
        );
    }

    function move(e: PointerEvent) {
        if (e.pointerId !== pointer) {
            return;
        }

        x = e.clientX;
        y = e.clientY;

        if (held || Math.hypot(x - originX, y - originY) < THRESHOLD) {
            return;
        }

        if (touch) {
            cleanup();
        }
        else {
            activate();
        }
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

    function place(list: List<unknown>, index: number, after: boolean) {
        write(list.gap, after ? (index + 1 < list.items.length ? list.items[index + 1] : null) : list.items[index]);
    }

    function reflow(mutate: VoidFunction) {
        for (let i = 0, n = lists.length; i < n; i++) {
            for (let element of lists[i].container?.children ?? []) {
                if (element !== item) {
                    (element as Measured)[FIRST] = element.getBoundingClientRect();
                }
            }
        }

        mutate();
        flush();

        for (let i = 0, n = animations.length; i < n; i++) {
            animations[i].cancel();
        }

        animations.length = 0;
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

            for (let element of parent.children) {
                if (!(element instanceof HTMLElement)) {
                    continue;
                }

                let placeholder = element.classList.contains('sortable-placeholder'),
                    position = placeholder ? -1 : index++;

                if (element === item) {
                    continue;
                }

                let rect = element.getBoundingClientRect(),
                    start = (element as Measured)[FIRST],
                    entry = {
                        bottom: rect.bottom - top,
                        element,
                        index: position,
                        left: rect.left - left,
                        list,
                        right: rect.right - left,
                        top: rect.top - top
                    };

                (element as Measured)[FIRST] = undefined;

                if (placeholder) {
                    hole = entry;
                }

                layout.push(entry);

                if (!start || !shift || (start.left === rect.left && start.top === rect.top)) {
                    continue;
                }

                animations.push(element.animate([
                    { translate: `${start.left - rect.left}px ${start.top - rect.top}px` },
                    { translate: '0px 0px' }
                ], shift));
            }
        }
    }

    function release(e: PointerEvent) {
        if (e.pointerId !== pointer) {
            return;
        }

        if (held) {
            drop();
        }
        else {
            cleanup();
        }
    }

    function scroll(e: TouchEvent) {
        if (held) {
            e.preventDefault();
        }
    }

    function sort() {
        let slot = hole,
            target = over();

        if (!slot || !target) {
            return;
        }

        if (target !== slot.list) {
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

        let gap = read(target.gap),
            at = gap === null ? target.items.length : target.items.indexOf(gap);

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

            // How far the pointer must travel into the hovered item (from the edge facing the placeholder)
            // before they swap. Same-size items swap almost on entry; a larger item needs half its surplus
            // over the placeholder, which leaves the pointer short of the swap-back point afterwards.
            if (depth > Math.max(0, (size - (row ? slot.right - slot.left : slot.bottom - slot.top)) / 2) + size * ENTER) {
                reflow(() => place(target, rect.index, rect.index >= at));
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

    source.drag = { cancel: cleanup, move, prevent, release, scroll };
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


// Spread 'attributes' on the container and render the items inside it; each item renders one element, with the
// attributes its template is handed spread on it. Dropping
// reorders 'items', or moves an item between the lists of a group. A move between lists splices it out of one array
// and into the other, so a reactive object moved that way is disposed with its old place.
export default <T>(items: ReactiveArray<T>, template: (item: T, attributes: Attributes) => Renderable<unknown>, { group, handle, onsort }: Options<T> = {}) => {
    let list: List<T> = {
            active: signal(false),
            gap: signal<T | null | undefined>(undefined),
            held: signal<T | null>(null),
            items,
            motion: reactive({ angle: 0, height: 0, left: 0, origin: '', phase: '' as Phase, top: 0, width: 0, x: 0, y: 0 }),
            shape: signal('')
        };

    // Spread on the item's element. Only the held item reads the motion, so a frame of it restyles that item alone.
    function hold(item: T): Attributes {
        let motion = list.motion;

        return {
            class: () => signal.selector(list.held, item) && motion.phase && `sortable-item--${motion.phase}`,
            onconnect: (element: Keyed) => {
                element[SORTABLE_ITEM] = item;
            },
            style: [
                () => signal.selector(list.held, item) && `--sortable-height: ${motion.height}px; --sortable-left: ${motion.left}px; --sortable-origin: ${motion.origin}; --sortable-top: ${motion.top}px; --sortable-width: ${motion.width}px;`,
                () => signal.selector(list.held, item) && `--sortable-angle: ${motion.angle}deg; --sortable-x: ${motion.x}px; --sortable-y: ${motion.y}px;`
            ]
        };
    }

    function placeholder() {
        return html`<div class='sortable-placeholder' style='${() => read(list.shape)}'></div>`;
    }

    return {
        attributes: {
            class: ['sortable', () => read(list.active) && '--active'],
            // Stops the page scrolling under a touch drag; cancelable only while a touch on the list lasts.
            onactivetouchmove: (e: TouchEvent) => list.drag?.scroll(e),
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
                list.drag?.cancel();

                if (!group) {
                    return;
                }

                let joined = groups.get(group);

                joined?.delete(list as List<unknown>);

                if (joined?.size === 0) {
                    groups.delete(group);
                }
            },
            ondocumentcontextmenu: (e: Event) => list.drag?.prevent(e),
            ondocumentdragstart: (e: Event) => list.drag?.prevent(e),
            ondocumentpointercancel: (e: PointerEvent) => list.drag?.release(e),
            ondocumentpointermove: (e: PointerEvent) => list.drag?.move(e),
            ondocumentpointerup: (e: PointerEvent) => list.drag?.release(e),
            ondocumentselectstart: (e: Event) => list.drag?.prevent(e),
            onpointerdown: (e: PointerEvent) => {
                let container = e.currentTarget as HTMLElement;

                if (e.button !== 0 || !e.isPrimary || list.drag || read(list.active)) {
                    return;
                }

                let item = child(container, e.target as Node) as Keyed | null;

                if (!item || !(SORTABLE_ITEM in item) || (handle && !item.contains((e.target as Element).closest(handle)))) {
                    return;
                }

                drag(list as List<unknown>, item, e, { group, onsort: onsort as Options<unknown>['onsort'] });
            }
        },
        // Lands changes made to 'items' this task now, for a caller that measures the list straight after.
        flush: () => list.slot?.flush(),
        render: () => {
            let slot = html.reactive(items, (item) => html`${() => read(list.gap) === item && placeholder()}${template(item, hold(item))}`);

            list.slot = slot;

            return html`${slot}${() => read(list.gap) === null && placeholder()}`;
        }
    };
};
export type { Options as SortableOptions };
