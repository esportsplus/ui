import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import '~/components/tooltip';
import './scss/index.scss';


type A = Attributes & {
    [COLLAPSIBLE_SIDEBAR_ITEM]?: Attributes;
    [COLLAPSIBLE_SIDEBAR_NAV]?: Attributes;
    [COLLAPSIBLE_SIDEBAR_TOGGLE]?: Attributes;
    expanded?: boolean;
    items: Item[];
    label?: string;
    selected?: string;
    state?: State;
};

type D = Attributes & Pick<A, typeof COLLAPSIBLE_SIDEBAR_ITEM | typeof COLLAPSIBLE_SIDEBAR_NAV | typeof COLLAPSIBLE_SIDEBAR_TOGGLE>;

type Item = {
    icon: Renderable<unknown>;
    id: string;
    label: string;
};

type State = {
    expanded: boolean;
    selected: string;
};


const COLLAPSIBLE_SIDEBAR_ITEM = Symbol.for('@esportsplus/ui/collapsible-sidebar.item');

const COLLAPSIBLE_SIDEBAR_NAV = Symbol.for('@esportsplus/ui/collapsible-sidebar.nav');

const COLLAPSIBLE_SIDEBAR_TOGGLE = Symbol.for('@esportsplus/ui/collapsible-sidebar.toggle');

// Long enough that sweeping the pointer across the rail doesn't flash tips, short enough to feel like the rail is answering.
const TOOLTIP_DELAY = 400;


let uid = 0;


export default Object.assign(component<A>(
    function(
        this: { attributes?: D } | void,
        {
            expanded = true,
            items,
            label = 'Main',
            selected,
            state = reactive({ expanded, selected: selected ?? items[0]?.id ?? '' }),
            ...attributes
        }: A,
        content
    ) {
        let id = `collapsible-sidebar-${++uid}`,
            timer: ReturnType<typeof setTimeout> | undefined,
            tip = reactive({ active: false, index: 0 });

        function hide() {
            clearTimeout(timer);
            tip.active = false;
        }

        // The first tip waits; once one is open, moving to a neighbour swaps it instantly.
        function show(index: number, immediate: boolean) {
            if (state.expanded) {
                return;
            }

            clearTimeout(timer);

            if (immediate || tip.active) {
                tip.active = true;
                tip.index = index;
                return;
            }

            timer = setTimeout(() => {
                tip.active = true;
                tip.index = index;
            }, TOOLTIP_DELAY);
        }

        return html`
            <div
                class='collapsible-sidebar'
                ${this?.attributes}
                ${attributes}
                ${{
                    class: () => state.expanded && '--active',
                    ondisconnect: () => clearTimeout(timer)
                }}
            >
                <nav
                    class='collapsible-sidebar-nav'
                    ${this?.attributes?.[COLLAPSIBLE_SIDEBAR_NAV]}
                    ${attributes[COLLAPSIBLE_SIDEBAR_NAV]}
                    ${{
                        'aria-label': label,
                        id,
                        onpointerleave: hide
                    }}
                >
                    <span
                        aria-hidden='true'
                        class='collapsible-sidebar-highlight'
                        ${{
                            hidden: () => !items.some((item) => item.id === state.selected),
                            style: () => `--index: ${items.findIndex((item) => item.id === state.selected)}`
                        }}
                    ></span>
                    <ul class='collapsible-sidebar-list'>
                        ${items.map((item, index) => html`
                            <li>
                                <button
                                    class='collapsible-sidebar-item'
                                    type='button'
                                    ${this?.attributes?.[COLLAPSIBLE_SIDEBAR_ITEM]}
                                    ${attributes[COLLAPSIBLE_SIDEBAR_ITEM]}
                                    ${{
                                        'aria-current': () => state.selected === item.id && 'page',
                                        class: () => state.selected === item.id && '--active',
                                        onblur: hide,
                                        onclick: () => {
                                            state.selected = item.id;
                                        },
                                        onfocus: (e: FocusEvent) => {
                                            if ((e.currentTarget as HTMLElement).matches(':focus-visible')) {
                                                show(index, true);
                                            }
                                        },
                                        onpointerenter: (e: PointerEvent) => {
                                            if (e.pointerType !== 'touch') {
                                                show(index, false);
                                            }
                                        }
                                    }}
                                >
                                    <span class='collapsible-sidebar-icon'>${item.icon}</span>
                                    <span class='collapsible-sidebar-label'>${item.label}</span>
                                </button>
                            </li>
                        `)}
                    </ul>
                </nav>

                <div
                    aria-hidden='true'
                    class='collapsible-sidebar-tip tooltip'
                    ${{
                        class: () => tip.active && !state.expanded && '--active',
                        style: () => `--index: ${tip.index}`
                    }}
                >
                    <span class='collapsible-sidebar-tip-message tooltip-message tooltip-message--e'>
                        ${() => items[tip.index]?.label ?? ''}
                    </span>
                </div>

                <div class='collapsible-sidebar-main'>
                    <div class='collapsible-sidebar-header'>
                        <button
                            aria-controls='${id}'
                            class='collapsible-sidebar-toggle'
                            type='button'
                            ${this?.attributes?.[COLLAPSIBLE_SIDEBAR_TOGGLE]}
                            ${attributes[COLLAPSIBLE_SIDEBAR_TOGGLE]}
                            ${{
                                'aria-expanded': () => String(state.expanded),
                                'aria-label': () => state.expanded ? 'Collapse sidebar' : 'Expand sidebar',
                                onclick: () => {
                                    hide();
                                    state.expanded = !state.expanded;
                                }
                            }}
                        >
                            <svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 16 16'>
                                <rect height='10.5' rx='2' width='11.5' x='2.25' y='2.75' />
                                <path d='M6.25 2.75v10.5' />
                            </svg>
                        </button>
                    </div>
                    ${content}
                </div>
            </div>
        `;
    }
), { item: COLLAPSIBLE_SIDEBAR_ITEM, nav: COLLAPSIBLE_SIDEBAR_NAV, toggle: COLLAPSIBLE_SIDEBAR_TOGGLE } as const);

export type { Item, State };
