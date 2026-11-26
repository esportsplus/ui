import { computed, effect, reactive, read, ReactiveArray } from '@esportsplus/reactivity';
import { html, type Attributes, type Renderable } from '@esportsplus/template';
import highlight from '~/components/highlight';
import icon from '~/components/icon';
import sortable, { type SortableOptions } from '~/components/sortable';
import type { Item } from '~/components/tooltip/menu';
import scrollbar from '~/modifiers/scrollbar';
import { fixed, type Group, type Layout, type Surface } from './model';
import type state from './model';
import subtree from './subtree';
import close from '@esportsplus/ui/svg/close.svg';
import collapse from '@esportsplus/ui/svg/collapse.svg';
import expand from '@esportsplus/ui/svg/expand.svg';
import plus from '@esportsplus/ui/svg/plus.svg';
import stack from '@esportsplus/ui/svg/stack.svg';


type Catalog = Record<string, Kind>;

type Context = {
    // Opens a surface of the kind, in the group or wherever the layout puts it.
    add: (kind: string, group?: string) => void;
    // The kinds the add menu and launcher offer.
    addable: [string, Kind][];
    // Whether the add menu is open from the group's add button.
    adding: (group: string) => boolean;
    catalog: Catalog;
    // Opens the add menu under the pressed button, adding to the group.
    choose: (e: MouseEvent, group: string) => void;
    // What an empty group or main area shows in place of the launcher.
    empty: ((group?: string) => Renderable<unknown>) | undefined;
    // Whether the press holds the modifier that picks tabs to zoom to: ⌘ on Apple platforms, Ctrl elsewhere.
    held: (e: MouseEvent) => boolean;
    // Tabs show their kind's icon alone, closing from their menu.
    icons: boolean;
    // Whether the group's header clears a sidebar toggle sitting over that corner.
    inset: (group: string, edge: 'left' | 'right') => boolean;
    // Opens the tab context menu for the surface.
    menu: (e: MouseEvent, group: string, surface: string) => void;
    // Whether the add menu has a kind to offer the group, one it doesn't already hold.
    offering: (group: string) => boolean;
    // Picks or unpicks the group for the zoom made when the modifier is let go.
    pick: (group: string) => void;
    picked: (group: string) => boolean;
    // The slot a surface's long-lived host moves into while it shows.
    slot: (surface: string) => Renderable<unknown>;
    // How a group's tab strip sorts, shared by every strip so tabs move between them; 'strip' is the group's tabs.
    sorting: (strip: ReactiveArray<Surface>, group: string) => SortableOptions<Surface>;
    state: ReturnType<typeof state>;
    // Starts a modifier-held press that picks every group it sweeps across, zooming to them when let go.
    sweep: (e: PointerEvent, group: string) => void;
    // Opens the menu of main groups under the pressed button, for a narrow layout showing one at a time.
    switcher: (e: MouseEvent) => void;
    // Whether the main area holds more than one group to switch between.
    switches: () => boolean;
};

type Kind = {
    // Offered by the add menu and the launcher unless false, for kinds that only open from elsewhere.
    addable?: boolean;
    description?: string;
    icon?: string;
    // The tab menu for this kind's surfaces, in place of the layout's own; 'surface' is the id it opened on.
    menu?: (surface: () => string) => Item[];
    // Each open adds another surface of this kind, rather than showing the one already open.
    multiple?: boolean;
    render: (surface: Surface) => Renderable<unknown>;
    // A key the empty group's launcher opens it with.
    shortcut?: string;
    // Spread on the surface's tab after the layout's own bindings, what the tab shows after its title, and its icon in
    // place of the kind's.
    tab?: (surface: Surface) => { attributes?: Attributes; badges?: () => Renderable<unknown>; icon?: () => Renderable<unknown> };
    // Read reactively, so a title that follows a signal retitles the tab.
    title: string | ((surface: Surface) => string);
    // The tab's tooltip, its title unless set.
    tooltip?: (surface: Surface) => string;
};

type Live = () => { group: Group; layout: Layout };

type Side = 'bottom' | 'left' | 'right' | 'top';


// A launcher stays out of the way of anything typed and of open dialogs and menus.
const BLOCKING = 'dialog[open], [popover]:popover-open';

const SIDES: Side[] = ['bottom', 'left', 'right', 'top'];


// The tab's copy that follows the pointer while it is dragged.
function copy(context: Context, surface: Surface) {
    let only = context.icons && !!context.catalog[surface.kind]?.icon;

    return html`
        <div class='button shell-tab --active ${only ? 'shell-tab--icon' : ''}'>
            ${glyph(context, surface)}
            ${!only && html`<span class='shell-tab-label'>${() => title(context, surface)}</span>`}
        </div>
    `;
}

function edge(side: Side) {
    return html`<div aria-hidden='true' class='shell-edge shell-edge--${side}' data-side='${side}'></div>`;
}

function glyph(context: Context, surface: Surface) {
    let kind = context.catalog[surface.kind];

    return kind?.icon && icon({ 'aria-hidden': 'true', class: 'shell-tab-icon' }, kind.icon);
}

function tab(context: Context, live: Live, surface: Surface, attributes: Attributes) {
    let active = () => live().group.active === surface.id,
        { group } = live(),
        kind = context.catalog[surface.kind],
        label = () => title(context, surface),
        only = context.icons && !!kind?.icon,
        own = kind?.tab?.(surface);

    return html`
        <div
            aria-selected='${() => String(active())}'
            class='button shell-tab'
            data-surface='${surface.id}'
            role='tab'
            ${attributes}
            ${{
                class: [
                    () => active() && '--active',
                    only && 'shell-tab--icon'
                ],
                onauxclick: (e: MouseEvent) => {
                    if (e.button === 1) {
                        e.preventDefault();
                        void context.state.close(surface.id);
                    }
                },
                onclick: () => context.state.activate(surface.id),
                oncontextmenu: (e: MouseEvent) => context.menu(e, group.id, surface.id),
                onkeydown: (e: KeyboardEvent) => {
                    if (e.key === 'Delete') {
                        e.preventDefault();
                        void context.state.close(surface.id);
                    }
                    else if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        context.state.activate(surface.id);
                    }
                },
                // A middle press would start autoscroll before the auxclick closes the tab.
                onmousedown: (e: MouseEvent) => {
                    if (e.button === 1) {
                        e.preventDefault();
                    }
                },
                tabindex: () => active() ? 0 : -1,
                title: () => kind?.tooltip?.(surface) ?? label()
            }}
            ${own?.attributes}
        >
            ${own?.icon ?? glyph(context, surface)}
            ${!only && html`
                <span class='shell-tab-label'>${label}</span>
                ${own?.badges}
                <button
                    class='button button--surface-primary shell-tab-close'
                    tabindex='-1'
                    type='button'
                    ${{
                        'aria-label': () => `Close ${label()}`,
                        onclick: (e: MouseEvent) => {
                            e.stopPropagation();
                            void context.state.close(surface.id);
                        },
                        onpointerdown: (e: PointerEvent) => e.stopPropagation()
                    }}
                >
                    ${icon({ 'aria-hidden': 'true' }, close)}
                </button>
            `}
        </div>
    `;
}

function title(context: Context, surface: Surface) {
    let kind = context.catalog[surface.kind];

    if (!kind) {
        return surface.id;
    }

    return typeof kind.title === 'function' ? kind.title(surface) : kind.title;
}


// The default panel: what an empty group or layout shows, a card for every kind in the catalog, each with the key
// that opens it while this group is focused.
const launcher = (context: Context, group?: string) => {
    if (context.empty) {
        return context.empty(group);
    }

    let highlighted = reactive({ index: -1 }),
        kinds = context.addable;

    function current() {
        return group === undefined || context.state.layout.active === group;
    }

    function open(index: number) {
        let entry = kinds[index];

        if (entry) {
            context.add(entry[0], group);
        }
    }

    return html`
        <div
            aria-label='Open a panel'
            class='shell-launcher'
            tabindex='0'
            ${{
                onconnect: (element: HTMLElement) => {
                    let active = document.activeElement;

                    // A layout change can remount the launcher; only claim focus nobody else holds.
                    if (current() && (!active || active === document.body || !active.isConnected)) {
                        element.focus({ preventScroll: true });
                    }
                },
                onkeydown: (e: KeyboardEvent) => {
                    let n = kinds.length;

                    if (!n || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) {
                        return;
                    }

                    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                        e.preventDefault();
                        highlighted.index = (highlighted.index + 1) % n;
                    }
                    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                        e.preventDefault();
                        highlighted.index = highlighted.index < 1 ? n - 1 : highlighted.index - 1;
                    }
                    else if (e.key === 'Enter' && !(e.target as HTMLElement).closest('button')) {
                        e.preventDefault();
                        open(highlighted.index);
                    }
                },
                onwindowkeydown: (e: KeyboardEvent) => {
                    if (e.defaultPrevented || e.isComposing || e.altKey || e.ctrlKey || e.metaKey || !current()) {
                        return;
                    }

                    let target = e.target as HTMLElement;

                    if (document.querySelector(BLOCKING) || target.closest?.('input, select, textarea, [contenteditable]')) {
                        return;
                    }

                    let index = kinds.findIndex(([, kind]) => kind.shortcut?.toLowerCase() === e.key.toLowerCase());

                    if (index !== -1) {
                        e.preventDefault();
                        open(index);
                    }
                }
            }}
        >
            <div class='shell-launcher-content'>
                <div class='shell-launcher-header'>
                    <span class='shell-launcher-title'>Open a panel</span>
                    <span class='shell-launcher-description'>Choose what to show in this group.</span>
                </div>
                <div class='shell-launcher-cards'>
                    ${kinds.map(([, kind], index) => html`
                        <button
                            class='button shell-launcher-card'
                            type='button'
                            ${{
                                class: () => highlighted.index === index && '--active',
                                onclick: () => open(index),
                                onpointerenter: () => {
                                    highlighted.index = index;
                                },
                                onpointerleave: () => {
                                    if (highlighted.index === index) {
                                        highlighted.index = -1;
                                    }
                                }
                            }}
                        >
                            <span class='shell-launcher-card-title'>
                                ${kind.icon && icon({ 'aria-hidden': 'true', class: 'shell-launcher-card-icon' }, kind.icon)}
                                ${typeof kind.title === 'function' ? kind.title({ id: '', kind: kinds[index][0] }) : kind.title}
                            </span>
                            ${kind.description && html`<span class='shell-launcher-card-description'>${kind.description}</span>`}
                            ${kind.shortcut && html`<kbd class='button button--kbd shell-launcher-card-key'>${kind.shortcut}</kbd>`}
                        </button>
                    `)}
                </div>
            </div>
        </div>
    `;
};

// One group: its tabs, the add menu and group actions, then the active surface, with a drop zone on each half while a
// tab is dragged. A static group shows its surface alone, without a header; in a sidebar it takes no drops at all.
const group = (context: Context, live: Live) => {
    // Tabs and placement render once from this snapshot: a change to either is structural and rebuilds the tree,
    // whereas reading the live layout would rebuild every tab when a press focuses the group, mid-press.
    let { group } = live(),
        stationary = fixed(group),
        selected = computed(() => live().group.active),
        strip = new ReactiveArray<Surface>(group.surfaces),
        tabs: HTMLElement | undefined,
        list = sortable(strip, (surface, attributes) => tab(context, live, surface, attributes), {
            ...context.sorting(strip, group.id),
            drag: (surface) => copy(context, surface)
        });

    // Steps back a view, out of a maximized group or a zoom, from any group's header; with nothing to step out of,
    // maximizes this group. A tab that handles its own double click takes it.
    function maximize(e: MouseEvent) {
        if (e.defaultPrevented || (e.target as HTMLElement).closest('.shell-action, .shell-add, .shell-tab-close')) {
            return;
        }

        if (!context.state.back()) {
            context.state.maximize(group.id);
        }
    }

    // Selecting a tab brings it into view; reading only the selection keeps focus changes from scrolling the strip.
    effect(() => {
        read(selected);
        queueMicrotask(() => {
            tabs?.querySelector('.shell-tab.--active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        });
    });

    return html`
        <section
            class='shell-group'
            data-group='${group.id}'
            ${{
                class: [
                    () => context.state.layout.active === group.id && '--active',
                    group.placement && `shell-group--${group.placement}`,
                    stationary && 'shell-group--static',
                    () => context.inset(group.id, 'left') && 'shell-group--inset-left',
                    () => context.inset(group.id, 'right') && 'shell-group--inset-right',
                    () => context.picked(group.id) && 'shell-group--picked'
                ],
                // Listened to directly: the tabs bind presses of their own, which delegation would stop at.
                onconnect: (element: HTMLElement, on) => {
                    // Presses act on the innermost group, so a layout nested inside a group handles its own.
                    let own = (e: Event) => (e.target as Element | null)?.closest?.('.shell-group') === element;

                    // A press on a collapsed group's strip expands it in place of the maximized one. Read here: focusing
                    // first would re-render the strip out from under its own handler.
                    on(element, 'pointerdown', (e) => {
                        if (own(e) && (e.target as Element).closest('.shell-expand')) {
                            context.state.maximize(group.id);
                        }
                        else {
                            context.state.focus(group.id);
                        }
                    }, { direct: true });
                    // Captured, so a picking press and click reach neither the tabs, which would lift, nor the surface.
                    on(element, 'pointerdown', (e) => {
                        if (context.held(e) && own(e)) {
                            e.preventDefault();
                            e.stopPropagation();
                            context.sweep(e, group.id);
                        }
                    }, { capture: true });
                    on(element, 'click', (e) => {
                        if (context.held(e) && own(e)) {
                            e.preventDefault();
                            e.stopPropagation();
                            context.pick(group.id);
                        }
                    }, { capture: true });
                }
            }}
        >
            ${!stationary && html`<div class='shell-header' ${{ ondblclick: maximize }}>
                <div
                    aria-label='Tabs'
                    class='shell-tabs'
                    role='tablist'
                    ${scrollbar({ hidden: true })}
                    ${list.attributes}
                    ${{
                        onconnect: (element: HTMLElement) => {
                            tabs = element;
                        }
                    }}
                >
                    ${highlight({ class: 'shell-tabs-highlight', target: ':is(.shell-tab, .shell-add)' })}
                    ${list.render()}
                    ${context.addable.length > 0 && html`
                        <button
                            aria-haspopup='menu'
                            aria-label='Add panel'
                            class='button shell-add'
                            title='Add panel'
                            type='button'
                            ${{
                                'aria-expanded': () => String(context.adding(group.id)),
                                class: () => context.adding(group.id) && '--active',
                                hidden: () => !context.offering(group.id),
                                onclick: (e: MouseEvent) => context.choose(e, group.id)
                            }}
                        >
                            ${icon({ 'aria-hidden': 'true' }, plus)}
                        </button>
                    `}
                </div>
                ${group.placement === undefined && (() => context.switches() && html`
                    <button
                        aria-haspopup='menu'
                        aria-label='Switch group'
                        class='button shell-action shell-switch'
                        title='Switch group'
                        type='button'
                        ${{ onclick: context.switcher }}
                    >
                        ${icon({ 'aria-hidden': 'true' }, stack)}
                    </button>
                `)}
                ${group.placement === 'bottom' && html`
                    <button
                        class='button shell-action'
                        type='button'
                        ${{
                            'aria-label': () => live().layout.bottom.maximized ? 'Restore panel size' : 'Maximize panel',
                            'aria-pressed': () => String(live().layout.bottom.maximized),
                            onclick: () => context.state.maximize(group.id),
                            title: () => live().layout.bottom.maximized ? 'Restore panel size' : 'Maximize panel'
                        }}
                    >
                        ${() => icon({ 'aria-hidden': 'true' }, live().layout.bottom.maximized ? collapse : expand)}
                    </button>
                `}
                <button
                    aria-label='Close group'
                    class='button shell-action'
                    title='Close group'
                    type='button'
                    ${{ onclick: () => void context.state.closeGroup(group.id) }}
                >
                    ${icon({ 'aria-hidden': 'true' }, close)}
                </button>
            </div>`}
            <div class='shell-body --scrollbar-scope'>
                ${subtree(
                    () => live().group.active ?? '',
                    () => {
                        let { active, surfaces } = live().group;

                        if (surfaces.length === 0) {
                            return launcher(context, group.id);
                        }

                        return active === null ? '' : context.slot(active);
                    }
                )}
                ${() => {
                    let { group: current, layout } = live();

                    return current.placement !== 'bottom' && layout.maximized !== null && layout.maximized !== current.id && html`
                        <button
                            aria-label='Expand this group'
                            class='shell-expand'
                            type='button'
                        ></button>
                    `;
                }}
            </div>
            ${!(stationary && group.placement) && SIDES.map(edge)}
        </section>
    `;
};


export { group, launcher, title };
export type { Catalog, Context, Kind };
