import { computed, effect, read, reactive, write, type Signal } from '@esportsplus/reactivity';
import { html, type Renderable } from '@esportsplus/template';
import highlight from '~/components/highlight';
import icon from '~/components/icon';
import scrollbar from '~/modifiers/scrollbar';
import type manager from './dnd';
import type { Group, Layout, Surface } from './model';
import type state from './model';
import { resize } from './resize';
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
    catalog: Catalog;
    // Opens the add menu under the pressed button, adding to the group.
    choose: (e: MouseEvent, group: string) => void;
    heights: Signal<Record<string, number>>;
    manager: ReturnType<typeof manager>;
    // Opens the tab context menu for the surface.
    menu: (e: MouseEvent, group: string, surface: string) => void;
    // The slot a surface's long-lived host moves into while it shows.
    slot: (surface: string) => Renderable<unknown>;
    state: ReturnType<typeof state>;
};

type Kind = {
    description?: string;
    icon?: string;
    // Each open adds another surface of this kind, rather than showing the one already open.
    multiple?: boolean;
    render: (surface: Surface) => Renderable<unknown>;
    // A key the empty group's launcher opens it with.
    shortcut?: string;
    title: string | ((surface: Surface) => string);
};

type Live = () => { group: Group; layout: Layout };

type Side = 'bottom' | 'left' | 'right' | 'top';


// A launcher stays out of the way of anything typed and of open dialogs and menus.
const BLOCKING = 'dialog[open], [popover]:popover-open';

const SIDES: Side[] = ['bottom', 'left', 'right', 'top'];


function edge(context: Context, live: Live, side: Side) {
    let { group } = live();

    return html`
        <div
            aria-hidden='true'
            class='panels-edge panels-edge--${side}'
            ${context.manager.droppable(() => ({
                data: { group: group.id, kind: 'edge', scrollable: live().group.scrollable === true, side },
                id: `edge:${group.id}:${side}`
            }))}
        ></div>
    `;
}

function glyph(context: Context, surface: Surface) {
    let kind = context.catalog[surface.kind];

    return kind?.icon && icon({ 'aria-hidden': 'true', class: 'panels-tab-icon' }, kind.icon);
}

// A surface section in a scrolling group, holding its own height so a resize outlives the list rendering again.
function section(context: Context, surface: Surface, last: boolean) {
    let element: HTMLElement | undefined;

    return html`
        <div
            class='panels-section'
            data-surface='${surface.id}'
            ${{
                onconnect: (node: HTMLElement) => {
                    element = node;
                },
                style: () => {
                    let height = read(context.heights)[surface.id];

                    return height === undefined ? '' : `height: ${height}px;`;
                }
            }}
        >
            ${context.slot(surface.id)}
        </div>
        ${!last && html`
            <div
                aria-label='Resize stacked panel'
                aria-orientation='horizontal'
                class='panels-handle panels-handle--y'
                role='separator'
                ${resize('y', () => {
                    if (!element) {
                        return null;
                    }

                    let floor = parseFloat(getComputedStyle(element).minHeight) || 0,
                        height = element.getBoundingClientRect().height;

                    return (delta) => {
                        write(context.heights, { ...read(context.heights), [surface.id]: Math.max(floor, height + delta) });
                    };
                })}
            ></div>
        `}
    `;
}

function tab(context: Context, live: Live, surface: Surface) {
    let active = () => live().group.active === surface.id,
        { group } = live(),
        label = title(context, surface);

    return html`
        <div
            aria-selected='${() => String(active())}'
            class='button panels-tab'
            data-surface='${surface.id}'
            role='tab'
            title='${label}'
            ${{
                class: () => [
                    active() && '--active',
                    read(context.manager.active)?.id === surface.id && 'panels-tab--dragging'
                ].filter(Boolean).join(' '),
                onauxclick: (e: MouseEvent) => {
                    if (e.button === 1) {
                        e.preventDefault();
                        context.state.close(surface.id);
                    }
                },
                onclick: () => context.state.activate(surface.id),
                oncontextmenu: (e: MouseEvent) => context.menu(e, group.id, surface.id),
                onkeydown: (e: KeyboardEvent) => {
                    if (e.key === 'Delete') {
                        e.preventDefault();
                        context.state.close(surface.id);
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
                onpointerdown: function(this: HTMLElement, e: PointerEvent) {
                    context.manager.drag({ data: { group: group.id, surface: surface.id }, id: surface.id, node: this }, e);
                },
                tabindex: () => active() ? 0 : -1
            }}
        >
            ${glyph(context, surface)}
            <span class='panels-tab-label'>${label}</span>
            <button
                aria-label='Close ${label}'
                class='button panels-tab-close'
                tabindex='-1'
                type='button'
                ${{
                    onclick: (e: MouseEvent) => {
                        e.stopPropagation();
                        context.state.close(surface.id);
                    },
                    onpointerdown: (e: PointerEvent) => e.stopPropagation()
                }}
            >
                ${icon({ 'aria-hidden': 'true' }, close)}
            </button>
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
    let highlighted = reactive({ index: -1 }),
        kinds = Object.entries(context.catalog);

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
            class='panels-launcher'
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
            <div class='panels-launcher-content'>
                <div class='panels-launcher-header'>
                    <span class='panels-launcher-title'>Open a panel</span>
                    <span class='panels-launcher-description'>Choose what to show in this group.</span>
                </div>
                <div class='panels-launcher-cards'>
                    ${kinds.map(([, kind], index) => html`
                        <button
                            class='button panels-launcher-card'
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
                            <span class='panels-launcher-card-title'>
                                ${kind.icon && icon({ 'aria-hidden': 'true', class: 'panels-launcher-card-icon' }, kind.icon)}
                                ${typeof kind.title === 'function' ? kind.title({ id: '', kind: kinds[index][0] }) : kind.title}
                            </span>
                            ${kind.description && html`<span class='panels-launcher-card-description'>${kind.description}</span>`}
                            ${kind.shortcut && html`<kbd class='button button--kbd panels-launcher-card-key'>${kind.shortcut}</kbd>`}
                        </button>
                    `)}
                </div>
            </div>
        </div>
    `;
};

// One group: its tabs, the add menu and group actions, then the active surface or a scrolling stack of all of them,
// with a drop zone on each half while a tab is dragged.
const group = (context: Context, live: Live) => {
    // Tabs and placement render once from this snapshot: a change to either is structural and rebuilds the tree,
    // whereas reading the live layout would rebuild every tab when a press focuses the group, mid-press.
    let { group } = live(),
        drop = context.manager.droppable(() => ({
            data: { group: group.id, kind: 'group', strip: () => header?.getBoundingClientRect().bottom ?? 0 },
            id: `group:${group.id}`
        })),
        header: HTMLElement | undefined,
        listening: AbortController | undefined,
        selected = computed(() => live().group.active),
        tabs: HTMLElement | undefined;

    function maximize(e: MouseEvent) {
        if (!(e.target as HTMLElement).closest('.panels-action, .panels-add, .panels-tab-close')) {
            context.state.maximize(group.id);
        }
    }

    // Selecting a tab brings it into view; reading only the selection keeps focus changes from scrolling the strip.
    effect(() => {
        read(selected);
        queueMicrotask(() => {
            tabs?.querySelector('.panels-tab.--active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        });
    });

    return html`
        <section
            class='panels-group'
            data-group='${group.id}'
            ${{
                class: () => [
                    drop.class(),
                    context.state.layout.active === group.id && '--active',
                    live().group.placement === 'bottom' && 'panels-group--bottom'
                ].filter(Boolean).join(' '),
                // Listened to directly: the tabs bind presses of their own, which delegation would stop at.
                onconnect: (element: HTMLElement) => {
                    drop.onconnect(element);
                    listening?.abort();
                    listening = new AbortController();
                    element.addEventListener('pointerdown', () => context.state.focus(group.id), { signal: listening.signal });
                },
                ondisconnect: () => {
                    drop.ondisconnect();
                    listening?.abort();
                }
            }}
        >
            <div
                class='panels-header'
                ${{
                    onconnect: (element: HTMLElement) => {
                        header = element;
                    },
                    ondblclick: maximize
                }}
            >
                <div
                    aria-label='Panels'
                    class='panels-tabs'
                    role='tablist'
                    ${scrollbar({ hidden: true })}
                    ${{
                        onconnect: (element: HTMLElement) => {
                            tabs = element;
                        }
                    }}
                >
                    ${highlight({ class: 'panels-tabs-highlight', target: '.panels-tab' })}
                    ${group.surfaces.map((surface) => tab(context, live, surface))}
                    <button
                        aria-haspopup='menu'
                        aria-label='Add panel'
                        class='button panels-add'
                        title='Add panel'
                        type='button'
                        ${{ onclick: (e: MouseEvent) => context.choose(e, group.id) }}
                    >
                        ${icon({ 'aria-hidden': 'true' }, plus)}
                    </button>
                </div>
                ${group.placement === 'bottom' && html`
                    <button
                        class='button panels-action'
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
                    class='button panels-action'
                    type='button'
                    ${{
                        'aria-label': () => live().group.scrollable ? 'Stop stacking panels' : 'Stack panels',
                        'aria-pressed': () => String(live().group.scrollable === true),
                        class: () => live().group.scrollable && '--active',
                        onclick: () => context.state.scrollable(group.id),
                        title: () => live().group.scrollable ? 'Stop stacking panels' : 'Stack panels'
                    }}
                >
                    ${icon({ 'aria-hidden': 'true' }, stack)}
                </button>
                <button
                    aria-label='Close group'
                    class='button panels-action'
                    title='Close group'
                    type='button'
                    ${{ onclick: () => context.state.closeGroup(group.id) }}
                >
                    ${icon({ 'aria-hidden': 'true' }, close)}
                </button>
            </div>
            <div
                class='panels-body'
                ${{ class: () => live().group.scrollable && 'panels-body--scrollable' }}
            >
                ${subtree(
                    () => {
                        let { active, scrollable, surfaces } = live().group;

                        return scrollable ? `stack:${surfaces.map((surface) => surface.id).join(',')}` : `active:${active ?? ''}`;
                    },
                    () => {
                        let { active, scrollable, surfaces } = live().group;

                        if (surfaces.length === 0) {
                            return launcher(context, group.id);
                        }

                        if (scrollable) {
                            return surfaces.map((surface, index) => section(context, surface, index === surfaces.length - 1));
                        }

                        return active === null ? '' : context.slot(active);
                    }
                )}
                ${() => {
                    let { group: current, layout } = live();

                    return current.placement !== 'bottom' && layout.maximized !== null && layout.maximized !== current.id && html`
                        <button
                            aria-label='Expand this group'
                            class='panels-expand'
                            type='button'
                            ${{ onpointerdown: () => context.state.focus(group.id) }}
                        ></button>
                    `;
                }}
            </div>
            ${SIDES.map((side) => edge(context, live, side))}
        </section>
    `;
};


export { group, launcher, title };
export type { Catalog, Context, Kind };
