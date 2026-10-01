import { reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes } from '@esportsplus/template';
import { reduced } from '~/shared/animation';
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

type Slide = {
    animation: Animation;
    // Offset the slide set out from, as x, y, width, height; it eases back to nothing.
    from: number[];
};


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

function glide(): Glide {
    return { item: null, slides: [] };
}

function halt(glide: Glide) {
    for (let i = 0, n = glide.slides.length; i < n; i++) {
        glide.slides[i].animation.cancel();
    }

    glide.slides = [];
}

function milliseconds(value: string) {
    let n = parseFloat(value);

    return isNaN(n) ? 0 : value.trim().endsWith('ms') ? n : n * 1000;
}

// Written straight to the layer: the template applies bindings a frame late, and a glide starting now would spend
// that frame added onto the item the layer is leaving, throwing it past that item for a frame.
function paint(node: HTMLElement | null, layer: Layer) {
    if (!node) {
        return;
    }

    let style = node.style;

    style.setProperty('--border-radius', layer.radius);
    style.setProperty('--height', `${layer.height}px`);
    style.setProperty('--width', `${layer.width}px`);
    style.setProperty('--x', `${layer.x}px`);
    style.setProperty('--y', `${layer.y}px`);
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
    let element = node instanceof Element ? node : null;

    if (target) {
        element = element?.closest(target) ?? null;

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
        let edge = line ? ` --line-${line}` : '',
            focused: Element | null = null,
            frame = 0,
            glides = { active: glide(), pointer: glide() },
            hovered: Element | null = null,
            layers = { active: reactive(empty()), pointer: reactive(empty()) },
            mutations: MutationObserver | undefined,
            nodes: Record<Name, HTMLElement | null> = { active: null, pointer: null },
            parent: HTMLElement | null = null,
            pressed = false,
            resize: ResizeObserver | undefined,
            self: Element[] = [];

        // Animations and transitions near the items, a folder opening or a dialog scaling in, can move them without
        // resizing anything observed, so the layers are re-placed every frame until they finish.
        function follow(e: Event) {
            if (!frame && parent && e.target instanceof Element && near(e.target)) {
                frame = requestAnimationFrame(tick);
            }
        }

        function moving() {
            let animations = document.getAnimations();

            for (let i = 0, n = animations.length; i < n; i++) {
                let animation = animations[i],
                    target = (animation.effect as KeyframeEffect | null)?.target;

                if (animation.playState === 'running' && target && near(target)) {
                    return true;
                }
            }

            return false;
        }

        function near(element: Element) {
            return !!parent && !self.includes(element) && (parent.contains(element) || element.contains(parent));
        }

        function place(name: Name, item: Element | null, box: DOMRect, variant: string) {
            let glide = glides[name],
                layer = layers[name];

            // An unrendered container (a closed dialog) has nothing to measure; staying hidden lets it enter in place.
            if (!item || !parent || !box.width || concealed(item, parent)) {
                glide.item = null;
                layer.visible = false;
                return;
            }

            let rect = item.getBoundingClientRect(),
                // A transformed ancestor (a dialog scaling open) skews client rects; scale back to layout pixels.
                scale = parent.offsetWidth / box.width,
                height = rect.height * scale,
                width = rect.width * scale,
                x = (rect.left - box.left) * scale - parent.clientLeft + parent.scrollLeft,
                y = (rect.top - box.top) * scale - parent.clientTop + parent.scrollTop;

            // Entering from hidden snaps into place, so a glide left over from before it hid is dropped.
            if (!layer.visible) {
                halt(glide);
            }
            else if (glide.item && glide.item !== item) {
                let left = remaining(glide);

                slide(name, [layer.x + left[0] - x, layer.y + left[1] - y, layer.width + left[2] - width, layer.height + left[3] - height]);
            }

            glide.item = item;
            layer.height = height;
            layer.radius = getComputedStyle(item).borderRadius;
            layer.variant = variant;
            layer.visible = true;
            layer.width = width;
            layer.x = x;
            layer.y = y;

            paint(nodes[name], layer);
        }

        // The layer's box always sits on its item; a glide is an offset added on top, easing to nothing, so the item
        // can keep moving underneath without restarting it.
        function slide(name: Name, from: number[]) {
            let glide = glides[name],
                node = nodes[name];

            halt(glide);

            if (!node || from.every((value) => Math.abs(value) < 0.5) || reduced()) {
                return;
            }

            let lead = [0, 0, 0, 0],
                style = getComputedStyle(node),
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

            let easing = style.getPropertyValue('--glide-timing-function').trim() || 'ease',
                slides = [
                    [lead, milliseconds(style.getPropertyValue('--glide'))],
                    [tail, milliseconds(style.getPropertyValue('--glide-tail'))]
                ] as const;

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
                        { composite: 'add', duration, easing }
                    ),
                    from: offset
                });
            }
        }

        function tick() {
            frame = 0;

            if (!parent) {
                return;
            }

            update();

            if (moving()) {
                frame = requestAnimationFrame(tick);
            }
        }

        function release() {
            if (pressed) {
                pressed = false;
                update();
            }
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

            let box = parent.getBoundingClientRect(),
                current = active(parent, self, target),
                item = hovered || focused;

            place('active', current, box, '--active');
            // The pointer layer sits beneath the active one, so over the active item it stays put under it instead
            // of leaving.
            place(
                'pointer',
                item,
                box,
                pressed && item === hovered ? '--pressed' : '--hover'
            );
        }

        // Both layers sit at the same z-index, so the pointer layer comes first to paint beneath the active one.
        return html`
            <div
                aria-hidden='true'
                class='highlight'
                ${attributes}
                ${{
                    class: () => `${layers.pointer.variant}${edge}${layers.pointer.visible ? ' --visible' : ''}`,
                    onrender: (element: HTMLElement) => {
                        nodes.pointer = element;
                        self.push(element);
                    }
                }}
            ></div>
            <div
                aria-hidden='true'
                class='highlight'
                ${attributes}
                ${{
                    class: () => `${layers.active.variant}${fill ? '' : ' --unfilled'}${line ? ` --line${edge}` : ''}${layers.active.visible ? ' --visible' : ''}`,
                    onconnect: (element: HTMLElement) => {
                        let container = element.parentElement;

                        if (!container) {
                            return;
                        }

                        parent = container;

                        mutations = new MutationObserver((records) => {
                            let changed = false;

                            for (let i = 0, n = records.length; i < n; i++) {
                                let record = records[i];

                                // Our own class flips are mutations too; reacting to them would loop.
                                if (self.includes(record.target as Element)) {
                                    continue;
                                }

                                changed = true;

                                for (let node of record.addedNodes) {
                                    if (node instanceof Element) {
                                        resize?.observe(node);
                                    }
                                }

                                for (let node of record.removedNodes) {
                                    if (node instanceof Element) {
                                        resize?.unobserve(node);
                                    }
                                }
                            }

                            if (changed) {
                                update();
                            }
                        });
                        mutations.observe(container, { attributeFilter: ['class', 'inert'], attributes: true, childList: true, subtree: true });

                        resize = new ResizeObserver(update);
                        resize.observe(container);

                        for (let child of container.children) {
                            if (!self.includes(child)) {
                                resize.observe(child);
                            }
                        }

                        update();
                    },
                    ondisconnect: () => {
                        mutations?.disconnect();
                        mutations = undefined;
                        resize?.disconnect();
                        resize = undefined;

                        cancelAnimationFrame(frame);
                        frame = 0;

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
                        update();
                    },
                    ondocumentfocusout: (e: FocusEvent) => {
                        if (!parent?.contains(e.target as Node | null) || parent.contains(e.relatedTarget as Node | null)) {
                            return;
                        }

                        focused = null;
                        update();
                    },
                    ondocumentpointercancel: release,
                    ondocumentpointerdown: (e: PointerEvent) => {
                        let item = hover && parent ? sibling(parent, self, e.target, target) : null;

                        if (!item) {
                            return;
                        }

                        hovered = item;
                        pressed = true;
                        update();
                    },
                    // Crossing gaps between siblings keeps the last one so the highlight glides instead of snapping back.
                    ondocumentpointerout: (e: PointerEvent) => {
                        if (!hover || !parent?.contains(e.target as Node | null) || parent.contains(e.relatedTarget as Node | null)) {
                            return;
                        }

                        hovered = null;
                        pressed = false;
                        update();
                    },
                    ondocumentpointerover: (e: PointerEvent) => {
                        let item = hover && parent ? sibling(parent, self, e.target, target) : null;

                        if (!item || item === hovered) {
                            return;
                        }

                        hovered = item;
                        update();
                    },
                    ondocumentpointerup: release,
                    ondocumenttransitionrun: follow,
                    onrender: (element: HTMLElement) => {
                        nodes.active = element;
                        self.push(element);
                    }
                }}
            ></div>
        `;
    }
);


