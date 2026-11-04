import { flush, onCleanup, reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import highlight, { type A as HighlightAttributes } from '~/components/highlight';
import overlay from '~/components/overlay';
import { finished } from '~/shared/animation';
import { flip, viewport } from '~/shared/viewport';
import { morph } from './utilities';


type A = Attributes & {
    [MENU_TRIGGER]?: Attributes & { onclick?: never };
    [MENU_ITEM]?: Attributes;
    [MENU_PANEL]?: Attributes;
    animate?: boolean;
    controller?: (controller: Controller) => void;
    expand?: boolean | 'c' | 'e' | 'en' | 'es' | 'n' | 'ne' | 'nw' | 's' | 'se' | 'sw' | 'w' | 'wn' | 'ws';
    // A layer gliding between rows on hover and keyboard focus, in place of each item's own fill; an object configures
    // the highlight.
    highlight?: boolean | HighlightAttributes;
    items: Item[];
    openOn?: 'click' | 'hover';
    ondocumentclick?: never;
    onkeydown?: never;
    onselect?: (item: Item) => void;
    state?: { active: boolean };
};

type Controller = {
    // Hands focus back only when it was inside the menu.
    close: () => void;
    // A context menu opens at 'position', a viewport point, or by the focused element inside it when omitted; either
    // way focus returns to whatever held it before. A menu opens under its trigger and ignores 'position'.
    open: (position?: Point) => void;
};

type Item = {
    danger?: boolean;
    disabled?: boolean;
    hint?: string;
    hidden?: Attributes['hidden'];
    href?: string;
    // Factory because the icon renders twice for branches: in the row and in the panel header.
    icon?: () => Renderable<unknown>;
    items?: Item[];
    label: Renderable<unknown>;
    onselect?: (item: Item, event: MouseEvent) => void;
    target?: string;
};

type MenuNode = {
    button?: HTMLElement;
    children: MenuNode[];
    item?: Item;
    panel?: HTMLElement;
    parent?: MenuNode;
    state: { open: boolean, render: boolean, settled: boolean };
};

type Point = { x: number, y: number };


const MENU_TRIGGER = Symbol.for('@esportsplus/ui/tooltip.menu.trigger');

const MENU_ITEM = Symbol.for('@esportsplus/ui/tooltip.menu.item');

const MENU_PANEL = Symbol.for('@esportsplus/ui/tooltip.menu.panel');

// Keeps the shifted stack this far from the viewport edges.
const VIEWPORT_MARGIN = 8;


// Names each menu's anchor, which its layer is placed over.
let anchors = 0;


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

        if (child.button && !child.button.hidden && !child.item?.disabled) {
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


function createMenu(context = false) {
    return component(
        ({ animate = true, controller, expand: expansion = false, highlight: highlighted = false, items, onselect, openOn = 'click', state = reactive({ active: false }), ...attributes }: A, content) => {
            let root: MenuNode = { children: [], state: reactive({ open: true, render: true, settled: true }) },
                stack: MenuNode[] = [root],
                hiding = 0,
                host: HTMLElement | undefined,
                layer: HTMLElement | undefined,
                leaving: ReturnType<typeof setTimeout> | undefined,
                name = `--tooltip-menu-${++anchors}`,
                pending: VoidFunction | undefined,
                // The root panel's place, and how far the stack shifts sideways to stay on screen.
                placement = reactive({ shift: 0, style: '' }),
                trigger: HTMLElement | undefined;

            root.children = tree(items, root);

            onCleanup(() => {
                clearTimeout(leaving);
                pending?.();
            });

            controller?.({
                close: () => {
                    if (state.active || pending) {
                        close(!!root.panel?.contains(document.activeElement));
                    }
                },
                open: (position) => {
                    if (!context) {
                        open();
                    }
                    else if (position) {
                        place(position);
                    }
                    else if (host) {
                        let focused = document.activeElement;

                        place(anchor(focused && host.contains(focused) && !root.panel?.contains(focused) ? focused : host));
                    }
                }
            });

            function stay() {
                clearTimeout(leaving);
                leaving = undefined;
            }

            // Below a focused element inside the host; over the host's own corner.
            function anchor(element: Element): Point {
                let bounds = element.getBoundingClientRect();

                return { x: bounds.left, y: element === host ? bounds.top : bounds.bottom };
            }

            function close(focus: boolean) {
                stay();
                pending?.();
                pending = undefined;

                if (expansion && state.active) {
                    // Restore an interpolable clip before shrinking back into the trigger.
                    root.state.settled = false;
                    flush();
                    root.panel?.getBoundingClientRect();
                }

                state.active = false;

                if (!animate) {
                    reset();
                }

                lower();

                if (focus) {
                    trigger?.focus({ preventScroll: true });
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
                    { danger, disabled, hint, icon, items: _items, label, onselect: _onselect, ...itemAttributes } = node.item!,
                    contents = html`
                        ${icon && html`<span class='tooltip-menu-icon'>${icon()}</span>`}
                        <span class='tooltip-menu-label'>${label}</span>
                        ${hint && html`<span class='tooltip-menu-hint'>${hint}</span>`}
                        ${branch && html`<span class='tooltip-menu-chevron'></span>`}
                    `,
                    bindings = {
                        'aria-expanded': branch && (() => String(node.state.open)),
                        'aria-haspopup': branch && 'menu',
                        'aria-disabled': disabled === true && 'true',
                        onclick: (event: MouseEvent) => {
                            if (disabled) {
                                event.preventDefault();
                                return;
                            }

                            if (branch) {
                                event.preventDefault();
                                drill(node);
                            }
                            else {
                                select(node, event);
                            }
                        },
                        onconnect: (element: HTMLElement) => {
                            node.button = element;
                        }
                    };

                return html`
                    <div class='tooltip-menu-entry ${disabled && '--disabled'}' ${{ class: () => node.state.open && 'tooltip-menu-entry--open' }}>
                        ${itemAttributes.href ? html`<a
                            class='tooltip-menu-item ${danger && 'tooltip-menu-item--danger'}'
                            role='menuitem'
                            tabindex='-1'
                            ${attributes[MENU_ITEM]}
                            ${itemAttributes}
                            ${bindings}
                        >${contents}</a>` : html`<button
                            class='tooltip-menu-item ${danger && 'tooltip-menu-item--danger'}'
                            role='menuitem'
                            tabindex='-1'
                            type='button'
                            ${attributes[MENU_ITEM]}
                            ${itemAttributes}
                            ${bindings}
                            ${{ disabled: disabled === true }}
                        >${contents}</button>`}

                        ${() => branch && node.state.render && panel(node)}
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

            // Reduced motion keeps the fades, so '--open-duration' stays set while the reveal clips snap.
            function instant() {
                return !root.panel
                    || parseFloat(getComputedStyle(root.panel).getPropertyValue('--open-duration')) === 0
                    || matchMedia('(prefers-reduced-motion: reduce)').matches;
            }

            // Out of the top layer once the close has played out, unless it reopened meanwhile.
            function lower() {
                let current = ++hiding;

                if (!layer) {
                    return;
                }

                void finished(layer, { subtree: true }).then(() => {
                    if (current === hiding && !state.active && !pending && layer?.matches(':popover-open')) {
                        layer.hidePopover();
                    }
                });
            }

            function open(focus = true) {
                stay();

                if (state.active || pending) {
                    return;
                }

                raise();
                reset();
                root.state.settled = !expansion || instant();
                flush();
                shift();

                function reveal() {
                    pending = undefined;
                    state.active = true;
                    flush();

                    if (focus) {
                        enabled(root)[0]?.button?.focus({ preventScroll: true });
                    }
                }

                if (expansion && host && trigger) {
                    // A context menu's trigger is only where focus returns; it still expands out of its host.
                    pending = morph(host, reveal, root.panel, context ? host : trigger);
                }
                else {
                    reveal();
                }
            }

            function contextmenu(event: MouseEvent) {
                if (!host || !root.panel || root.panel.contains(event.target as Node)) {
                    return;
                }

                event.preventDefault();

                // Synthetic events carry no point.
                if (event.clientX === 0 && event.clientY === 0) {
                    place(anchor(event.target instanceof Element ? event.target : host));
                }
                else {
                    place({ x: event.clientX, y: event.clientY });
                }
            }

            function panel(node: MenuNode): Renderable<unknown> {
                let item = node.item;

                return html`
                    <div
                        class='tooltip-menu-panel ${node === root && expansion && `tooltip-content tooltip-menu-panel--expand tooltip-content--${expansion === true ? 'se' : expansion}`}'
                        role='menu'
                        ${node === root && attributes[MENU_PANEL]}
                        ${{
                            class: [
                                () => (node === root ? state.active : node.state.open) && '--active',
                                () => covered(node) && 'tooltip-menu-panel--covered',
                                () => node.state.settled && 'tooltip-menu-panel--settled'
                            ],
                            inert: () => node === root ? !state.active : !node.state.open,
                            style: node === root && [attributes[MENU_PANEL]?.style, () => `${placement.style} --shift-x: ${placement.shift}px;`].flat(),
                            // A dimmed parent panel's scrim takes the click; return to that level
                            onclick: (event: MouseEvent) => {
                                if (event.target === node.panel && node !== stack[stack.length - 1]) {
                                    popTo(node);
                                }
                            },
                            onconnect: (element: HTMLElement) => {
                                node.panel = element;
                            },
                            onfirstpaint: () => {
                                if (node !== root && stack.includes(node)) {
                                    expand(node);
                                }
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
                                    else if (e.propertyName === 'clip-path' && state.active) {
                                        root.state.settled = true;
                                    }
                                }
                                // The reveal clip would also clip nested panels, so it's dropped once the panel is open.
                                else if (e.propertyName === 'clip-path' && node.state.open) {
                                    node.state.settled = true;
                                }
                            }
                        }}
                    >
                        ${item && html`
                            <div class='tooltip-menu-header' onclick='${pop}'>
                                ${item.icon && html`<span class='tooltip-menu-icon'>${item.icon()}</span>`}
                                <span class='tooltip-menu-title'>
                                    <span class='tooltip-menu-title-regular'>${item.label}</span>
                                    <span aria-hidden='true' class='tooltip-menu-title-bold'>${item.label}</span>
                                </span>
                                <span class='tooltip-menu-chevron tooltip-menu-chevron--down'></span>
                            </div>
                        `}

                        ${node.children.map(entry)}
                        ${highlighted && highlight({ ...(highlighted === true ? {} : highlighted), target: '.tooltip-menu-entry' })}
                    </div>
                `;
            }

            function place({ x, y }: Point) {
                if (!host || !root.panel) {
                    return;
                }

                let focused = document.activeElement;

                // Kept while focus is already in the menu, so moving an open menu still returns to the original holder.
                if (!root.panel.contains(focused)) {
                    trigger = focused instanceof HTMLElement && focused !== document.body ? focused : host;
                }

                raise();
                reset();
                // Measured unshifted, so the bound shift is flushed back to none first.
                placement.shift = 0;
                flush();

                let bounds = host.getBoundingClientRect(),
                    scale = bounds.width / host.offsetWidth || 1,
                    width = root.panel.offsetWidth * scale,
                    height = root.panel.offsetHeight * scale,
                    view = viewport();

                x = flip(x, width, view.width, VIEWPORT_MARGIN);
                y = flip(y, height, view.height, VIEWPORT_MARGIN);
                placement.style = `left: ${(x - bounds.left) / scale - host.clientLeft + host.scrollLeft}px; top: ${(y - bounds.top) / scale - host.clientTop + host.scrollTop}px;`;
                open();
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

            // Into the top layer before anything measures the panels, which lay out only once it shows.
            function raise() {
                hiding++;

                if (layer && !layer.matches(':popover-open')) {
                    layer.showPopover();
                }
            }

            function reset() {
                while (stack.length > 1) {
                    let node = stack.pop()!;

                    node.state.open = false;
                    node.state.settled = false;
                }
            }

            function select(node: MenuNode, event: MouseEvent) {
                let item = node.item!;

                if (item.disabled) {
                    return;
                }

                close(true);
                item.onselect?.(item, event);
                onselect?.(item);
            }

            // Moves the whole stack horizontally to stay inside the viewport; sub-panels inherit the
            // offset because they're positioned within the root panel.
            function shift() {
                let element = root.panel;

                if (!element) {
                    return;
                }

                // The rect is read against the shift the panel is drawn with.
                flush();

                let current = placement.shift,
                    rect = element.getBoundingClientRect(),
                    left = rect.left - current,
                    right = rect.right - current,
                    width = viewport().width,
                    x = 0;

                if (right > width - VIEWPORT_MARGIN) {
                    x = width - VIEWPORT_MARGIN - right;
                }

                if (left + x < VIEWPORT_MARGIN) {
                    x = VIEWPORT_MARGIN - left;
                }

                placement.shift = x;
            }

            function connect(element: HTMLElement) {
                host = element;
                trigger = element;
            }

            function inside(node: Node | null) {
                return !!node && (!!host?.contains(node) || !!layer?.contains(node));
            }

            function keydown(e: KeyboardEvent) {
                if (context && (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey))) {
                    e.preventDefault();

                    if (!root.panel?.contains(e.target as Node)) {
                        place(anchor(e.target as Element));
                    }

                    return;
                }

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

            let hover = !context && openOn === 'hover',
                popup = overlay.popup({
                    canDismiss: () => !!pending,
                    contains: (_, node) => inside(node),
                    ondismiss: (reason) => close(reason === 'escape'),
                    state,
                    target: (element) => element.querySelector<HTMLElement>(':scope > .tooltip-menu-panel') ?? undefined
                }),
                // The trigger and the layer are siblings, so whatever spans the menu listens on both: the panel sits in
                // the layer, not in the trigger, and the trigger names itself as the anchor the layer is placed over.
                spanning = {
                    onfocusout: (event: FocusEvent) => {
                        if ((state.active || pending) && !inside(event.relatedTarget as Node | null)) {
                            close(false);
                        }
                    },
                    onkeydown: keydown,
                    onpointerenter: hover ? ((event: PointerEvent) => {
                        if (event.pointerType !== 'touch') {
                            open(false);
                        }
                    }) : undefined,
                    onpointerleave: hover ? ((event: PointerEvent) => {
                        if (event.pointerType !== 'touch') {
                            leaving = setTimeout(() => close(false), 150);
                        }
                    }) : undefined
                };

            return html`
                ${context ? html`<div
                    class='tooltip-menu-trigger'
                    style='anchor-name: ${name};'
                    ${attributes}
                    ${spanning}
                    ${{ oncontextmenu: contextmenu, onconnect: connect }}
                >${content}</div>` : html`<button
                    aria-haspopup='menu'
                    class='tooltip-menu-trigger'
                    style='anchor-name: ${name};'
                    type='button'
                    ${attributes}
                    ${attributes[MENU_TRIGGER]}
                    ${spanning}
                    ${{
                        'aria-expanded': () => String(state.active),
                        onclick: () => {
                            if (state.active || pending) {
                                close(false);
                            }
                            else {
                                open();
                            }
                        },
                        onconnect: connect
                    }}
                >
                    ${content}
                </button>`}

                <div
                    class='tooltip tooltip--menu tooltip-menu-layer ${context && 'tooltip--context'} ${!animate && 'tooltip--instant'}'
                    popover='manual'
                    style='position-anchor: ${name};'
                    ${{
                        onconnect: (element: HTMLElement) => {
                            layer = element;
                        },
                        onwindowresize: () => state.active && shift()
                    }}
                    ${popup}
                    ${spanning}
                >
                    ${panel(root)}
                </div>
            `;
        },
        { item: MENU_ITEM, panel: MENU_PANEL, trigger: MENU_TRIGGER }
    );
}

const menu = createMenu();

const context = createMenu(true);

export default menu;
export { context };

export type { A, Controller, Item };
