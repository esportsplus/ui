import { flush, onCleanup, reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import highlight, { type A as HighlightAttributes } from '~/components/highlight';
import icon from '~/components/icon';
import overlay from '~/components/overlay';
import scrollbar from '~/modifiers/scrollbar';
import { finished } from '~/shared/animation';
import { expand as cover, margin, place, type Corner, type Side } from '~/shared/placement';
import { viewport } from '~/shared/viewport';
import { morph, px } from './utilities';
import chevron from '@esportsplus/ui/svg/chevron.svg';


type A = Attributes & {
    [MENU_ITEM]?: Attributes;
    [MENU_PANEL]?: Attributes;
    [MENU_TRIGGER]?: Attributes & { onclick?: never };
    // Lines the menu up with the trigger's start or end edge; a context menu opens from the point.
    align?: 'end' | 'start';
    animate?: boolean;
    controller?: (controller: Controller) => void;
    // Grows out of the trigger over it rather than opening beside it, toward the corner with room.
    expand?: boolean;
    // A layer gliding between rows on hover and keyboard focus, in place of each item's own fill; an object configures
    // the highlight.
    highlight?: boolean | HighlightAttributes;
    items: Item[];
    ondocumentclick?: never;
    onkeydown?: never;
    onselect?: (item: Item) => void;
    openOn?: 'click' | 'hover';
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
    hidden?: Attributes['hidden'];
    hint?: string;
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
    // A branch panel's place over its parent: 'top' in the parent's box, how far it is lifted above the row that opened
    // it to stay on screen, and the height it scrolls past.
    state: { height: number | undefined, lift: number, open: boolean, render: boolean, settled: boolean, top: number };
};

type Point = { x: number, y: number };


const MENU_ITEM = Symbol.for('@esportsplus/ui/tooltip.menu.item');

const MENU_PANEL = Symbol.for('@esportsplus/ui/tooltip.menu.panel');

const MENU_TRIGGER = Symbol.for('@esportsplus/ui/tooltip.menu.trigger');


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

function createMenu(context = false) {
    return component(
        ({ align = 'start', animate = true, controller, expand: expansion = false, highlight: highlighted = false, items, onselect, openOn = 'click', state = reactive({ active: false }), ...attributes }: A, content) => {
            let hiding = 0,
                host: HTMLElement | undefined,
                // Where the root panel last opened, kept while it still fits there.
                last: { corner?: Corner, side?: Side } = {},
                layer: HTMLElement | undefined,
                leaving: ReturnType<typeof setTimeout> | undefined,
                name = `--tooltip-menu-${++anchors}`,
                // Where a context menu was asked to open, as a viewport point.
                origin: Point | undefined,
                pending: VoidFunction | undefined,
                // The root panel's place over the layer, the height it scrolls past, and the way an expanding one grows
                // across, 1 rightward and -1 leftward.
                placement = reactive({
                    direction: 1,
                    height: undefined as number | undefined,
                    x: undefined as number | undefined,
                    y: undefined as number | undefined
                }),
                root: MenuNode = { children: [], state: reactive({ height: undefined as number | undefined, lift: 0, open: true, render: true, settled: true, top: 0 }) },
                stack: MenuNode[] = [root],
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
                        at(position);
                    }
                    else if (host) {
                        let focused = document.activeElement;

                        at(anchor(focused && host.contains(focused) && !root.panel?.contains(focused) ? focused : host));
                    }
                }
            });

            // Below a focused element inside the host; over the host's own corner.
            function anchor(element: Element): Point {
                let bounds = element.getBoundingClientRect();

                return { x: bounds.left, y: element === host ? bounds.top : bounds.bottom };
            }

            // Places the root panel beside its trigger, or a context menu's point, on the side it last opened on while it
            // still fits there, else where there's room, capped to scroll past the room it has; an expanding panel
            // covers its trigger and grows out of it toward the corner it last grew toward, or one with room. Measured at its
            // natural size first; nothing paints in between.
            function arrange() {
                let element = root.panel;

                if (!element || !host || !layer) {
                    return;
                }

                placement.height = undefined;
                placement.x = undefined;
                placement.y = undefined;
                flush();

                let bounds = host.getBoundingClientRect(),
                    box = layer.getBoundingClientRect(),
                    height = element.offsetHeight,
                    space = margin(element),
                    width = element.offsetWidth;

                if (expansion) {
                    let grown = cover({ anchor: bounds, corner: last.corner, height, margin: space, width });

                    last.corner = grown.corner;
                    placement.direction = grown.corner[1] === 'e' ? 1 : -1;
                    placement.height = grown.maxHeight;
                    placement.x = grown.x - box.left;
                    placement.y = grown.y - box.top;
                    return;
                }

                let { maxHeight, side, x, y } = place({
                        align,
                        anchor: context && origin ? new DOMRect(origin.x, origin.y, 0, 0) : bounds,
                        gap: context ? 0 : parseFloat(getComputedStyle(element).getPropertyValue('--offset')) || 0,
                        height,
                        margin: space,
                        side: last.side,
                        width
                    });

                last.side = side;
                placement.height = maxHeight;
                placement.x = x - box.left;
                placement.y = y - box.top;
            }

            // Opens a context menu at 'point', or moves it there while open.
            function at(point: Point) {
                if (!host || !root.panel) {
                    return;
                }

                let focused = document.activeElement;

                // Kept while focus is already in the menu, so moving an open menu still returns to the original holder.
                if (!root.panel.contains(focused)) {
                    trigger = focused instanceof HTMLElement && focused !== document.body ? focused : host;
                }

                origin = point;

                if (state.active || pending) {
                    reset();
                    arrange();
                }

                open();
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

            function connect(element: HTMLElement) {
                host = element;
                trigger = element;
            }

            function contextmenu(event: MouseEvent) {
                if (!host || !root.panel || root.panel.contains(event.target as Node)) {
                    return;
                }

                event.preventDefault();

                // Synthetic events carry no point.
                if (event.clientX === 0 && event.clientY === 0) {
                    at(anchor(event.target instanceof Element ? event.target : host));
                }
                else {
                    at({ x: event.clientX, y: event.clientY });
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
                    { danger, disabled, hint, icon: glyph, items: _items, label, onselect: _onselect, ...itemAttributes } = node.item!,
                    contents = html`
                        ${glyph && html`<span class='tooltip-menu-icon'>${glyph()}</span>`}
                        <span class='tooltip-menu-label'>${label}</span>
                        ${hint && html`<span class='tooltip-menu-hint'>${hint}</span>`}
                        ${branch && icon({ 'aria-hidden': 'true', class: 'tooltip-menu-chevron icon--rotate' }, chevron)}
                    `,
                    bindings = {
                        'aria-disabled': disabled === true && 'true',
                        'aria-expanded': branch && (() => String(node.state.open)),
                        'aria-haspopup': branch && 'menu',
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
                    <div class='tooltip-menu-entry ${disabled && '--disabled'}'>
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
                    </div>
                `;
            }

            function expand(node: MenuNode) {
                nest(node);

                // No transitionend will settle it: either still open from a pending close, or motion is off
                node.state.settled = node.state.open || instant();
                node.state.open = true;
                flush();
                enabled(node)[0]?.button?.focus();
            }

            function inside(node: Node | null) {
                return !!node && (!!host?.contains(node) || !!layer?.contains(node));
            }

            // Reduced motion keeps the fades, so '--open-duration' stays set while the reveal clips snap.
            function instant() {
                return !root.panel
                    || parseFloat(getComputedStyle(root.panel).getPropertyValue('--open-duration')) === 0
                    || matchMedia('(prefers-reduced-motion: reduce)').matches;
            }

            function keydown(e: KeyboardEvent) {
                if (context && (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey))) {
                    e.preventDefault();

                    if (!root.panel?.contains(e.target as Node)) {
                        at(anchor(e.target as Element));
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

            // Lays a branch's panel over its parent with its header on the row that opened it, lifted only as far as it
            // must be to stay on screen and capped to scroll past what is left.
            function nest(node: MenuNode) {
                let button = node.button,
                    element = node.panel,
                    parent = node.parent?.panel;

                if (!button || !element || !parent) {
                    return;
                }

                node.state.height = undefined;
                node.state.lift = 0;
                flush();

                let header = element.querySelector<HTMLElement>(':scope > .tooltip-menu-header'),
                    row = button.getBoundingClientRect(),
                    space = margin(element),
                    bottom = viewport().height - space,
                    top = row.top - (header?.offsetTop ?? 0),
                    lift = Math.max(0, Math.min(top + element.offsetHeight - bottom, top - space));

                node.state.height = bottom - top + lift;
                node.state.lift = lift;
                node.state.top = top - lift - parent.getBoundingClientRect().top - parent.clientTop;
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
                arrange();

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

            // Items scroll inside the panel; a branch's panel sits over it, outside the scroller, so the scroller never
            // clips it.
            function panel(node: MenuNode): Renderable<unknown> {
                let item = node.item;

                return html`
                    <div
                        class='tooltip-menu-panel ${node === root && expansion && 'tooltip-menu-panel--expand'}'
                        role='menu'
                        ${node === root && attributes[MENU_PANEL]}
                        ${{
                            class: [
                                () => (node === root ? state.active : node.state.open) && '--active',
                                () => covered(node) && 'tooltip-menu-panel--covered',
                                () => node.state.settled && 'tooltip-menu-panel--settled'
                            ],
                            inert: () => node === root ? !state.active : !node.state.open,
                            style: node === root
                                ? [attributes[MENU_PANEL]?.style, () => ({
                                    '--expand-direction': expansion ? placement.direction : undefined,
                                    '--max-height': px(placement.height),
                                    left: px(placement.x),
                                    top: px(placement.y)
                                })].flat()
                                : () => ({
                                    '--lift': `${node.state.lift}px`,
                                    '--max-height': px(node.state.height),
                                    top: `${node.state.top}px`
                                }),
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
                            // The scrim and a branch's header aren't focusable, so pressing them would hand focus to the
                            // page, and losing focus closes the menu before their click can go back a level.
                            onmousedown: (event: MouseEvent) => {
                                let target = event.target as Element;

                                if (target === node.panel || target.closest('.tooltip-menu-header')) {
                                    event.preventDefault();
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
                                ${icon({ 'aria-hidden': 'true', class: 'tooltip-menu-chevron tooltip-menu-chevron--down icon--rotate' }, chevron)}
                            </div>
                        `}

                        <div class='tooltip-menu-scroller' ${scrollbar({ fade: true })}>
                            ${node.children.map(entry)}
                            ${highlighted && highlight({ ...(highlighted === true ? {} : highlighted), target: '.tooltip-menu-entry' })}
                        </div>

                        ${node.children.map((child) => child.children.length > 0 && html`${() => child.state.render && panel(child)}`)}
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

            function stay() {
                clearTimeout(leaving);
                leaving = undefined;
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
                        onwindowresize: () => state.active && arrange()
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
            state: reactive({ height: undefined as number | undefined, lift: 0, open: false, render: false, settled: false, top: 0 })
        };

        node.children = tree(items[i].items ?? [], node);
        nodes.push(node);
    }

    return nodes;
}


const context = createMenu(true);

const menu = createMenu();

export default menu;
export { context };

export type { A, Controller, Item };
