import { reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes } from '@esportsplus/template';
import './scss/index.scss';


type A = Attributes & {
    hover?: boolean;
    onconnect?: never;
    ondisconnect?: never;
    ondocumentfocusin?: never;
    ondocumentfocusout?: never;
    ondocumentpointercancel?: never;
    ondocumentpointerdown?: never;
    ondocumentpointerout?: never;
    ondocumentpointerover?: never;
    ondocumentpointerup?: never;
    // Selector for nested items to track; by default the highlight tracks its parent's direct children.
    target?: string;
};


function active(parent: Element, self: Element, target?: string) {
    if (target) {
        return parent.querySelector(`${target}.--active`);
    }

    let children = parent.children;

    for (let i = 0, n = children.length; i < n; i++) {
        let child = children[i];

        if (child !== self && child.classList.contains('--active')) {
            return child;
        }
    }

    return null;
}

function sibling(parent: Element, self: Element, node: EventTarget | null, target?: string) {
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

    if (!element || element === self || element.classList.contains('--disabled')) {
        return null;
    }

    return element;
}


export default component<A>(
    ({ hover = true, target, ...attributes }) => {
        let focused: Element | null = null,
            hovered: Element | null = null,
            mutations: MutationObserver | undefined,
            parent: HTMLElement | null = null,
            pressed = false,
            resize: ResizeObserver | undefined,
            self: HTMLElement | null = null,
            state = reactive({
                height: 0,
                radius: '0px',
                variant: '',
                visible: false,
                width: 0,
                x: 0,
                y: 0
            });

        function release() {
            if (pressed) {
                pressed = false;
                update();
            }
        }

        function update() {
            if (!parent || !self) {
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
                item = hovered || focused || active(parent, self, target);

            // An unrendered container (a closed dialog) has nothing to measure; staying hidden lets it enter in place.
            if (!item || !box.width) {
                state.visible = false;
                return;
            }

            let rect = item.getBoundingClientRect(),
                // A transformed ancestor (a dialog scaling open) skews client rects; scale back to layout pixels.
                scale = box.width ? parent.offsetWidth / box.width : 1;

            state.height = rect.height * scale;
            state.radius = getComputedStyle(item).borderRadius;
            state.variant = item.classList.contains('--active')
                ? '--active'
                : pressed && item === hovered ? '--pressed' : '--hover';
            state.visible = true;
            state.width = rect.width * scale;
            state.x = (rect.left - box.left) * scale - parent.clientLeft + parent.scrollLeft;
            state.y = (rect.top - box.top) * scale - parent.clientTop + parent.scrollTop;
        }

        return html`
            <div
                aria-hidden='true'
                class='highlight'
                ${attributes}
                ${{
                    class: () => `${state.variant}${state.visible ? ' --visible' : ''}`,
                    onconnect: (element: HTMLElement) => {
                        let container = element.parentElement;

                        if (!container) {
                            return;
                        }

                        parent = container;
                        self = element;

                        mutations = new MutationObserver((records) => {
                            let changed = false;

                            for (let i = 0, n = records.length; i < n; i++) {
                                let record = records[i];

                                // Our own class flips are mutations too; reacting to them would loop.
                                if (record.target === element) {
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
                        mutations.observe(container, { attributeFilter: ['class'], attributes: true, childList: true, subtree: true });

                        resize = new ResizeObserver(update);
                        resize.observe(container);

                        for (let child of container.children) {
                            if (child !== element) {
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

                        focused = null;
                        hovered = null;
                        parent = null;
                        self = null;
                    },
                    ondocumentfocusin: (e: FocusEvent) => {
                        if (!parent || !self || !parent.contains(e.target as Node | null)) {
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
                        let item = hover && parent && self ? sibling(parent, self, e.target, target) : null;

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
                        let item = hover && parent && self ? sibling(parent, self, e.target, target) : null;

                        if (!item || item === hovered) {
                            return;
                        }

                        hovered = item;
                        update();
                    },
                    ondocumentpointerup: release,
                    style: () => `
                        --border-radius: ${state.radius};
                        --height: ${state.height}px;
                        --width: ${state.width}px;
                        --x: ${state.x}px;
                        --y: ${state.y}px;
                    `
                }}
            ></div>
        `;
    }
);
