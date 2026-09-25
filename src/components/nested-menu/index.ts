import { reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import './scss/index.scss';


type A = Attributes & {
    [NESTED_MENU_TRIGGER]?: Attributes;
    animate?: boolean;
    items: Item[];
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


const NESTED_MENU_TRIGGER = Symbol.for('@esportsplus/ui/nested-menu.trigger');

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
    if (!node.panel) {
        return [];
    }

    return Array.from(
        node.panel.querySelectorAll<HTMLElement>(':scope > .nested-menu-entry > .nested-menu-item:not(:disabled)')
    );
}

// Class and attribute updates are applied on the next frame, so focus waits one more.
function later(fn: VoidFunction) {
    requestAnimationFrame(() => requestAnimationFrame(fn));
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
        let elements = new WeakMap<Element, MenuNode>(),
            root: MenuNode = { children: [], state: reactive({ open: true, render: true, settled: true }) },
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
            // animate or settle; paint it closed first.
            node.state.render = true;

            later(() => {
                if (stack.includes(node)) {
                    expand(node);
                }
            });
        }

        function entry(node: MenuNode): Renderable<unknown> {
            let branch = node.children.length > 0,
                { danger, disabled, hint, icon, label } = node.item!;

            return html`
                <div class='nested-menu-entry' ${{ class: () => node.state.open && '--open' }}>
                    <button
                        class='nested-menu-item ${danger ? '--danger' : ''}'
                        role='menuitem'
                        tabindex='-1'
                        type='button'
                        ${{
                            'aria-expanded': branch ? () => String(node.state.open) : undefined,
                            'aria-haspopup': branch ? 'menu' : undefined,
                            disabled: disabled === true,
                            onconnect: (element: HTMLElement) => {
                                elements.set(element, node);
                                node.button = element;
                            }
                        }}
                    >
                        ${icon ? html`<span class='nested-menu-icon'>${icon()}</span>` : ''}
                        <span class='nested-menu-label'>${label}</span>
                        ${hint ? html`<span class='nested-menu-hint'>${hint}</span>` : ''}
                        ${branch ? html`<span class='nested-menu-chevron'></span>` : ''}
                    </button>

                    ${() => branch && node.state.render ? panel(node) : ''}
                </div>
            `;
        }

        function expand(node: MenuNode) {
            // No transitionend will settle it: either still open from a pending close, or motion is off
            node.state.settled = node.state.open || instant();
            node.state.open = true;

            later(() => enabled(node)[0]?.focus());
        }

        function instant() {
            return !root.panel || parseFloat(getComputedStyle(root.panel).getPropertyValue('--open-duration')) === 0;
        }

        function open() {
            reset();
            state.active = true;
            shift();

            later(() => enabled(root)[0]?.focus());
        }

        function panel(node: MenuNode): Renderable<unknown> {
            let item = node.item;

            return html`
                <div
                    class='nested-menu-panel'
                    role='menu'
                    ${{
                        class: () => {
                            let active = node === root ? state.active : node.state.open;

                            return `${active ? '--active' : ''} ${covered(node) ? '--covered' : ''} ${node.state.settled ? '--settled' : ''}`;
                        },
                        inert: () => node === root && !state.active,
                        onconnect: (element: HTMLElement) => {
                            elements.set(element, node);
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
                        <div class='nested-menu-header'>
                            ${item.icon ? html`<span class='nested-menu-icon'>${item.icon()}</span>` : ''}
                            <span class='nested-menu-title'>
                                <span class='nested-menu-title-regular'>${item.label}</span>
                                <span aria-hidden='true' class='nested-menu-title-bold'>${item.label}</span>
                            </span>
                            <span class='nested-menu-chevron'></span>
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
            later(() => {
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
                class='nested-menu ${animate ? '' : '--instant'}'
                ${attributes}
                ${{
                    class: () => state.active && '--active',
                    onclick: (e: MouseEvent) => {
                        let target = (e.target as HTMLElement).closest<HTMLElement>(
                                '.nested-menu-header, .nested-menu-item, .nested-menu-panel, .nested-menu-trigger'
                            );

                        if (!target) {
                            return;
                        }

                        if (target === trigger) {
                            if (state.active) {
                                close(false);
                            }
                            else {
                                open();
                            }

                            return;
                        }

                        if (target.classList.contains('nested-menu-header')) {
                            pop();
                            return;
                        }

                        let node = elements.get(target);

                        if (!node) {
                            return;
                        }

                        if (target.classList.contains('nested-menu-item')) {
                            if (node.children.length) {
                                drill(node);
                            }
                            else {
                                select(node);
                            }
                        }
                        // A dimmed parent panel's scrim takes the click; return to that level
                        else if (node !== stack[stack.length - 1]) {
                            popTo(node);
                        }
                    },
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

                        let top = stack[stack.length - 1],
                            buttons = enabled(top),
                            index = buttons.indexOf(document.activeElement as HTMLElement),
                            n = buttons.length;

                        switch (e.key) {
                            case 'ArrowDown':
                                buttons[(index + 1) % n]?.focus();
                                break;
                            case 'ArrowUp':
                                buttons[index < 1 ? n - 1 : index - 1]?.focus();
                                break;
                            case 'ArrowLeft':
                            case 'Backspace':
                                pop();
                                break;
                            case 'ArrowRight': {
                                let node = index === -1 ? undefined : elements.get(buttons[index]);

                                if (node) {
                                    drill(node);
                                }
                                break;
                            }
                            case 'End':
                                buttons[n - 1]?.focus();
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
                                buttons[0]?.focus();
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
                    class='nested-menu-trigger'
                    type='button'
                    ${attributes[NESTED_MENU_TRIGGER]}
                    ${{
                        'aria-expanded': () => String(state.active),
                        onconnect: (element: HTMLElement) => {
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
