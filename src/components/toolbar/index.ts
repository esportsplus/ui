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
import './scss/index.scss';


type A = Attributes & {
    // The buttons kept out of the bar, in a drawer that opens from its own button; dragging moves them in and out of
    // 'items', and throwing one off the bar puts it back.
    apps?: Button[] | ReactiveArray<Button>;
    // Arrows either end page through the buttons once they outgrow the bar, which otherwise grows to fit them.
    arrows?: boolean;
    // How long the pointer rests on a button before its label shows, ms.
    delay?: number;
    // The side the drawer and the labels open toward; east and west stand the bar upright, for a screen's side edge.
    direction?: Direction;
    // A drawer the bar morphs into, opened by the button 'toolbar.drawer()' places among 'items' (appended when
    // missing, dropped without a drawer).
    drawer?: boolean;
    items: Entry[] | ReactiveArray<Entry>;
    label?: string;
    // 'dock' treats the buttons as apps: a click launches one with a hop and lights its running dot.
    mode?: Mode;
    onlaunch?: (label: string) => void;
    onsort?: SortableOptions<Entry>['onsort'];
    // A search over the drawer's buttons.
    search?: boolean;
    // Whether buttons drag to reorder, and between the bar and the drawer; on in a dock, off otherwise.
    sortable?: boolean;
    // Whether the drawer is open.
    state?: { active: boolean };
};

type Button = {
    // Spread on the button: any state it shows ('aria-pressed', ...) and handlers other than its click.
    attributes: Attributes;
    // Shown as the pointer rests on it, the label when omitted: a shortcut, say, or a passing 'Copied'.
    hint?: Hint;
    label: Label;
    // Run from the button's own click handler: an element keeps one handler per event, so a second would be lost.
    onclick?: (e: MouseEvent) => void;
    running?: boolean;
    state?: { running: boolean };
} & Face;

// Any control the bar carries as is, a select or a field, rendered afresh wherever it shows. Never dragged.
type Custom = {
    readonly [CUSTOM]: true;
    hint?: Hint;
    label?: Label;
    render: () => Renderable<unknown>;
};

type Direction = 'e' | 'n' | 's' | 'w';

type Divider = { readonly [DIVIDER]: true };

type Entry = Button | Custom | Divider | typeof TOOLBAR_DRAWER;

type Face =
    // A sprite id, or a function rendering it: a button shows in the bar, the drawer and the copy being dragged at
    // once, and rendered content can only stand in one place.
    { icon: string | (() => Renderable<unknown>), thumbnail?: never } |
    // An image url, covering the whole button.
    { icon?: never, thumbnail: string };

type Hint = Renderable<unknown> | (() => Renderable<unknown>);

type Label = string | (() => string);

type Mode = 'dock' | 'toolbar';

type Slot = HTMLElement & { [LABEL]: Hint };


const ARROWS: Record<'horizontal' | 'vertical', [previous: string, next: string]> = {
    horizontal: [chevronLeft, chevronRight],
    vertical: [chevronUp, chevronDown]
};

const CUSTOM = Symbol();

const DIVIDER = Symbol();

// A custom item's control, the one the arrow keys reach.
const FOCUSABLE = 'button, input, select, textarea, [contenteditable], [tabindex]';

const LABEL = Symbol();

// Keys that rove the bar's controls, by orientation; Home and End jump to its ends.
const ROVE: Record<'horizontal' | 'vertical', Record<string, -1 | 1>> = {
    horizontal: { ArrowLeft: -1, ArrowRight: 1 },
    vertical: { ArrowDown: 1, ArrowUp: -1 }
};

const TOOLBAR_DRAWER = Symbol.for('@esportsplus/ui/toolbar.drawer');

// The first label waits so a cursor passing through doesn't flash one; neighbours then open at once.
const TOOLTIP_DELAY = 300;


let uid = 0;


// The copy following the pointer: the bar's slot with a stand-in for the button, which keeps no controls.
function copy(item: Button) {
    return html`
        <div class='toolbar-item'>
            <span class='button button--feedback toolbar-button' ${face(item)}>${glyph(item)}</span>
        </div>
    `;
}

function face(item: Button): Attributes {
    return {
        class: item.thumbnail !== undefined && 'toolbar-button--thumbnail',
        style: item.thumbnail !== undefined ? `--thumbnail: url(${JSON.stringify(thumbnail(item.thumbnail))})` : ''
    };
}

function glyph(item: Button) {
    if (item.icon === undefined) {
        return '';
    }

    return typeof item.icon === 'string' ? sprite(item.icon) : item.icon();
}

function hint(keys: Renderable<unknown>[], label: string) {
    return html`
        <span class='toolbar-drawer-footer-hint'>
            <span aria-hidden='true' class='toolbar-drawer-keys'>
                ${keys.map((key) => html`<kbd class='button button--kbd'>${key}</kbd>`)}
            </span>
            ${label}
        </span>
    `;
}

// Clicks anywhere in the drawer keep focus where the keys go, so typing and the arrow keys carry on after a stray click.
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

function text(label: Label) {
    return typeof label === 'function' ? label() : label;
}

// Absolute, since a 'url()' substituted from a custom property resolves against the stylesheet that reads it.
function thumbnail(src: string) {
    return new URL(src, document.baseURI).href;
}

// The copy dragged out of the drawer: its cell, with a stand-in for the button, which keeps no controls. CSS turns it
// into the bar's button as it lifts.
function tile(item: Button) {
    return html`
        <div class='toolbar-app'>
            <span class='button button--feedback toolbar-button' ${face(item)}>${glyph(item)}</span>
            <span class='toolbar-app-label'>${item.label}</span>
        </div>
    `;
}


const button = ({ hint, icon, label, onclick, running, state, thumbnail, ...attributes }: Attributes & Omit<Button, 'attributes'>): Button =>
    ({ attributes, hint, icon, label, onclick, running, state, thumbnail }) as Button;

const divider = (): Divider => ({ [DIVIDER]: true });

const drawer = () => TOOLBAR_DRAWER;

const item = (render: Custom['render'], { hint, label }: Pick<Custom, 'hint' | 'label'> = {}): Custom => ({ [CUSTOM]: true, hint, label, render });

const toolbar = ({
    apps,
    arrows = false,
    delay = TOOLTIP_DELAY,
    direction = 'n',
    drawer: drawn = false,
    items,
    mode = 'toolbar',
    label = mode === 'dock' ? 'Dock' : 'Toolbar',
    onlaunch,
    onsort,
    search = true,
    sortable: sorting = mode === 'dock',
    state = reactive({ active: false }),
    ...attributes
}: A) => {
    let cells: HTMLElement | undefined,
        dock = mode === 'dock',
        entries = items instanceof ReactiveArray ? items : new ReactiveArray(items),
        // The bar's own box while it morphs to and from the drawer: lengths, since 'auto' doesn't transition, set only
        // from opening until it has landed back. 'morphing' turns the transitions on a frame after 'sized' pins the
        // bar's box, so the pin itself (a pill's '999px' rounding held to what it draws) is instant.
        fit = reactive({ height: 0, morphing: false, radius: 0, sized: false, width: 0 }),
        field: HTMLInputElement | undefined,
        frame = 0,
        group = `toolbar-${++uid}`,
        // The drawer's search, and the button the keys rest on among those it shows: none (-1) until an arrow picks one.
        launch = reactive({ index: -1, query: '' }),
        // Kept per button rather than per render, since moving between lists renders it afresh.
        launching = new WeakMap<Button, { launching: boolean }>(),
        marker = entries.indexOf(TOOLBAR_DRAWER),
        // Shows the buttons off the page for as long as 'measure()' reads them.
        measuring = reactive({ active: false }),
        more = mode === 'dock' ? 'All apps' : 'More',
        panel: HTMLElement | undefined,
        popup = drawn && overlay.popup({ state, target: surface }),
        // The bar's own box, which it grows from and lands back on.
        resting = { height: 0, radius: 0, width: 0 },
        running = new WeakMap<Button, { running: boolean }>(),
        // The page of buttons the bar shows: the first, and how many fit (none while they all do). 'order' moves with
        // every sort, which can reorder the bar without changing its length.
        scroll = reactive({ count: 0, first: 0, order: 0 }),
        shelf: HTMLElement | undefined,
        // The drawer's buttons.
        stash = drawn ? (apps instanceof ReactiveArray ? apps : new ReactiveArray(apps ?? [])) : undefined,
        track: HTMLElement | undefined,
        vertical = direction === 'e' || direction === 'w',
        viewport: HTMLElement | undefined,
        // The bar has grown to the drawer: a frame behind 'state.active' while opening, so it starts from its own box,
        // and with it while closing.
        expanded = reactive({ active: false });

    function arrow(step: -1 | 1) {
        return html`
            <button
                aria-label='${step < 0 ? 'Previous' : 'Next'}'
                class='toolbar-arrow'
                type='button'
                ${{
                    disabled: () => step < 0 ? scroll.first <= 0 : scroll.first + scroll.count >= entries.$length,
                    onclick: () => page(step)
                }}
            >
                ${sprite(ARROWS[vertical ? 'vertical' : 'horizontal'][step < 0 ? 0 : 1])}
            </button>
        `;
    }

    // Back to the bar: the drawer's contents leave and the bar shrinks onto its buttons.
    function collapse() {
        cancelAnimationFrame(frame);
        expanded.active = false;
        land();
    }

    // A button in the bar or the drawer: the consumer's attributes, and in a dock, its launch and running state.
    function control(item: Button) {
        let app = status(item),
            local = motion(item);

        return html`
            <button
                class='button button--feedback toolbar-button'
                type='button'
                ${face(item)}
                ${item.attributes}
                ${{
                    'aria-label': () => dock && app.running ? `${text(item.label)}, running` : text(item.label),
                    class: () => local.launching && 'toolbar-button--launching',
                    onanimationend: () => {
                        local.launching = false;
                    },
                    onclick: (e: MouseEvent) => {
                        item.onclick?.(e);
                        open(item);
                    }
                }}
            >
                ${glyph(item)}
            </button>
        `;
    }

    function custom(entry: Custom) {
        let hint = entry.hint ?? entry.label;

        return html`
            <div
                class='toolbar-custom ${hint !== undefined && 'toolbar-custom--hinted'}'
                ${{
                    class: () => hidden(entry) && 'toolbar-custom--hidden',
                    onconnect: (element: Slot) => {
                        if (hint !== undefined) {
                            element[LABEL] = hint;
                        }
                    }
                }}
            >
                ${entry.render()}
            </div>
        `;
    }

    function divide(entry: Divider) {
        return html`<span aria-hidden='true' class='toolbar-divider ${() => hidden(entry) && 'toolbar-divider--hidden'}'></span>`;
    }

    // The drawer's slot: buttons sort around it, but it isn't dragged itself.
    function door() {
        return html`
            <div
                class='toolbar-item'
                ${{
                    class: () => hidden(TOOLBAR_DRAWER) && 'toolbar-item--hidden',
                    onconnect: (element: Slot) => {
                        element[LABEL] = more;
                    }
                }}
            >
                <button
                    aria-controls='${group}-drawer'
                    aria-haspopup='dialog'
                    aria-label='${more}'
                    class='button button--feedback toolbar-button'
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

    // Beside the bar, centred on it, laid out as the command palette is: the search and the buttons in an inset card,
    // and the keys that drive them on the frame around it. The buttons sort into the bar and back.
    function drawer(apps: ReactiveArray<Button>) {
        // The button the keys rest on, so a step only reaches the two buttons it moves between.
        let current = signal<Button | undefined>(undefined),
            library = sortable(apps, (item, attributes) => html`
                <div
                    class='toolbar-app'
                    ${sorting ? attributes : {}}
                    ${{ class: [() => !matches(item) && 'toolbar-app--hidden', () => signal.selector(current, item) && '--active'] }}
                >
                    ${control(item)}
                    <span class='toolbar-app-label'>${item.label}</span>
                </div>
            `, { drag: tile, group, onland: () => lift(false), onlift: () => lift(true), onsort: sorted }),
            // Without a search, the drawer itself takes focus and the keys. Kept out of the literal below, which
            // compiles each handler to a listener even when unset.
            keys: Attributes = search ? {} : { onkeydown: navigate, tabindex: '-1' };

        effect(() => {
            write(current, shown()[selected()]);
        });

        // Every opening starts afresh, on all the buttons, with the keys going to the drawer, and grows the bar into
        // it; every close shrinks it back.
        effect(() => state.active, (open) => {
            if (!open) {
                collapse();
                return;
            }

            launch.index = -1;
            launch.query = '';
            expand();
        });

        return html`
            <div
                aria-label='${more}'
                class='tooltip-content tooltip-content--${direction} toolbar-drawer'
                id='${group}-drawer'
                role='dialog'
                ${keys}
                ${{
                    // Followed while open, so a search that changes its rows resizes the bar around them.
                    onconnect: (element: HTMLElement) => {
                        let resize = observer(() => {
                            if (expanded.active) {
                                grow();
                            }
                        });

                        panel = element;
                        resize.observe(element);
                        onCleanup(resize.disconnect);
                    },
                    onmousedown: keep
                }}
            >
                <div class='toolbar-drawer-body'>
                    ${search && html`
                        <div class='toolbar-drawer-search'>
                            ${sprite(magnifier)}
                            ${input({
                                'aria-label': 'Search',
                                autocomplete: 'off',
                                class: 'toolbar-drawer-input',
                                oninput: (e: Event) => {
                                    launch.index = -1;
                                    launch.query = (e.target as HTMLInputElement).value;
                                },
                                onconnect: (element: HTMLInputElement) => {
                                    field = element;
                                },
                                onkeydown: navigate,
                                placeholder: 'Search',
                                spellcheck: false,
                                value: () => launch.query
                            })}
                        </div>
                    `}

                    <div class='toolbar-drawer-view' ${scrollbar({ fade: true })}>
                        <div
                            class='toolbar-drawer-apps'
                            ${sorting && library.attributes}
                            ${{
                                onconnect: (element: HTMLElement) => {
                                    cells = element;
                                }
                            }}
                        >
                            ${library.render()}
                        </div>
                        ${() => !shown().length && html`
                            <p class='toolbar-drawer-empty' role='status'>${launch.query.trim() ? 'No results' : 'Nothing here'}</p>
                        `}
                    </div>
                </div>

                <div aria-hidden='true' class='toolbar-drawer-footer'>
                    ${hint(['esc'], 'Close')}
                    ${hint([left, right, up, down].map((href) => sprite(href, 'toolbar-drawer-kbd-icon')), 'Navigate')}
                    ${hint([sprite(enter, 'toolbar-drawer-kbd-icon')], 'Open')}
                </div>
            </div>
        `;
    }

    // Grows the bar from its own box to the drawer's. Pinned at its own size first, which changes nothing on screen,
    // so the growth has a length to start from; the popup has put focus back where it was by the time it grows.
    function expand() {
        cancelAnimationFrame(frame);

        if (!fit.sized) {
            hold();
            Object.assign(fit, resting, { sized: true });
        }

        queueMicrotask(() => {
            shelf?.getBoundingClientRect();

            frame = requestAnimationFrame(() => {
                expanded.active = true;
                fit.morphing = true;
                grow();
                (field ?? panel)?.focus({ preventScroll: true });
            });
        });
    }

    // The drawer's size, which the bar grows to; layout lengths, so a scaled ancestor doesn't skew them.
    function grow() {
        if (!panel) {
            return;
        }

        fit.height = panel.offsetHeight;
        fit.radius = parseFloat(getComputedStyle(panel).borderTopLeftRadius) || 0;
        fit.width = panel.offsetWidth;
    }

    // Off the bar's current page; hidden outright, so the page's own buttons lay out as if they were all there is.
    function hidden(entry: Entry) {
        if (!scroll.count) {
            return false;
        }

        entries.$length;
        scroll.order;

        let index = entries.indexOf(entry);

        return index < scroll.first || index >= scroll.first + scroll.count;
    }

    // The bar's own box. Its rounding is held to half its height, so a pill's '999px' eases into the drawer's corners
    // rather than holding the stadium shape until the end.
    function hold() {
        if (!shelf) {
            return;
        }

        resting = {
            height: shelf.offsetHeight,
            radius: Math.min(parseFloat(getComputedStyle(shelf).borderTopLeftRadius) || 0, shelf.offsetHeight / 2, shelf.offsetWidth / 2),
            width: shelf.offsetWidth
        };
    }

    // Back to the bar's box, released once there so it sizes itself again; closed before it grew, there is nothing to
    // wait for.
    function land() {
        if (!fit.sized) {
            return;
        }

        if (fit.height === resting.height && fit.width === resting.width) {
            fit.morphing = false;
            fit.sized = false;
            return;
        }

        Object.assign(fit, resting);
    }

    // Dragging a button out of the drawer shows the bar to drop it in; once it has landed, wherever that is, the bar
    // grows back into the drawer if it is still open.
    function lift(active: boolean) {
        if (active) {
            collapse();
        }
        else if (state.active) {
            expand();
        }
    }

    function matches(item: Button) {
        let query = launch.query.trim().toLowerCase();

        return !query || text(item.label).toLowerCase().includes(query);
    }

    // Whether the buttons outgrow the bar, and if so how many whole ones a page holds. Read with every button shown,
    // at the length the bar gives them, which only the consumer's layout knows. Only the resize observer calls this,
    // outside any reactivity pass, so the flushes land the shown and hidden buttons around the reads, within one layout.
    function measure() {
        if (!arrows || !track || !viewport) {
            return;
        }

        measuring.active = true;
        flush();

        let gap = parseFloat(getComputedStyle(track)[vertical ? 'rowGap' : 'columnGap']) || 0,
            length: 'offsetHeight' | 'offsetWidth' = vertical ? 'offsetHeight' : 'offsetWidth',
            pitch = rest(length) + gap,
            room = vertical ? viewport.clientHeight : viewport.clientWidth,
            span = track[length];

        measuring.active = false;
        flush();

        if (span <= room) {
            scroll.count = 0;
            scroll.first = 0;
            return;
        }

        // The last button on a page needs no gap after it.
        scroll.count = Math.max(1, Math.floor((room + gap) / pitch));
        scroll.first = Math.max(0, Math.min(scroll.first, entries.length - scroll.count));
    }

    function motion(item: Button) {
        let current = launching.get(item);

        if (!current) {
            current = reactive({ launching: false });
            launching.set(item, current);
        }

        return current;
    }

    // The first arrow picks the first button, later ones step through the shown buttons as the grid lays them out;
    // Enter presses the one they rest on, or the first shown before any is picked.
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
                    cells?.querySelector('.toolbar-app.--active')?.scrollIntoView({ block: 'nearest' });
                });
            }
        }
        else if (e.key === 'Enter') {
            e.preventDefault();

            // Clicked rather than opened, so the consumer's own handlers on the button run as a click's would.
            (cells?.querySelector('.toolbar-app.--active > .toolbar-button') ?? cells?.querySelector('.toolbar-app:not(.toolbar-app--hidden) > .toolbar-button'))
                ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
    }

    // Pressing a button closes the drawer; in a dock, it also launches the app.
    function open(item: Button) {
        state.active = false;

        if (!dock) {
            return;
        }

        let app = status(item);

        // Already running: a click just brings it forward, no fanfare.
        if (app.running) {
            return;
        }

        app.running = true;
        motion(item).launching = true;
        onlaunch?.(text(item.label));
    }

    function page(step: -1 | 1) {
        scroll.first = Math.max(0, Math.min(scroll.first + step * scroll.count, entries.length - scroll.count));
    }

    // A button's length along the bar: the shortest, so a page never holds more than fit. Dividers aren't buttons.
    function rest(length: 'offsetHeight' | 'offsetWidth') {
        let children = track?.children ?? [],
            min = Infinity;

        for (let i = 0, n = children.length; i < n; i++) {
            if (children[i].classList.contains('toolbar-item')) {
                min = Math.min(min, (children[i] as HTMLElement)[length] || Infinity);
            }
        }

        return min === Infinity ? 1 : min;
    }

    // The ARIA toolbar's one tab stop, on 'current' or else the first control, every other control out of the tab
    // order. Kept on the elements themselves, since a custom item's control is the consumer's to render.
    function rove(current?: Element | null) {
        let list = roving();

        for (let i = 0, n = list.length; i < n; i++) {
            list[i].tabIndex = list[i] === (current && list.includes(current as HTMLElement) ? current : list[0]) ? 0 : -1;
        }
    }

    // The controls the arrow keys reach, in the bar's order: each button, and each custom item's own control; none
    // hidden, off the page or disabled. Read from the bar's own state rather than layout, so a bar not yet shown (in a
    // closed popover, say) already has its tab stop.
    function roving() {
        let children = track?.children ?? [],
            list: HTMLElement[] = [];

        for (let i = 0, n = children.length; i < n; i++) {
            let child = children[i],
                control = child.classList.contains('toolbar-item')
                    ? child.querySelector<HTMLElement>(':scope > .toolbar-button')
                    : child.classList.contains('toolbar-custom') ? child.querySelector<HTMLElement>(FOCUSABLE) : null;

            if (control && !control.closest('[hidden], .toolbar-custom--hidden, .toolbar-item--hidden') && !control.matches(':disabled')) {
                list.push(control);
            }
        }

        return list;
    }

    // Steps between controls, leaving the keys alone in a field, where they move the caret.
    function step(e: KeyboardEvent) {
        let target = e.target as HTMLElement;

        if (e.defaultPrevented || target.matches('input, textarea, [contenteditable]')) {
            return;
        }

        let list = roving(),
            at = list.indexOf(target),
            move = ROVE[vertical ? 'vertical' : 'horizontal'][e.key],
            next = e.key === 'Home' ? list[0] : e.key === 'End' ? list[list.length - 1] : move && at !== -1 ? list[(at + move + list.length) % list.length] : null;

        if (!next) {
            return;
        }

        e.preventDefault();
        rove(next);
        next.focus();
    }

    function selected() {
        return launch.index < 0 ? -1 : Math.min(launch.index, shown().length - 1);
    }

    function shown() {
        if (!stash) {
            return [];
        }

        stash.$length;

        return stash.filter(matches);
    }

    // Dividers, custom items and the drawer's button sort with the rest, but only buttons are dragged.
    function slot(entry: Entry, attributes: Attributes) {
        if (entry === TOOLBAR_DRAWER) {
            return door();
        }

        if (DIVIDER in entry) {
            return divide(entry);
        }

        if (CUSTOM in entry) {
            return custom(entry);
        }

        return html`
            <div
                class='toolbar-item'
                ${sorting ? attributes : {}}
                ${{
                    class: () => hidden(entry) && 'toolbar-item--hidden',
                    onconnect: (element: Slot) => {
                        element[LABEL] = entry.hint ?? entry.label;
                    }
                }}
            >
                ${control(entry)}
                ${dock && html`<span aria-hidden='true' class='toolbar-light ${() => status(entry).running && '--active'}'></span>`}
            </div>
        `;
    }

    // Shared by the bar's list and the drawer's, whose arrays trade entries; either end of a move can be either.
    function sorted<T extends Entry>(item: T, from: number, to: number, source: ReactiveArray<T>, target: ReactiveArray<T>) {
        scroll.order++;
        onsort?.(item, from, to, source as unknown as ReactiveArray<Entry>, target as unknown as ReactiveArray<Entry>);
    }

    function status(item: Button) {
        let current = running.get(item);

        if (!current) {
            current = item.state ?? reactive({ running: item.running ?? false });
            running.set(item, current);
        }

        return current;
    }

    // Thrown off the bar, a button goes back to the drawer, at its end.
    function thrown(item: Entry, from: number, list: ReactiveArray<Entry>) {
        let target = stash as unknown as ReactiveArray<Entry>;

        target.push(item);
        sorted(item, from, target.length - 1, list, target);
    }

    if (!stash && marker !== -1) {
        entries.splice(marker, 1);
    }
    else if (stash && marker === -1) {
        entries.push(TOOLBAR_DRAWER);
    }

    // One label glides between the buttons; hidden from assistive tech, since each button is already named by it. Only
    // buttons are dragged, so 'copy' only ever gets one, and only one is ever thrown back to the drawer.
    let list = sortable(entries, slot, { drag: copy as (item: Entry) => Renderable<unknown>, group, onsort: sorted, onthrow: sorting && stash ? thrown : undefined }),
        tip = tooltip.shared({ 'aria-hidden': 'true', class: 'toolbar-label', delay: { open: delay }, direction });

    // A toolbar takes one tab stop, kept on a control the bar still shows as its items change.
    if (!dock) {
        effect(() => {
            entries.$length;
            scroll.order;
            requestAnimationFrame(() => rove(roving().find((control) => control.tabIndex === 0)));
        });
    }

    return html`
        <div
            class='toolbar toolbar--${direction} ${stash && 'tooltip'}'
            ${attributes}
            ${tip.delegate({ content: name, edge: true, selector: '.toolbar-item, .toolbar-custom--hinted' })}
            ${popup}
            ${{
                'aria-label': label,
                'aria-orientation': vertical ? 'vertical' : 'horizontal',
                class: [
                    () => expanded.active && 'toolbar--expanded',
                    () => fit.morphing && 'toolbar--morphing',
                    () => fit.sized && 'toolbar--sized',
                    () => measuring.active && 'toolbar--measuring',
                    () => state.active && 'toolbar--open',
                    () => scroll.count > 0 && 'toolbar--overflowing'
                ],
                // The buttons are measured against the bar whenever it, they, or the room around it change; the bar's
                // parent can grow without the bar growing with it.
                onconnect: (element: HTMLElement, on) => {
                    shelf = element;

                    // Direct: delegation only runs the nearest bound handler, which for a select is its own.
                    if (!dock) {
                        on(element, 'focusin', (e: FocusEvent) => rove(e.target as Element), { direct: true });
                        on(element, 'keydown', step, { direct: true });
                        rove();
                    }

                    if (!arrows) {
                        return;
                    }

                    let resize = observer(measure);

                    for (let node of [element, element.parentElement, track, viewport]) {
                        if (node) {
                            resize.observe(node);
                        }
                    }

                    onCleanup(resize.disconnect);
                },
                // Landed back on its own box: the bar sizes itself again.
                ontransitionend: (e: TransitionEvent) => {
                    if (e.target === e.currentTarget && e.propertyName === 'height' && !expanded.active) {
                        fit.morphing = false;
                        fit.sized = false;
                    }
                },
                role: dock ? 'navigation' : 'toolbar',
                // '--fit-depth' is the bar's resting depth from the screen edge, which its contents keep throughout.
                style: () => fit.sized && `--fit-depth: ${vertical ? resting.width : resting.height}px; --fit-height: ${fit.height}px; --fit-radius: ${fit.radius}px; --fit-width: ${fit.width}px;`
            }}
        >
            ${arrows && arrow(-1)}
            <div
                class='toolbar-viewport'
                ${{
                    // The track spreads the sortable's attributes, so it is reached from here; children connect
                    // before the bar, which measures them.
                    onconnect: (element: HTMLElement) => {
                        track = element.firstElementChild as HTMLElement;
                        viewport = element;
                    }
                }}
            >
                <div class='toolbar-items' ${sorting && list.attributes}>${list.render()}</div>
            </div>
            ${arrows && arrow(1)}
            ${tip.render()}
            ${stash && drawer(stash)}
        </div>
    `;
};


export default component(toolbar, { button, divider, drawer, item });
export type { Button, Custom, Direction, Divider, Entry, Mode };
