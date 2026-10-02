import { flush, reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes, type Renderable } from '@esportsplus/template';


type A = Attributes & {
    [NESTED_MENU_TRIGGER]?: Attributes & { onclick?: never };
    animate?: boolean;
    items: Item[];
    ondocumentclick?: never;
    onkeydown?: never;
    onselect?: (item: Item) => void;
    state?: { active: boolean };
};

type Item = {
    danger?: boolean;
    disabled?: boolean;
    hint?: string;
    // Factory because the icon renders twice for branches: in the row and in the panel header.
    icon?: () => Renderable<unknown>;
    items?: Item[];
    label: string;
    onselect?: (item: Item) => void;
};

type MenuNode = {
    button?: HTMLElement;
    children: MenuNode[];
    item?: Item;
    panel?: HTMLElement;
    parent?: MenuNode;
    state: { open: boolean, render: boolean, settled: boolean };
};


const NESTED_MENU_TRIGGER = Symbol.for('@esportsplus/ui/tooltip.nested-menu.trigger');

// Keeps the shifted stack this far from the viewport edges.
const VIEWPORT_MARGIN = 8;


function covered(node: MenuNode) {
    for (let i = 0, n = node.children.length; i < n; i++) {
        if (node.children[i].state.open) {
            return true;
        }
    }

    return false;
}

function enabled(node: MenuNode) {
    let nodes: MenuNode[] = [];

    for (let i = 0, n = node.children.length; i < n; i++) {
        let child = node.children[i];

        if (child.button && !child.item?.disabled) {
            nodes.push(child);
        }
    }

    return nodes;
}

function tree(items: Item[], parent?: MenuNode) {
    let nodes: MenuNode[] = [];

    for (let i = 0, n = items.length; i < n; i++) {
        let node: MenuNode = {
            children: [],
            item: items[i],
            parent,
            state: reactive({ open: false, render: false, settled: false })
        };

        node.children = tree(items[i].items ?? [], node);
        nodes.push(node);
    }

    return nodes;
}


export default component(
    ({ animate = true, items, onselect, state = reactive({ active: false }), ...attributes }: A, content) => {
        let root: MenuNode = { children: [], state: reactive({ open: true, render: true, settled: true }) },
            stack: MenuNode[] = [root],
            trigger: HTMLElement | undefined;

        root.children = tree(items, root);

        function close(focus: boolean) {
            state.active = false;

            if (!animate) {
                reset();
            }

            if (focus) {
                trigger?.focus();
            }
        }

        function drill(node: MenuNode) {
            if (!node.children.length || node.item?.disabled) {
                return;
            }

            stack.push(node);

            if (node.state.render) {
                expand(node);
                return;
            }

            // A panel created already open has no closed state to transition from, so it would never
            // animate or settle; it renders closed and opens once that has painted.
            node.state.render = true;
        }

        function entry(node: MenuNode): Renderable<unknown> {
            let branch = node.children.length > 0,
                { danger, disabled, hint, icon, label } = node.item!;

            return html`
                <div class='tooltip-nested-menu-entry' ${{ class: () => node.state.open && 'tooltip-nested-menu-entry--open' }}>
                    <button
                        class='tooltip-nested-menu-item ${danger ? 'tooltip-nested-menu-item--danger' : ''}'
                        role='menuitem'
                        tabindex='-1'
                        type='button'
                        ${{
                            'aria-expanded': branch ? () => String(node.state.open) : undefined,
                            'aria-haspopup': branch ? 'menu' : undefined,
                            disabled: disabled === true,
                            onclick: () => {
                                if (branch) {
                                    drill(node);
                                }
                                else {
                                    select(node);
                                }
                            },
                            onrender: (element: HTMLElement) => {
                                node.button = element;
                            }
                        }}
                    >
                        ${icon ? html`<span class='tooltip-nested-menu-icon'>${icon()}</span>` : ''}
                        <span class='tooltip-nested-menu-label'>${label}</span>
                        ${hint ? html`<span class='tooltip-nested-menu-hint'>${hint}</span>` : ''}
                        ${branch ? html`<span class='tooltip-nested-menu-chevron'></span>` : ''}
                    </button>

                    ${() => branch && node.state.render ? panel(node) : ''}
                </div>
            `;
        }

        function expand(node: MenuNode) {
            // No transitionend will settle it: either still open from a pending close, or motion is off
            node.state.settled = node.state.open || instant();
            node.state.open = true;
            flush();
            enabled(node)[0]?.button?.focus();
        }

        function instant() {
            return !root.panel || parseFloat(getComputedStyle(root.panel).getPropertyValue('--open-duration')) === 0;
        }

        function open() {
            reset();
            state.active = true;
            shift();
            flush();
            enabled(root)[0]?.button?.focus();
        }

        function panel(node: MenuNode): Renderable<unknown> {
            let item = node.item;

            return html`
                <div
                    class='tooltip-nested-menu-panel'
                    role='menu'
                    ${{
                        class: () => {
                            let active = node === root ? state.active : node.state.open;

                            return `${active ? '--active' : ''} ${covered(node) ? 'tooltip-nested-menu-panel--covered' : ''} ${node.state.settled ? 'tooltip-nested-menu-panel--settled' : ''}`;
                        },
                        inert: () => node === root && !state.active,
                        // A dimmed parent panel's scrim takes the click; return to that level
                        onclick: () => {
                            if (node !== stack[stack.length - 1]) {
                                popTo(node);
                            }
                        },
                        onfirstpaint: () => {
                            if (node !== root && stack.includes(node)) {
                                expand(node);
                            }
                        },
                        onrender: (element: HTMLElement) => {
                            node.panel = element;
                        },
                        ontransitionend: (e: TransitionEvent) => {
                            if (e.target !== node.panel) {
                                return;
                            }

                            // Collapse the stack once the closing fade finishes so the next open starts at the root.
                            if (node === root) {
                                if (e.propertyName === 'opacity' && !state.active) {
                                    reset();
                                }
                            }
                            // The reveal clip would also clip nested panels, so it's dropped once the panel is open.
                            else if (e.propertyName === 'clip-path' && node.state.open) {
                                node.state.settled = true;
                            }
                        }
                    }}
                >
                    ${item ? html`
                        <div class='tooltip-nested-menu-header' onclick='${pop}'>
                            ${item.icon ? html`<span class='tooltip-nested-menu-icon'>${item.icon()}</span>` : ''}
                            <span class='tooltip-nested-menu-title'>
                                <span class='tooltip-nested-menu-title-regular'>${item.label}</span>
                                <span aria-hidden='true' class='tooltip-nested-menu-title-bold'>${item.label}</span>
                            </span>
                            <span class='tooltip-nested-menu-chevron'></span>
                        </div>
                    ` : ''}

                    ${node.children.map(entry)}
                </div>
            `;
        }

        function pop() {
            if (stack.length < 2) {
                return;
            }

            let node = stack.pop()!;

            node.state.settled = false;
            node.button?.focus();

            // Restore the clip before closing: 'none' can't interpolate, so closing straight from
            // the settled state would snap shut instead of animating.
            requestAnimationFrame(() => {
                if (!stack.includes(node)) {
                    node.state.open = false;
                }
            });
        }

        function popTo(node: MenuNode) {
            while (stack.length > 1 && stack[stack.length - 1] !== node) {
                pop();
            }
        }

        function reset() {
            while (stack.length > 1) {
                let node = stack.pop()!;

                node.state.open = false;
                node.state.settled = false;
            }
        }

        function select(node: MenuNode) {
            let item = node.item!;

            if (item.disabled) {
                return;
            }

            close(true);
            item.onselect?.(item);
            onselect?.(item);
        }

        // Moves the whole stack horizontally to stay inside the viewport; sub-panels inherit the
        // offset because they're positioned within the root panel.
        function shift() {
            let element = root.panel;

            if (!element) {
                return;
            }

            let current = parseFloat(element.style.getPropertyValue('--shift-x')) || 0,
                rect = element.getBoundingClientRect(),
                left = rect.left - current,
                right = rect.right - current,
                x = 0;

            if (right > window.innerWidth - VIEWPORT_MARGIN) {
                x = window.innerWidth - VIEWPORT_MARGIN - right;
            }

            if (left + x < VIEWPORT_MARGIN) {
                x = VIEWPORT_MARGIN - left;
            }

            element.style.setProperty('--shift-x', `${x}px`);
        }

        return html`
            <div
                class='tooltip tooltip--nested-menu ${animate ? '' : 'tooltip--instant'}'
                ${attributes}
                ${{
                    class: () => state.active && '--active',
                    ondocumentclick: function(this, e: MouseEvent) {
                        if (!state.active || !this?.isConnected) {
                            return;
                        }

                        if (!this.contains(e.target as Node | null)) {
                            close(false);
                        }
                    },
                    onkeydown: (e: KeyboardEvent) => {
                        if (!state.active) {
                            if (e.key === 'ArrowDown' && e.target === trigger) {
                                e.preventDefault();
                                open();
                            }

                            return;
                        }

                        let nodes = enabled(stack[stack.length - 1]),
                            index = nodes.findIndex((node) => node.button === document.activeElement),
                            n = nodes.length;

                        switch (e.key) {
                            case 'ArrowDown':
                                nodes[(index + 1) % n]?.button?.focus();
                                break;
                            case 'ArrowUp':
                                nodes[index < 1 ? n - 1 : index - 1]?.button?.focus();
                                break;
                            case 'ArrowLeft':
                            case 'Backspace':
                                pop();
                                break;
                            case 'ArrowRight':
                                if (index !== -1) {
                                    drill(nodes[index]);
                                }
                                break;
                            case 'End':
                                nodes[n - 1]?.button?.focus();
                                break;
                            case 'Escape':
                                if (stack.length > 1) {
                                    pop();
                                }
                                else {
                                    close(true);
                                }
                                break;
                            case 'Home':
                                nodes[0]?.button?.focus();
                                break;
                            case 'Tab':
                                close(true);
                                break;
                            // Enter and Space fall through to the native button click
                            default:
                                return;
                        }

                        e.preventDefault();
                    }
                }}
            >
                <button
                    aria-haspopup='menu'
                    class='tooltip-nested-menu-trigger'
                    type='button'
                    ${attributes[NESTED_MENU_TRIGGER]}
                    ${{
                        'aria-expanded': () => String(state.active),
                        onclick: () => {
                            if (state.active) {
                                close(false);
                            }
                            else {
                                open();
                            }
                        },
                        onrender: (element: HTMLElement) => {
                            trigger = element;
                        }
                    }}
                >
                    ${content}
                </button>

                ${panel(root)}
            </div>
        `;
    },
    { trigger: NESTED_MENU_TRIGGER }
);

export type { Item };
