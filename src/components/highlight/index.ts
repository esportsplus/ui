import { reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes } from '@esportsplus/template';
import './scss/index.scss';


type A = Attributes & {
    onconnect?: never;
    ondisconnect?: never;
    ondocumentfocusin?: never;
    ondocumentfocusout?: never;
    ondocumentpointercancel?: never;
    ondocumentpointerdown?: never;
    ondocumentpointerout?: never;
    ondocumentpointerover?: never;
    ondocumentpointerup?: never;
};


function active(parent: Element, self: Element) {
    let children = parent.children;

    for (let i = 0, n = children.length; i < n; i++) {
        let child = children[i];

        if (child !== self && child.classList.contains('--active')) {
            return child;
        }
    }

    return null;
}

function sibling(parent: Element, self: Element, node: EventTarget | null) {
    let element = node instanceof Element ? node : null;

    while (element && element.parentElement !== parent) {
        element = element.parentElement;
    }

    if (!element || element === self || element.classList.contains('--disabled')) {
        return null;
    }

    return element;
}


export default component<A>(
    (attributes) => {
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

            if (hovered?.parentElement !== parent) {
                hovered = null;
            }

            if (focused?.parentElement !== parent) {
                focused = null;
            }

            let target = hovered || focused || active(parent, self);

            if (!target) {
                state.visible = false;
                return;
            }

            let box = parent.getBoundingClientRect(),
                rect = target.getBoundingClientRect();

            state.height = rect.height;
            state.radius = getComputedStyle(target).borderRadius;
            state.variant = target.classList.contains('--active')
                ? '--active'
                : pressed && target === hovered ? '--pressed' : '--hover';
            state.visible = true;
            state.width = rect.width;
            state.x = rect.left - box.left - parent.clientLeft + parent.scrollLeft;
            state.y = rect.top - box.top - parent.clientTop + parent.scrollTop;
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

                        focused = (e.target as Element).matches(':focus-visible') ? sibling(parent, self, e.target) : null;
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
                        let target = parent && self ? sibling(parent, self, e.target) : null;

                        if (!target) {
                            return;
                        }

                        hovered = target;
                        pressed = true;
                        update();
                    },
                    // Crossing gaps between siblings keeps the last one so the highlight glides instead of snapping back.
                    ondocumentpointerout: (e: PointerEvent) => {
                        if (!parent?.contains(e.target as Node | null) || parent.contains(e.relatedTarget as Node | null)) {
                            return;
                        }

                        hovered = null;
                        pressed = false;
                        update();
                    },
                    ondocumentpointerover: (e: PointerEvent) => {
                        let target = parent && self ? sibling(parent, self, e.target) : null;

                        if (!target || target === hovered) {
                            return;
                        }

                        hovered = target;
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
