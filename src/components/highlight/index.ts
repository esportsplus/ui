import { reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes } from '@esportsplus/template';
import { ms } from '~/shared/animation';
import { observer, type Observer } from '~/shared/resize';
import { easing } from './easing';
import './scss/index.scss';


type A = Attributes & {
    // Whether the active layer fills its item; off leaves only the line, if any.
    fill?: boolean;
    hover?: boolean;
    // Draws a line along one edge of the active item, over the fill or on its own.
    line?: 'bottom' | 'left' | 'right' | 'top';
    onconnect?: never;
    ondisconnect?: never;
    ondocumentanimationstart?: never;
    ondocumentfocusin?: never;
    ondocumentfocusout?: never;
    ondocumentpointercancel?: never;
    ondocumentpointerdown?: never;
    ondocumentpointerout?: never;
    ondocumentpointerover?: never;
    ondocumentpointerup?: never;
    ondocumenttransitionrun?: never;
    // Selector for nested items to track; by default the highlight tracks its parent's direct children.
    target?: string;
};


type Glide = {
    item: Element | null;
    slides: Slide[];
};

type Layer = {
    height: number;
    radius: string;
    variant: string;
    visible: boolean;
    width: number;
    x: number;
    y: number;
};

type Name = 'active' | 'pointer';

type Placement = {
    from?: number[];
    item: Element;
    layer: Layer;
    timing?: Timing;
};

type Timing = {
    easing: string;
    lead: number;
    tail: number;
};

type Slide = {
    animation: Animation;
    // Offset the slide set out from, as x, y, width, height; it eases back to nothing.
    from: number[];
};

// Whether a parent lays its children out from its start, read once per parent: alignment is set up, not toggled.
const ANCHORED = new WeakMap<Element, boolean>();

// Every highlight's layers, so one nested in another's container doesn't wake it with its own motion or class flips.
const LAYERS = new WeakSet<Element>();

// Transitions that only repaint can't move an item, so they never start following.
const PAINT = /^(?:backdrop-filter|background|box-shadow|clip-path|color|fill|filter|opacity|outline|stroke|text-decoration|text-shadow|visibility)(?:-|$)|-color$/;

// Measure every queued highlight before any of them writes styles or starts a glide.
const pending = new Set<() => VoidFunction | undefined>();

let frame = 0;

function enqueue(measure: () => VoidFunction | undefined) {
    pending.add(measure);
    frame ||= requestAnimationFrame(() => {
        frame = 0;

        let reads = [...pending];

        pending.clear();

        let writes = reads.map((read) => read());

        for (let write of writes) {
            write?.();
        }
    });
}

function dequeue(measure: () => VoidFunction | undefined) {
    pending.delete(measure);

    if (!pending.size) {
        cancelAnimationFrame(frame);
        frame = 0;
    }
}


function active(parent: Element, self: Element[], target?: string) {
    if (target) {
        return parent.querySelector(`${target}.--active`);
    }

    let children = parent.children;

    for (let i = 0, n = children.length; i < n; i++) {
        let child = children[i];

        if (!self.includes(child) && child.classList.contains('--active')) {
            return child;
        }
    }

    return null;
}

// Laid out from the start, a change past an item can't shift it; centered, end-aligned or reversed, it can.
function anchored(parent: Element) {
    let value = ANCHORED.get(parent);

    if (value === undefined) {
        let style = getComputedStyle(parent);

        value = !/around|between|center|end|evenly|reverse|right/.test(
            `${style.alignContent} ${style.flexDirection} ${style.flexWrap} ${style.justifyContent} ${style.textAlign}`
        );
        ANCHORED.set(parent, value);
    }

    return value;
}

// Whether 'node' holds 'item' or comes before it in the document, where a change to it can move the item. A node
// already taken out of the document can only hold it.
function before(node: Node, item: Element) {
    return node.contains(item) || (node.isConnected && !!(node.compareDocumentPosition(item) & Node.DOCUMENT_POSITION_FOLLOWING));
}

// The highlight's own layers are siblings too; only tracked items define the group's ends.
function boundary(parent: Element, self: Element[], item: Element, target?: string) {
    let items = target ? parent.querySelectorAll(target) : parent.children,
        first: Element | undefined,
        last: Element | undefined;

    for (let candidate of items) {
        if (!self.includes(candidate)) {
            first ??= candidate;
            last = candidate;
        }
    }

    return item === first || item === last;
}

// Inside a collapsed group, like a closed tree folder, an item keeps a box but can't be seen.
function concealed(item: Element, parent: Element) {
    for (let node: Element | null = item; node && node !== parent; node = node.parentElement) {
        if ((node as HTMLElement).inert) {
            return true;
        }
    }

    return false;
}

function empty(): Layer {
    return { height: 0, radius: '0px', variant: '', visible: false, width: 0, x: 0, y: 0 };
}

function geometry(layer: Layer) {
    return `--border-radius: ${layer.radius}; --height: ${layer.height}px; --width: ${layer.width}px; --x: ${layer.x}px; --y: ${layer.y}px;`;
}

function glide(): Glide {
    return { item: null, slides: [] };
}

function halt(glide: Glide) {
    for (let i = 0, n = glide.slides.length; i < n; i++) {
        glide.slides[i].animation.cancel();
    }

    glide.slides = [];
}

// What is left of a glide's offset, eased: the layer shows at its target plus this.
function remaining(glide: Glide) {
    let left = [0, 0, 0, 0];

    for (let i = 0, n = glide.slides.length; i < n; i++) {
        let { animation, from } = glide.slides[i],
            progress = animation.playState === 'running' ? animation.effect?.getComputedTiming().progress : null;

        if (progress === null || progress === undefined) {
            continue;
        }

        for (let j = 0; j < 4; j++) {
            left[j] += from[j] * (1 - progress);
        }
    }

    return left;
}

function sibling(parent: Element, self: Element[], node: EventTarget | null, target?: string) {
    // Every highlight sees every document event; most land outside it, and one native check skips their ancestry.
    if (!(node instanceof Element) || !parent.contains(node)) {
        return null;
    }

    let element: Element | null = node;

    if (target) {
        element = element.closest(target);

        if (element && !parent.contains(element)) {
            element = null;
        }
    }
    else {
        while (element && element.parentElement !== parent) {
            element = element.parentElement;
        }
    }

    if (!element || self.includes(element) || element.classList.contains('--disabled')) {
        return null;
    }

    return element;
}


// Two layers: one rests on the '--active' item in '--background-active', the other follows hover and keyboard focus
// in '--background-hover' ('--background-pressed' while held), so the pointer never takes the selection's place.
//
// Items may differ in size and sit at any depth, so one highlight can serve nested rows. Moving to another item
// glides; the same item moving or resizing under it, like rows shifting as a folder above opens, is followed frame
// by frame, and a glide still under way carries on toward the item where it now is.
//
// Each edge glides on its own: the edge facing the move leads with '--glide' and the one behind trails with
// '--glide-tail', so a longer tail stretches the layer toward the new item before it gathers there.
export default component<A>(
    ({ fill = true, hover = true, line, target, ...attributes }) => {
        // Both layers know the line's edge, so the hover fill keeps clear of it just as the active fill does.
        let focused: Element | null = null,
            following = false,
            // Just observed after a mutation added them; their first size report is the insertion, already weighed.
            fresh = new WeakSet<Element>(),
            glides = { active: glide(), pointer: glide() },
            hovered: Element | null = null,
            layers = { active: reactive(empty()), pointer: reactive(empty()) },
            motions = new Set<Animation>(),
            mutations: MutationObserver | undefined,
            nodes: Record<Name, HTMLElement | null> = { active: null, pointer: null },
            parent: HTMLElement | null = null,
            pressed = false,
            resize: Observer | undefined,
            self: Element[] = [];

        // Animations and transitions near the items, a folder opening or a dialog scaling in, can move them without
        // resizing anything observed, so the layers are re-placed every frame until they finish. Only the motion
        // that fired is followed, and only if it ends: a looping spinner nearby would otherwise keep this per-frame.
        function follow(e: AnimationEvent | TransitionEvent) {
            let element = e.target,
                property = 'propertyName' in e ? e.propertyName : null;

            if (!(element instanceof Element) || !near(element) || (property && PAINT.test(property))) {
                return;
            }

            for (let animation of element.getAnimations()) {
                let fired = property
                    ? (animation as CSSTransition).transitionProperty === property
                    : (animation as CSSAnimation).animationName === (e as AnimationEvent).animationName;

                if (fired && animation.effect?.getComputedTiming().endTime !== Infinity) {
                    motions.add(animation);
                }
            }

            if (motions.size) {
                following = true;
                schedule();
            }
        }

        function moving() {
            let running = false;

            // Animation lookup forces style recalculation. Remember the animations when they start instead.
            for (let animation of motions) {
                if (animation.playState === 'running' || animation.pending) {
                    running = true;
                }
                else {
                    motions.delete(animation);
                }
            }

            return running;
        }

        function near(element: Element) {
            // Any highlight's layers sit out of flow, so their own fades and glides never move an item.
            return !!parent && !LAYERS.has(element) && (parent.contains(element) || element.contains(parent));
        }

        function measure(name: Name, item: Element | null, box: DOMRect, variant: string): Placement | null {
            let glide = glides[name],
                layer = layers[name];

            // An unrendered container (a closed dialog) has nothing to measure; staying hidden lets it enter in place.
            if (!item || !parent || !box.width || concealed(item, parent)) {
                return null;
            }

            let rect = item.getBoundingClientRect(),
                // A transformed ancestor (a dialog scaling open) skews client rects; scale back to layout pixels.
                scale = parent.offsetWidth / box.width,
                height = rect.height * scale,
                width = rect.width * scale,
                x = (rect.left - box.left) * scale - parent.clientLeft + parent.scrollLeft,
                y = (rect.top - box.top) * scale - parent.clientTop + parent.scrollTop,
                from: number[] | undefined,
                timing: Timing | undefined;

            if (layer.visible && glide.item && glide.item !== item) {
                let left = remaining(glide);

                from = [layer.x + left[0] - x, layer.y + left[1] - y, layer.width + left[2] - width, layer.height + left[3] - height];

                let node = nodes[name];

                if (node) {
                    let style = getComputedStyle(node),
                        easing = boundary(parent, self, item, target) ? '--glide-timing-function-edge' : '--glide-timing-function';

                    timing = {
                        easing: style.getPropertyValue(easing).trim() || 'ease',
                        lead: ms(style.getPropertyValue('--glide')),
                        tail: ms(style.getPropertyValue('--glide-tail'))
                    };
                }
            }

            return {
                from,
                item,
                layer: { height, radius: getComputedStyle(item).borderRadius, variant, visible: true, width, x, y },
                timing
            };
        }

        function place(name: Name, measured: Placement | null) {
            let glide = glides[name],
                layer = layers[name];

            if (!measured) {
                halt(glide);
                glide.item = null;
                layer.visible = false;
                return;
            }

            // Entering from hidden snaps into place, so a glide left over from before it hid is dropped.
            if (!layer.visible) {
                halt(glide);
            }
            else if (measured.from && measured.timing) {
                slide(name, measured.from, measured.timing);
            }

            glide.item = measured.item;
            Object.assign(layer, measured.layer);
        }

        // The layer's box always sits on its item; a glide is an offset added on top, easing to nothing, so the item
        // can keep moving underneath without restarting it.
        function slide(name: Name, from: number[], timing: Timing) {
            let glide = glides[name],
                node = nodes[name];

            halt(glide);

            if (!node || from.every((value) => Math.abs(value) < 0.5)) {
                return;
            }

            let lead = [0, 0, 0, 0],
                tail = [0, 0, 0, 0];

            // Per axis the start edge (left, top) is offset by the position and the end edge by position plus size;
            // the offset points back to where the layer was, so a negative one is a move toward the end.
            for (let axis = 0; axis < 2; axis++) {
                let start = from[axis],
                    end = start + from[axis + 2],
                    forward = start + end < 0,
                    a = forward ? tail : lead,
                    b = forward ? lead : tail;

                // The start edge moves by shifting the layer and giving the size back, so the end edge stays put.
                a[axis] += start;
                a[axis + 2] -= start;
                b[axis + 2] += end;
            }

            // Limit the spring by edge travel, including size changes and any interrupted glide's remainder.
            let distance = Math.max(Math.abs(from[0]), Math.abs(from[1]), Math.abs(from[0] + from[2]), Math.abs(from[1] + from[3])),
                curve = easing(timing.easing, distance),
                slides = [[lead, timing.lead], [tail, timing.tail]] as const;

            for (let i = 0, n = slides.length; i < n; i++) {
                let [offset, duration] = slides[i];

                if (!duration || offset.every((value) => Math.abs(value) < 0.5)) {
                    continue;
                }

                glide.slides.push({
                    animation: node.animate(
                        [
                            {
                                '--slide-height': `${offset[3]}px`,
                                '--slide-width': `${offset[2]}px`,
                                '--slide-x': `${offset[0]}px`,
                                '--slide-y': `${offset[1]}px`
                            },
                            { '--slide-height': '0px', '--slide-width': '0px', '--slide-x': '0px', '--slide-y': '0px' }
                        ],
                        { composite: 'add', duration, easing: curve }
                    ),
                    from: offset
                });
            }
        }

        function schedule() {
            enqueue(update);
        }

        // Whether a mutation could move one of 'items' or change which item is active. Recycled rows, their own class
        // flips and anything rebuilt inside them leave a resting highlight alone; an item marked active, one taken
        // out, or anything changed ahead of one (an insert above, a reorder) is measured.
        function relevant(record: MutationRecord, items: Element[]) {
            let host = record.target as Element,
                owner = target ? host.parentElement?.closest(target) : host.parentElement === parent ? null : host.parentElement;

            // Within an item that holds none of them: it only reaches the others through its own observed size.
            if (owner && parent?.contains(owner) && owner !== parent && !items.some((item) => owner.contains(item))) {
                return false;
            }

            if (record.type === 'attributes') {
                // 'inert' only conceals what it holds; a class can also reflow whatever follows.
                return items.some((item) => record.attributeName === 'inert' ? host.contains(item) : before(host, item));
            }

            for (let nodes of [record.addedNodes, record.removedNodes]) {
                for (let node of nodes) {
                    if (items.some((item) => node.contains(item))) {
                        return true;
                    }
                }
            }

            // The change sits just before 'nextSibling', or at the end of its parent.
            return items.some((item) =>
                (record.nextSibling ? before(record.nextSibling, item) : !host.contains(item) && before(host, item)) ||
                (host.contains(item) && !anchored(host))
            );
        }

        function release() {
            if (pressed) {
                pressed = false;
                schedule();
            }
        }

        // What a change has to reach to matter: the items the layers rest on or are headed for, and the active one.
        function tracked() {
            let items = [glides.active.item, glides.pointer.item, hovered, focused, parent && active(parent, self, target)];

            return items.filter((item): item is Element => !!item);
        }

        function update() {
            if (!parent) {
                return;
            }

            // Items re-rendered away take their hover and focus with them.
            if (hovered && !parent.contains(hovered)) {
                hovered = null;
            }

            if (focused && !parent.contains(focused)) {
                focused = null;
            }

            // Animation inspection and both layers' geometry belong to the read phase too.
            following = following && moving();

            let container = parent,
                box = parent.getBoundingClientRect(),
                current = active(parent, self, target),
                item = hovered || focused,
                selected = measure('active', current, box, '--active'),
                pointer = measure('pointer', item, box, pressed && item === hovered ? 'highlight--pressed' : 'highlight--hover');

            return () => {
                if (parent !== container) {
                    return;
                }

                place('active', selected);
                // The pointer layer sits beneath the active one, so over the active item it stays put under it.
                place('pointer', pointer);

                if (following) {
                    schedule();
                }
            };
        }

        // Both layers sit at the same z-index, so the pointer layer comes first to paint beneath the active one.
        return html`
            <div
                aria-hidden='true'
                class='highlight'
                ${attributes}
                ${{
                    class: [
                        () => layers.pointer.variant,
                        line && `highlight--line-${line}`,
                        () => layers.pointer.visible && 'highlight--visible'
                    ],
                    onconnect: (element: HTMLElement) => {
                        LAYERS.add(element);
                        nodes.pointer = element;
                        self.push(element);
                    },
                    style: () => geometry(layers.pointer)
                }}
            ></div>
            <div
                aria-hidden='true'
                class='highlight'
                ${attributes}
                ${{
                    class: [
                        () => layers.active.variant,
                        !fill && 'highlight--unfilled',
                        line && 'highlight--line',
                        line && `highlight--line-${line}`,
                        () => layers.active.visible && 'highlight--visible'
                    ],
                    onconnect: (element: HTMLElement) => {
                        let container = element.parentElement;

                        LAYERS.add(element);
                        nodes.active = element;
                        self.push(element);

                        if (!container) {
                            return;
                        }

                        parent = container;

                        mutations = new MutationObserver((records) => {
                            let changed = false,
                                items = tracked();

                            for (let i = 0, n = records.length; i < n; i++) {
                                let record = records[i];

                                // Layers' class flips are mutations too; reacting to our own would loop.
                                if (LAYERS.has(record.target as Element)) {
                                    continue;
                                }

                                // Only items and the container's children, as on connect; anything deeper that moves
                                // them resizes one of those.
                                for (let node of record.addedNodes) {
                                    if (
                                        node instanceof Element &&
                                        !LAYERS.has(node) &&
                                        (node.parentElement === container || (target && node.matches(target)))
                                    ) {
                                        fresh.add(node);
                                        resize?.observe(node);
                                    }
                                }

                                for (let node of record.removedNodes) {
                                    if (node instanceof Element) {
                                        resize?.unobserve(node);
                                    }
                                }

                                changed ||= relevant(record, items);
                            }

                            if (changed) {
                                schedule();
                            }
                        });
                        mutations.observe(container, { attributeFilter: ['class', 'inert'], attributes: true, childList: true, subtree: true });

                        // A size change moves an item only from ahead of it, around it, or past it in a parent that
                        // isn't laid out from its start; a virtual list's rows and trailing spacer resizing below a
                        // resting highlight don't.
                        resize = observer((entries) => {
                            let items: Element[] | undefined;

                            for (let i = 0, n = entries.length; i < n; i++) {
                                let node = entries[i].target,
                                    host = node.parentElement;

                                if (fresh.delete(node)) {
                                    continue;
                                }

                                items ??= tracked();

                                if (
                                    node === container ||
                                    items.some((item) => before(node, item) || (!!host && host.contains(item) && !anchored(host)))
                                ) {
                                    schedule();
                                    return;
                                }
                            }
                        });
                        resize.observe(container);

                        for (let child of container.children) {
                            if (!self.includes(child)) {
                                resize.observe(child);
                            }
                        }

                        // Nested items too, as mutations add them, so one shown or resized is seen wherever it sits.
                        if (target) {
                            for (let item of container.querySelectorAll(target)) {
                                resize.observe(item);
                            }
                        }

                        schedule();
                    },
                    ondisconnect: () => {
                        mutations?.disconnect();
                        mutations = undefined;
                        resize?.disconnect();
                        resize = undefined;

                        dequeue(update);
                        following = false;
                        motions.clear();

                        for (let name of ['active', 'pointer'] as const) {
                            halt(glides[name]);
                            glides[name] = glide();
                        }

                        focused = null;
                        hovered = null;
                        parent = null;
                    },
                    ondocumentanimationstart: follow,
                    ondocumentfocusin: (e: FocusEvent) => {
                        if (!parent || !parent.contains(e.target as Node | null)) {
                            return;
                        }

                        focused = (e.target as Element).matches(':focus-visible') ? sibling(parent, self, e.target, target) : null;
                        schedule();
                    },
                    ondocumentfocusout: (e: FocusEvent) => {
                        if (!parent?.contains(e.target as Node | null) || parent.contains(e.relatedTarget as Node | null)) {
                            return;
                        }

                        focused = null;
                        schedule();
                    },
                    ondocumentpointercancel: release,
                    ondocumentpointerdown: (e: PointerEvent) => {
                        let item = hover && parent ? sibling(parent, self, e.target, target) : null;

                        if (!item) {
                            return;
                        }

                        hovered = item;
                        pressed = true;
                        schedule();
                    },
                    // Crossing gaps between siblings keeps the last one so the highlight glides instead of snapping back.
                    ondocumentpointerout: (e: PointerEvent) => {
                        if (!hover || !parent?.contains(e.target as Node | null) || parent.contains(e.relatedTarget as Node | null)) {
                            return;
                        }

                        hovered = null;
                        pressed = false;
                        schedule();
                    },
                    ondocumentpointerover: (e: PointerEvent) => {
                        let item = hover && parent ? sibling(parent, self, e.target, target) : null;

                        if (!item || item === hovered) {
                            return;
                        }

                        hovered = item;
                        schedule();
                    },
                    ondocumentpointerup: release,
                    ondocumenttransitionrun: follow,
                    style: () => geometry(layers.active)
                }}
            ></div>
        `;
    }
);
