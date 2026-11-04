import { effect, flush, onCleanup, reactive, ReactiveArray, signal, write } from '@esportsplus/reactivity';
import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import icon from '~/components/icon';
import input from '~/components/input';
import overlay from '~/components/overlay';
import sortable, { type SortableOptions } from '~/components/sortable';
import tooltip from '~/components/tooltip';
import { content as surface } from '~/components/tooltip/utilities';
import scrollbar from '~/modifiers/scrollbar';
import { observer } from '~/shared/resize';
import down from '@esportsplus/ui/svg/arrow-down.svg';
import left from '@esportsplus/ui/svg/arrow-left.svg';
import right from '@esportsplus/ui/svg/arrow-right.svg';
import up from '@esportsplus/ui/svg/arrow-up.svg';
import chevronDown from '@esportsplus/ui/svg/chevron-down.svg';
import chevronLeft from '@esportsplus/ui/svg/chevron-left.svg';
import chevronRight from '@esportsplus/ui/svg/chevron-right.svg';
import chevronUp from '@esportsplus/ui/svg/chevron-up.svg';
import enter from '@esportsplus/ui/svg/enter.svg';
import grid from '@esportsplus/ui/svg/grid.svg';
import magnifier from '@esportsplus/ui/svg/search.svg';
import '~/components/button/scss/index.scss';
import '~/components/card/scss/index.scss';
import './scss/index.scss';


type A = Attributes & {
    [DOCK_BUTTON]?: Attributes;
    [DOCK_LAUNCHER]?: Attributes;
    // The apps kept out of the dock, in a launcher that opens from its last button; without them there is no
    // launcher. Dragging between the dock and the launcher moves apps in and out of 'items'.
    apps?: Item[] | ReactiveArray<Item>;
    // Arrows either end page through the icons once they outgrow the shelf, which otherwise grows to fit them.
    arrows?: boolean;
    // The side the launcher and the labels open toward, and the way the icons swell; east and west stand the dock
    // upright, for a screen's side edge.
    direction?: Direction;
    items: Item[] | ReactiveArray<Item>;
    label?: string;
    onlaunch?: (label: string) => void;
    onsort?: SortableOptions<Item>['onsort'];
    // Whether the launcher is open.
    state?: { active: boolean };
};

type Direction = 'e' | 'n' | 's' | 'w';

type Item = {
    label: string;
    // Shapes this app's button whatever the dock's own shape: 'plain' drops its surface, leaving the icon alone.
    modifier?: 'plain' | 'square' | 'squircle';
    running?: boolean;
    state?: { running: boolean };
} & (
    // A sprite id, or a function rendering it: an app shows in the dock, its launcher and the copy being dragged at
    // once, and rendered content can only stand in one place.
    { icon: string | (() => Renderable<unknown>), thumbnail?: never } |
    // An image url, covering the whole button.
    { icon?: never, thumbnail: string }
);

type Slot = HTMLElement & { [LABEL]: string };


const ARROWS: Record<'horizontal' | 'vertical', [previous: string, next: string]> = {
    horizontal: [chevronLeft, chevronRight],
    vertical: [chevronUp, chevronDown]
};

const DOCK_BUTTON = Symbol.for('@esportsplus/ui/dock.button');

const DOCK_LAUNCHER = Symbol.for('@esportsplus/ui/dock.launcher');

const LABEL = Symbol();

// The first label waits so a cursor passing through doesn't flash one; neighbours then open at once.
const TOOLTIP_DELAY = 300;


let uid = 0;


// The copy following the pointer: the dock's slot with a stand-in for the button, which keeps no controls.
function copy(item: Item) {
    return html`
        <div class='dock-item'>
            <span class='card dock-button' ${face(item)}>${glyph(item)}</span>
        </div>
    `;
}

function face(item: Item): Attributes {
    return {
        class: [item.modifier && `dock-button--${item.modifier}`, item.thumbnail !== undefined && 'dock-button--thumbnail'],
        style: item.thumbnail !== undefined ? `--thumbnail: url(${JSON.stringify(thumbnail(item.thumbnail))})` : ''
    };
}

function glyph(item: Item) {
    if (item.icon === undefined) {
        return '';
    }

    return typeof item.icon === 'string' ? sprite(item.icon) : item.icon();
}

function hint(keys: Renderable<unknown>[], label: string) {
    return html`
        <span class='dock-launcher-hint'>
            <span aria-hidden='true' class='dock-launcher-keys'>
                ${keys.map((key) => html`<kbd class='button button--kbd'>${key}</kbd>`)}
            </span>
            ${label}
        </span>
    `;
}

// Clicks anywhere in the launcher keep focus in its search, so typing and the arrow keys carry on after a stray click.
function keep(e: MouseEvent) {
    if (!(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
    }
}

function name(trigger: HTMLElement) {
    return (trigger as Slot)[LABEL];
}

function sprite(href: string, name = '') {
    return icon({ 'aria-hidden': 'true', class: name }, href);
}

// Absolute, since a 'url()' substituted from a custom property resolves against the stylesheet that reads it.
function thumbnail(src: string) {
    return new URL(src, document.baseURI).href;
}


const dock = ({
    apps,
    arrows = false,
    direction = 'n',
    items,
    label = 'Dock',
    onlaunch,
    onsort,
    state = reactive({ active: false }),
    ...attributes
}: A) => {
    let cells: HTMLElement | undefined,
        docked = items instanceof ReactiveArray ? items : new ReactiveArray(items),
        drawer = apps && (apps instanceof ReactiveArray ? apps : new ReactiveArray(apps)),
        field: HTMLInputElement | undefined,
        group = `dock-${++uid}`,
        // The launcher's search, and the app the keys rest on among those it shows: none (-1) until an arrow picks one.
        launch = reactive({ index: -1, query: '' }),
        // Kept per app rather than per render, since moving between lists renders it afresh.
        launching = new WeakMap<Item, { launching: boolean }>(),
        // Shows the icons off the page for as long as 'measure()' reads them.
        measuring = reactive({ active: false }),
        popup = drawer && overlay.popup({ state, target: surface }),
        running = new WeakMap<Item, { running: boolean }>(),
        // The page of icons the shelf shows: the first, and how many fit (none while they all do). 'order' moves with
        // every sort, which can reorder the dock without changing its length.
        scroll = reactive({ count: 0, first: 0, order: 0 }),
        shelf: HTMLElement | undefined,
        track: HTMLElement | undefined,
        vertical = direction === 'e' || direction === 'w',
        viewport: HTMLElement | undefined;

    // The dock's own buttons: one per app, and the last opening and closing the launcher.
    function all() {
        return html`
            <div class='dock-item' ${{ onconnect: (element: Slot) => { element[LABEL] = 'All apps'; } }}>
                <button
                    aria-controls='${group}-launcher'
                    aria-haspopup='dialog'
                    aria-label='All apps'
                    class='button dock-button'
                    type='button'
                    ${{
                        'aria-expanded': () => state.active ? 'true' : 'false',
                        onclick: () => {
                            state.active = !state.active;
                        }
                    }}
                >
                    ${sprite(grid)}
                </button>
            </div>
        `;
    }

    function arrow(step: -1 | 1) {
        return html`
            <button
                aria-label='${step < 0 ? 'Previous apps' : 'Next apps'}'
                class='dock-arrow'
                type='button'
                ${{
                    disabled: () => step < 0 ? scroll.first <= 0 : scroll.first + scroll.count >= docked.$length,
                    onclick: () => page(step)
                }}
            >
                ${sprite(ARROWS[vertical ? 'vertical' : 'horizontal'][step < 0 ? 0 : 1])}
            </button>
        `;
    }

    function button(item: Item) {
        let app = status(item),
            local = motion(item);

        return html`
            <button
                class='card dock-button'
                type='button'
                ${face(item)}
                ${attributes[DOCK_BUTTON]}
                ${{
                    'aria-label': () => app.running ? `${item.label}, running` : item.label,
                    class: () => local.launching && 'dock-button--launching',
                    onanimationend: () => {
                        local.launching = false;
                    },
                    onclick: () => open(item)
                }}
            >
                ${glyph(item)}
            </button>
        `;
    }

    // Off the shelf's current page; hidden outright, so an icon swelling at either end grows the dock rather than
    // being cut off by it.
    function hidden(item: Item) {
        if (!scroll.count) {
            return false;
        }

        docked.$length;
        scroll.order;

        let index = docked.indexOf(item);

        return index < scroll.first || index >= scroll.first + scroll.count;
    }

    // Beside the dock, centred on it: a search, the apps, and the keys that drive them. The apps sort into the dock
    // and back.
    function launcher(apps: ReactiveArray<Item>) {
        // The app the keys rest on, so a step only reaches the two apps it moves between.
        let current = signal<Item | undefined>(undefined),
            library = sortable(apps, (item, attributes) => html`
                <div
                    class='dock-app'
                    ${attributes}
                    ${{ class: [() => !matches(item) && 'dock-app--hidden', () => signal.selector(current, item) && '--active'] }}
                >
                    ${button(item)}
                    <span class='dock-app-label'>${item.label}</span>
                </div>
            `, { group, onsort: sorted });

        effect(() => {
            write(current, shown()[selected()]);
        });

        // Every opening starts afresh, on all the apps, with the search taking the keys.
        effect(() => state.active, (open) => {
            if (!open) {
                return;
            }

            launch.index = -1;
            launch.query = '';

            // After the popup has put focus back where it was while opening.
            requestAnimationFrame(() => {
                field?.focus({ preventScroll: true });
            });
        });

        return html`
            <div
                aria-label='All apps'
                class='tooltip-content tooltip-content--${direction} dock-launcher'
                id='${group}-launcher'
                role='dialog'
                ${attributes[DOCK_LAUNCHER]}
                ${{ onmousedown: keep }}
            >
                <div class='dock-launcher-search'>
                    ${sprite(magnifier)}
                    ${input({
                        'aria-label': 'Search apps',
                        autocomplete: 'off',
                        class: 'dock-launcher-input',
                        oninput: (e: Event) => {
                            launch.index = -1;
                            launch.query = (e.target as HTMLInputElement).value;
                        },
                        onconnect: (element: HTMLInputElement) => {
                            field = element;
                        },
                        onkeydown: navigate,
                        placeholder: 'Search apps',
                        spellcheck: false,
                        value: () => launch.query
                    })}
                </div>

                <div class='dock-launcher-view' ${scrollbar({ fade: true })}>
                    <div
                        class='dock-launcher-apps'
                        ${library.attributes}
                        ${{
                            onconnect: (element: HTMLElement) => {
                                cells = element;
                            }
                        }}
                    >
                        ${library.render()}
                    </div>
                    ${() => !shown().length && html`
                        <p class='dock-launcher-empty' role='status'>${launch.query.trim() ? 'No results' : 'No apps'}</p>
                    `}
                </div>

                <div aria-hidden='true' class='dock-launcher-footer'>
                    ${hint(['esc'], 'Close')}
                    ${hint([left, right, up, down].map((href) => sprite(href, 'dock-launcher-key-icon')), 'Navigate')}
                    ${hint([sprite(enter, 'dock-launcher-key-icon')], 'Open')}
                </div>
            </div>
        `;
    }

    function matches(item: Item) {
        let query = launch.query.trim().toLowerCase();

        return !query || item.label.toLowerCase().includes(query);
    }

    // Whether the icons outgrow the shelf, and if so how many whole ones a page holds. Read with every icon shown, at
    // the length the shelf gives them, which only the consumer's layout knows; the page then keeps room for the swell,
    // so the icons at its ends grow into it. Only the resize observer calls this, outside any reactivity pass, so the
    // flushes land the shown and hidden icons around the reads, within one layout.
    function measure() {
        if (!arrows || !shelf || !track || !viewport) {
            return;
        }

        measuring.active = true;
        flush();

        let length: 'offsetHeight' | 'offsetWidth' = vertical ? 'offsetHeight' : 'offsetWidth',
            pitch = rest(length),
            room = vertical ? viewport.clientHeight : viewport.clientWidth,
            span = track[length],
            style = getComputedStyle(shelf),
            // The hovered icon's growth plus its neighbours', two-thirds and one-third of it on each side.
            swell = 3 * ((parseFloat(style.getPropertyValue('--size-peak')) - parseFloat(style.getPropertyValue('--size-rest'))) || 0);

        measuring.active = false;
        flush();

        if (span <= room) {
            scroll.count = 0;
            scroll.first = 0;
            return;
        }

        scroll.count = Math.max(1, Math.floor((room - swell) / pitch));
        scroll.first = Math.max(0, Math.min(scroll.first, docked.length - scroll.count));
    }

    function motion(item: Item) {
        let current = launching.get(item);

        if (!current) {
            current = reactive({ launching: false });
            launching.set(item, current);
        }

        return current;
    }

    // The first arrow picks the first app, later ones step through the shown apps as the grid lays them out; Enter
    // opens the one they rest on, or the first shown before any is picked.
    function navigate(e: KeyboardEvent) {
        if (e.isComposing) {
            return;
        }

        let list = shown(),
            columns = cells ? getComputedStyle(cells).gridTemplateColumns.split(' ').length : 1,
            step = ({ ArrowDown: columns, ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns } as Record<string, number>)[e.key];

        if (step) {
            e.preventDefault();

            if (list.length) {
                launch.index = launch.index < 0 ? 0 : Math.min(Math.max(selected() + step, 0), list.length - 1);

                // Scrolling needs the element, which the rendered '--active' marks once the step has landed.
                requestAnimationFrame(() => {
                    cells?.querySelector('.dock-app.--active')?.scrollIntoView({ block: 'nearest' });
                });
            }
        }
        else if (e.key === 'Enter') {
            let item = list[selected()] ?? list[0];

            e.preventDefault();

            if (item) {
                open(item);
            }
        }
    }

    function open(item: Item) {
        let app = status(item);

        state.active = false;

        // Already running: a click just brings it forward, no fanfare.
        if (app.running) {
            return;
        }

        app.running = true;
        motion(item).launching = true;
        onlaunch?.(item.label);
    }

    function page(step: -1 | 1) {
        scroll.first = Math.max(0, Math.min(scroll.first + step * scroll.count, docked.length - scroll.count));
    }

    // An icon's length along the shelf at rest, slot spacing included: the shortest, since the swell only grows the
    // ones near the cursor. Measuring a swollen one would fit fewer each time, and in a parent sized by the dock,
    // shrink it away.
    function rest(length: 'offsetHeight' | 'offsetWidth') {
        let children = track?.children ?? [],
            min = Infinity;

        for (let i = 0, n = children.length; i < n; i++) {
            min = Math.min(min, (children[i] as HTMLElement)[length] || Infinity);
        }

        return min === Infinity ? 1 : min;
    }

    function selected() {
        return launch.index < 0 ? -1 : Math.min(launch.index, shown().length - 1);
    }

    function shown() {
        if (!drawer) {
            return [];
        }

        drawer.$length;

        return drawer.filter(matches);
    }

    function slot(item: Item, attributes: Attributes) {
        return html`
            <div
                class='dock-item'
                ${attributes}
                ${{
                    class: () => hidden(item) && 'dock-item--hidden',
                    onconnect: (element: Slot) => {
                        element[LABEL] = item.label;
                    }
                }}
            >
                ${button(item)}
                <span aria-hidden='true' class='dock-light ${() => status(item).running && '--active'}'></span>
            </div>
        `;
    }

    function sorted(item: Item, from: number, to: number, source: ReactiveArray<Item>, target: ReactiveArray<Item>) {
        scroll.order++;
        onsort?.(item, from, to, source, target);
    }

    function status(item: Item) {
        let current = running.get(item);

        if (!current) {
            current = item.state ?? reactive({ running: item.running ?? false });
            running.set(item, current);
        }

        return current;
    }

    // One label glides between the icons; hidden from assistive tech, since each button is already named by it.
    let list = sortable(docked, slot, { drag: copy, group, onsort: sorted }),
        tip = tooltip.shared({ 'aria-hidden': 'true', class: 'dock-label', delay: { open: TOOLTIP_DELAY }, direction });

    return html`
        <nav
            class='dock dock--${direction} ${drawer && 'tooltip'}'
            ${attributes}
            ${tip.delegate({ content: name, edge: true, selector: '.dock-item' })}
            ${popup}
            ${{
                'aria-label': label,
                'aria-orientation': vertical ? 'vertical' : 'horizontal',
                class: [
                    () => measuring.active && 'dock--measuring',
                    () => state.active && 'dock--open',
                    () => scroll.count > 0 && 'dock--overflowing'
                ],
                // The icons are measured against the shelf whenever it, they, or the room around the dock change; the
                // dock's parent can grow without the dock growing with it.
                onconnect: (element: HTMLElement) => {
                    if (!arrows) {
                        return;
                    }

                    let resize = observer(measure);

                    shelf = element;

                    for (let node of [element, element.parentElement, track, viewport]) {
                        if (node) {
                            resize.observe(node);
                        }
                    }

                    onCleanup(resize.disconnect);
                }
            }}
        >
            ${arrows && arrow(-1)}
            <div
                class='dock-viewport'
                ${{
                    // The track spreads the sortable's attributes, so it is reached from here; children connect
                    // before the shelf, which measures them.
                    onconnect: (element: HTMLElement) => {
                        track = element.firstElementChild as HTMLElement;
                        viewport = element;
                    }
                }}
            >
                <div class='dock-items' ${list.attributes}>${list.render()}</div>
            </div>
            ${arrows && arrow(1)}
            ${drawer && all()}
            ${tip.render()}
            ${drawer && launcher(drawer)}
        </nav>
    `;
};


export default component(dock, { button: DOCK_BUTTON, launcher: DOCK_LAUNCHER });
export type { Direction, Item };
