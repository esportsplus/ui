import { computed, effect, flush, onCleanup, reactive, ReactiveArray, read, signal, write } from '@esportsplus/reactivity';
import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import icon from '~/components/icon';
import inlineEdit from '~/components/inline-edit';
import overlay from '~/components/overlay';
import searchbox from '~/components/search';
import sortable, { type SortableCombine, type SortableOptions } from '~/components/sortable';
import tooltip from '~/components/tooltip';
import { content as surface } from '~/components/tooltip/utilities';
import scrollbar from '~/modifiers/scrollbar';
import { observer } from '~/shared/resize';
import arrowSvg from '@esportsplus/ui/svg/arrow.svg';
import chevron from '@esportsplus/ui/svg/chevron.svg';
import enter from '@esportsplus/ui/svg/enter.svg';
import grid from '@esportsplus/ui/svg/grid.svg';
import '~/components/button/scss/index.scss';
import './scss/index.scss';


type A = Attributes & {
    // Lays the drawer's buttons out by label, under '#' and A to Z headings, with a rail of those letters beside them:
    // pointing along it scrolls to each letter's buttons, and leaving it leaves the drawer where it got to. Only the
    // layout is sorted; 'apps' keeps its own order.
    alphabetical?: boolean;
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
    // A dragged button let go over the middle of another, on the bar or in a group's panel, groups the two, or over a
    // group, joins it at its end; what it is over swells the moment the pointer reaches its middle. A group opens a
    // panel of its own buttons, sorted by dragging, and
    // gives way to its last button once the others have left. Groups nest; the drawer only ever holds buttons, and
    // a group dropped in it, or thrown off the bar, spreads its buttons there.
    groups?: boolean;
    items: Entry[] | ReactiveArray<Entry>;
    label?: string;
    // Names each button on the bar under it, rather than as the pointer rests on it.
    labels?: boolean;
    // 'dock' treats the buttons as apps: a click launches one with a hop and lights its running dot.
    mode?: Mode;
    onlaunch?: (label: string) => void;
    // A group renamed from its panel, its 'label' already the new name ('' unnamed).
    onrename?: (group: Group, label: string) => void;
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

type Entry = Button | Custom | Divider | Group | typeof TOOLBAR_DRAWER;

type Face =
    // A sprite id, or a function rendering it: a button shows in the bar, the drawer and the copy being dragged at
    // once, and rendered content can only stand in one place.
    { icon: string | (() => Renderable<unknown>), thumbnail?: never } |
    // An image url, covering the whole button.
    { icon?: never, thumbnail: string };

// Buttons gathered under one button, which opens a panel of them; a group's members can be groups too.
type Group = {
    readonly [GROUP]: true;
    items: ReactiveArray<Member>;
    // Unnamed by default; a name shows as its hover label, or under it with 'labels', and is edited at the top of its
    // panel.
    label?: Label;
};

type Hint = Renderable<unknown> | (() => Renderable<unknown>);

type Label = string | (() => string);

// What a group holds.
type Member = Button | Group;

type Mode = 'dock' | 'toolbar';

// 'MEMBER' is the button or group an element shows, which letting another go over it groups with.
type Slot = HTMLElement & { [LABEL]: Hint, [MEMBER]?: Member };


// Turns of the chevron, which points right.
const ARROWS: Record<'horizontal' | 'vertical', [previous: string, next: string]> = {
    horizontal: ['icon--left', ''],
    vertical: ['icon--up', 'icon--down']
};

const CUSTOM = Symbol();

const DIVIDER = Symbol();

// A custom item's control, the one the arrow keys reach.
const FOCUSABLE = 'button, input, select, textarea, [contenteditable], [tabindex]';

// How long pointing at a letter takes to scroll there, ms: short enough to keep up with a sweep down the rail, which
// retargets it on every letter.
const GLIDE = 150;

const GROUP = Symbol();

const LABEL = Symbol();

// An alphabetical drawer's headings and rail, '#' taking every label that starts with anything but a letter.
const LETTERS = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];

const MEMBER = Symbol();

// Keys that rove the bar's controls, by orientation; Home and End jump to its ends.
const ROVE: Record<'horizontal' | 'vertical', Record<string, -1 | 1>> = {
    horizontal: { ArrowLeft: -1, ArrowRight: 1 },
    vertical: { ArrowDown: 1, ArrowUp: -1 }
};

// How far the pointer may stray past a group's panel, carrying a button out of it, before the panel closes, px.
const SLACK = 8;

const TOOLBAR_DRAWER = Symbol.for('@esportsplus/ui/toolbar.drawer');

// The first label waits so a cursor passing through doesn't flash one; neighbours then open at once.
const TOOLTIP_DELAY = 240;


let uid = 0;


// Each button's letter and its place among them all, sorted by letter and then by label.
function alphabetize(items: ReactiveArray<Button>) {
    let places = new Map<Button, { letter: number, rank: number }>(),
        sorted: { item: Button, label: string, letter: number }[] = [];

    items.$length;

    for (let i = 0, n = items.length; i < n; i++) {
        // A group passing through on its way to being spread out has no label to file.
        let label = grouped(items[i]) ? '' : text(items[i].label);

        sorted.push({ item: items[i], label, letter: initial(label) });
    }

    sorted.sort((a, b) => a.letter - b.letter || a.label.localeCompare(b.label));

    for (let i = 0, n = sorted.length; i < n; i++) {
        places.set(sorted[i].item, { letter: sorted[i].letter, rank: i });
    }

    return places;
}

// Every button a member holds, however deep.
function buttons(member: Member): Button[] {
    if (!grouped(member)) {
        return [member];
    }

    let list: Button[] = [];

    for (let i = 0, n = member.items.length; i < n; i++) {
        list.push(...buttons(member.items[i]));
    }

    return list;
}

// Whether 'member' sits anywhere inside 'group'.
function contains(group: Group, member: Member): boolean {
    for (let i = 0, n = group.items.length; i < n; i++) {
        let item = group.items[i];

        if (item === member || (grouped(item) && contains(item, member))) {
            return true;
        }
    }

    return false;
}

// The copy following the pointer: the bar's slot with a stand-in for the button.
function copy(item: Member) {
    return html`<div class='toolbar-item'>${stand(item)}</div>`;
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

function grouped(value: unknown): value is Group {
    return typeof value === 'object' && value !== null && GROUP in value;
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

// The letter a label files under, accents aside: 'Éclair' under E, '1Password' under '#'.
function initial(label: string) {
    let letter = LETTERS.indexOf(label.normalize('NFD').charAt(0).toUpperCase());

    return letter === -1 ? 0 : letter;
}

// Clicks anywhere in the drawer keep focus where the keys go, so typing and the arrow keys carry on after a stray click.
function keep(e: MouseEvent) {
    if (!(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
    }
}

// A member as one cell of a group's preview: a button's face, small, or a group's own preview, smaller.
function mini(member: Member): DocumentFragment | Element | Text {
    if (grouped(member)) {
        return html`<span class='toolbar-group-face toolbar-group-face--group'>${preview(member)}</span>`;
    }

    return html`
        <span
            class='toolbar-group-face'
            style='${member.thumbnail !== undefined ? `--thumbnail: url(${JSON.stringify(thumbnail(member.thumbnail))})` : '--thumbnail: none'}'
        >
            ${glyph(member)}
        </span>
    `;
}

// A button or a group: what drags, and what groups.
function movable(entry: Entry): entry is Member {
    return typeof entry === 'object' && !(CUSTOM in entry) && !(DIVIDER in entry);
}

function name(trigger: HTMLElement) {
    return (trigger as Slot)[LABEL];
}

// A group's face: its members in a 2x2 grid, which shows the first four. Follows the group as it changes.
function preview(group: Group) {
    return html`<span aria-hidden='true' class='toolbar-group-preview'>${html.reactive(group.items, mini)}</span>`;
}

// A click on a slot or tile around its button, its label or padding, presses the button. A drag's closing click never
// reaches here, since the drag swallows it.
function relay(e: MouseEvent) {
    let target = e.target as Element;

    if (target.closest('button, input, [contenteditable]')) {
        return;
    }

    let button = (e.currentTarget as HTMLElement).querySelector<HTMLButtonElement>(':scope > button');

    if (!button) {
        return;
    }

    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: e.detail, view: window }));
}

function sprite(href: string, name = '') {
    return icon({ 'aria-hidden': 'true', class: name }, href);
}

// A dragged copy's button, which keeps no controls.
function stand(item: Member) {
    if (grouped(item)) {
        return html`<span class='button button--feedback toolbar-button toolbar-button--group'>${preview(item)}</span>`;
    }

    return html`<span class='button button--feedback toolbar-button' ${face(item)}>${glyph(item)}</span>`;
}

function text(label: Label) {
    return typeof label === 'function' ? label() : label;
}

// Absolute, since a 'url()' substituted from a custom property resolves against the stylesheet that reads it.
function thumbnail(src: string) {
    return new URL(src, document.baseURI).href;
}

// The copy dragged out of the drawer: its cell, with a stand-in for the button. CSS turns it into the bar's button as
// it lifts.
function tile(item: Member) {
    return html`
        <div class='toolbar-app'>
            ${stand(item)}
            <span class='toolbar-app-label'>${item.label}</span>
        </div>
    `;
}


const button = ({ hint, icon, label, onclick, running, state, thumbnail, ...attributes }: Attributes & Omit<Button, 'attributes'>): Button =>
    ({ attributes, hint, icon, label, onclick, running, state, thumbnail }) as Button;

const divider = (): Divider => ({ [DIVIDER]: true });

const drawer = () => TOOLBAR_DRAWER;

const group = ({ items, label }: { items: Member[] | ReactiveArray<Member>, label?: Label }): Group =>
    ({ [GROUP]: true, items: items instanceof ReactiveArray ? items : new ReactiveArray(items), label });

const item = (render: Custom['render'], { hint, label }: Pick<Custom, 'hint' | 'label'> = {}): Custom => ({ [CUSTOM]: true, hint, label, render });

const toolbar = ({
    alphabetical = false,
    apps,
    arrows = false,
    delay = TOOLTIP_DELAY,
    direction = 'n',
    drawer: drawn = false,
    groups: gathering = false,
    items,
    labels = false,
    mode = 'toolbar',
    label = mode === 'dock' ? 'Dock' : 'Toolbar',
    onlaunch,
    onrename,
    onsort,
    search = true,
    sortable: sorting = mode === 'dock' || gathering,
    state = reactive({ active: false }),
    ...attributes
}: A) => {
    let cells: HTMLElement | undefined,
        dock = mode === 'dock',
        entries = items instanceof ReactiveArray ? items : new ReactiveArray(items),
        // The bar has grown to the drawer: a frame behind 'state.active' while opening, so it starts from its own box,
        // and with it while closing.
        expanded = reactive({ active: false }),
        field: HTMLInputElement | undefined,
        // The bar's own box while it morphs to and from the drawer: lengths, since 'auto' doesn't transition, set only
        // from opening until it has landed back. 'morphing' turns the transitions on a frame after 'sized' pins the
        // bar's box, so the pin itself (a pill's '999px' rounding held to what it draws) is instant.
        fit = reactive({ height: 0, morphing: false, radius: 0, sized: false, width: 0 }),
        // A group's panel: whether it shows, and where on the bar it opens from, the middle of the group's slot.
        folder = reactive({ active: false, x: 0, y: 0 }),
        frame = 0,
        // An alphabetical drawer's headings, by letter, which the rail scrolls to.
        headings: HTMLElement[] = [],
        // Also the name the bar, the drawer and the groups' panels trade buttons under.
        id = `toolbar-${++uid}`,
        // The drawer's search, and the button the keys rest on among those it shows: none (-1) until an arrow picks one.
        launch = reactive({ index: -1, query: '' }),
        // Kept per button rather than per render, since moving between lists renders it afresh.
        launching = new WeakMap<Button, { launching: boolean }>(),
        marker = entries.indexOf(TOOLBAR_DRAWER),
        // Shows the buttons off the page for as long as 'measure()' reads them.
        measuring = reactive({ active: false }),
        more = mode === 'dock' ? 'All apps' : 'More',
        // Each group's name as its panel edits it, which every place the name shows follows.
        names = new WeakMap<Group, { editing: boolean, saved: boolean, value: string }>(),
        // The bar's group button its panel opened from, which takes focus back as it closes.
        opener: HTMLElement | undefined,
        panel: HTMLElement | undefined,
        // The rail's letter under the pointer, none (-1) once it leaves.
        pointed = signal(-1),
        popup = drawn && overlay.popup({ state, target: surface }),
        // The bar's own box, which it grows from and lands back on.
        resting = { height: 0, radius: 0, width: 0 },
        running = new WeakMap<Button, { running: boolean }>(),
        // The page of buttons the bar shows: the first, and how many fit (none while they all do). 'order' moves with
        // every sort, which can reorder the bar without changing its length.
        scroll = reactive({ count: 0, first: 0, order: 0 }),
        // The frame of a glide to a letter.
        scrolling = 0,
        // A group's panel.
        sheet: HTMLElement | undefined,
        shelf: HTMLElement | undefined,
        // The drawer's buttons.
        stash = drawn ? (apps instanceof ReactiveArray ? apps : new ReactiveArray(apps ?? [])) : undefined,
        // Each drawer button's element, for the keys to find the one above or below it.
        tiles = new WeakMap<Button, HTMLElement>(),
        track: HTMLElement | undefined,
        // The groups a panel has opened into, from the bar's: it shows the last.
        trail = signal<Group[]>([]),
        vertical = direction === 'e' || direction === 'w',
        viewport: HTMLElement | undefined,
        // An alphabetical drawer's letter and place for each of its buttons.
        alphabet = alphabetical && stash ? computed(() => alphabetize(stash)) : undefined,
        // The letters an alphabetical drawer shows any button under, after its search.
        filled = alphabet && computed(() => {
            let letters = new Set<number>(),
                list = shown(),
                places = read(alphabet);

            for (let i = 0, n = list.length; i < n; i++) {
                letters.add(places.get(list[i])!.letter);
            }

            return letters;
        });

    // The button in the next row up or down whose middle is nearest across. Rows are read from the layout, since an
    // alphabetical drawer's headings break them wherever the letter changes. Where there is none, the keys stay put.
    function across(list: Button[], from: number, row: -1 | 1) {
        let origin = tiles.get(list[from])?.getBoundingClientRect();

        if (!origin) {
            return from;
        }

        let best = from,
            distance = Infinity,
            middle = origin.left + origin.width / 2,
            nearest = Infinity,
            rects: (DOMRect | undefined)[] = [];

        for (let i = 0, n = list.length; i < n; i++) {
            let rect = rects[i] = tiles.get(list[i])?.getBoundingClientRect(),
                offset = rect ? (rect.top - origin.top) * row : 0;

            // A row away, not the same row drawn a pixel off.
            if (offset > 1) {
                nearest = Math.min(nearest, offset);
            }
        }

        for (let i = 0, n = list.length; i < n; i++) {
            let rect = rects[i];

            if (!rect || Math.abs((rect.top - origin.top) * row - nearest) > 1) {
                continue;
            }

            let gap = Math.abs(rect.left + rect.width / 2 - middle);

            if (gap < distance) {
                best = i;
                distance = gap;
            }
        }

        return best;
    }

    // Whether a dragged entry can group with the member an element shows: a button or a group, held over another,
    // and never a group over something inside itself.
    function admits(entry: Entry, element: HTMLElement) {
        let target = (element as Slot)[MEMBER];

        return movable(entry) && !!target && target !== entry && !(grouped(entry) && contains(entry, target));
    }

    // Lines an alphabetical drawer's headings and first column of buttons up with the search's magnifier, which the
    // search places once it has measured itself. Skipped while the drawer is out of the layout.
    function align() {
        let glass = field?.parentElement?.querySelector('.group-item--overlay.icon');

        if (!alphabet || !cells?.offsetWidth || !glass || !panel) {
            return;
        }

        // Written synchronously, so 'grow()' measures the updated layout.
        panel.style.setProperty('--toolbar-drawer-inset', `${glass.getBoundingClientRect().left - cells.getBoundingClientRect().left}px`);
    }

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
                ${sprite(chevron, ARROWS[vertical ? 'vertical' : 'horizontal'][step < 0 ? 0 : 1])}
            </button>
        `;
    }

    // A group's button. On the bar it opens the group's panel; in a panel, it opens the group in the panel's place.
    function bunch(member: Group, nested: boolean) {
        return html`
            <button
                aria-controls='${id}-group'
                aria-haspopup='dialog'
                class='button button--feedback toolbar-button toolbar-button--group'
                type='button'
                ${{
                    'aria-expanded': () => !nested && folder.active && read(trail)[0] === member ? 'true' : 'false',
                    'aria-label': () => `${naming(member).value || 'Group'}, ${member.items.$length} items`,
                    onclick: (e: MouseEvent) => {
                        reveal(member, e.currentTarget as HTMLElement, nested, e.detail === 0);
                    }
                }}
            >
                ${preview(member)}
            </button>
        `;
    }

    // Back to the bar: the drawer's contents leave and the bar shrinks onto its buttons.
    function collapse() {
        cancelAnimationFrame(frame);
        expanded.active = false;
        land();
    }

    // Groups a dragged member with the one it was let go on: at a group's end, or with a button, as a new
    // group in the button's place.
    function combine(entry: Entry, element: HTMLElement, items: ReactiveArray<Entry>, from: number, source: ReactiveArray<Entry>) {
        let target = (element as Slot)[MEMBER];

        if (!target || !movable(entry)) {
            return;
        }

        if (grouped(target)) {
            target.items.push(entry);
            sorted(entry, from, target.items.length - 1, source, target.items);
        }
        else {
            let made = group({ items: [target, entry] });

            items.splice(items.indexOf(target), 1, made);
            sorted(entry, from, 1, source, made.items);
        }

        tidy();
    }

    // A group's card in its panel: its name, edited in place, over a grid of its members sorted by dragging.
    function contents(current: Group) {
        let list = sortable(current.items, (member, attributes) => html`
                <div
                    class='toolbar-app'
                    ${attributes}
                    ${{
                        onclick: relay,
                        onconnect: (element: Slot) => {
                            element[MEMBER] = member;
                        }
                    }}
                >
                    ${grouped(member) ? bunch(member, true) : control(member)}
                    <span class='toolbar-app-label'>${() => grouped(member) ? naming(member).value : text(member.label)}</span>
                </div>
            `, { combine: combining as SortableCombine<Member> | undefined, drag: tile, group: id, onland: landed, onlift: lifted, onsort: sorted, onthrow: stash ? thrown : undefined });

        return html`
            <div class='toolbar-group-header'>
                ${inlineEdit({
                    class: 'toolbar-group-name',
                    label: 'Group name',
                    onsave: (value: string) => {
                        current.label = value;
                        onrename?.(current, value);
                    },
                    placeholder: 'Name',
                    state: naming(current)
                })}
            </div>
            <div
                class='toolbar-group-apps'
                ${list.attributes}
                ${{ style: () => `--columns: ${Math.min(Math.max(current.items.$length, 2), 4)};` }}
            >
                ${list.render()}
            </div>
        `;
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
                    aria-controls='${id}-drawer'
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
            // Without a search, the drawer itself takes focus and the keys. Kept out of the literal below, which
            // compiles each handler to a listener even when unset.
            keys: Attributes = search ? {} : { onkeydown: navigate, tabindex: '-1' },
            library = sortable(apps, (item, attributes) => html`
                <div
                    class='toolbar-app'
                    ${sorting ? attributes : {}}
                    ${{
                        class: [() => !matches(item) && 'toolbar-app--hidden', () => signal.selector(current, item) && '--active'],
                        onclick: relay,
                        onconnect: (element: HTMLElement) => {
                            tiles.set(item, element);
                        },
                        style: () => {
                            // Unset for the moment a button dragged out of the drawer still shows there.
                            let at = alphabet && read(alphabet).get(item);

                            return at && `--toolbar-order: ${place(at.letter, at.rank)};`;
                        }
                    }}
                >
                    ${control(item)}
                    <span class='toolbar-app-label'>${item.label}</span>
                </div>
            `, {
                drag: tile,
                group: id,
                onland: () => {
                    lift(false);
                    tidy();
                },
                onlift: () => lift(true),
                onsort: sorted
            });

        effect(() => {
            write(current, shown()[selected()]);
        });

        // Every opening starts afresh, on all the buttons, with the keys going to the drawer, and grows the bar into
        // it; every close shrinks it back.
        effect(() => state.active, (open) => {
            if (!open) {
                write(pointed, -1);
                collapse();
                return;
            }

            launch.index = -1;
            launch.query = '';
            shut();
            expand();
        });

        return html`
            <div
                aria-label='${more}'
                class='tooltip-content toolbar-drawer ${alphabet && 'toolbar-drawer--alphabetical'}'
                id='${id}-drawer'
                role='dialog'
                ${keys}
                ${{
                    // Followed while open, so a search that changes its rows resizes the bar around them.
                    onconnect: (element: HTMLElement) => {
                        let resize = observer(() => {
                            align();

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
                            ${searchbox.input({
                                class: 'input--border toolbar-drawer-input',
                                oninput: (e: Event) => {
                                    launch.index = -1;
                                    launch.query = (e.target as HTMLInputElement).value;
                                },
                                onconnect: (element: HTMLInputElement) => {
                                    field = element;
                                },
                                onkeydown: navigate,
                                spellcheck: false,
                                value: () => launch.query
                            })}
                        </div>
                    `}

                    <div class='toolbar-drawer-main'>
                        <div class='toolbar-drawer-view' ${scrollbar({ fade: true })}>
                            <div
                                class='toolbar-drawer-apps'
                                ${sorting && library.attributes}
                                ${{
                                    onconnect: (element: HTMLElement) => {
                                        cells = element;
                                    },
                                    // Taking the scroll back from a glide still under way.
                                    onwheel: () => {
                                        cancelAnimationFrame(scrolling);
                                    }
                                }}
                            >
                                ${library.render()}
                                ${filled && LETTERS.map((letter, index) => html`
                                    <div
                                        aria-hidden='true'
                                        class='toolbar-drawer-heading'
                                        ${{
                                            class: () => !read(filled).has(index) && 'toolbar-drawer-heading--hidden',
                                            onconnect: (element: HTMLElement) => {
                                                headings[index] = element;
                                            },
                                            style: () => `--toolbar-order: ${place(index)};`
                                        }}
                                    >
                                        ${letter}
                                    </div>
                                `)}
                            </div>
                            ${() => !shown().length && html`
                                <p class='toolbar-drawer-empty' role='status'>${launch.query.trim() ? 'No results' : 'Nothing here'}</p>
                            `}
                        </div>
                        ${filled && rail(filled)}
                    </div>
                </div>

                <div aria-hidden='true' class='toolbar-drawer-footer'>
                    ${hint(['esc'], 'Close')}
                    ${hint(['icon--left', '', 'icon--up', 'icon--down'].map((direction) => sprite(arrowSvg, `toolbar-drawer-kbd-icon ${direction}`)), 'Navigate')}
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
                align();
                grow();
                (field ?? panel)?.focus({ preventScroll: true });
            });
        });
    }

    // Scrolls the drawer to a letter's heading, or with nothing under it, to the nearest letter after it that has
    // anything (before it, past the last). Eased, and retargeted from wherever a glide already under way has got to.
    function glide(letter: number, letters: Set<number>) {
        let target = -1;

        for (let i = letter, n = LETTERS.length; i < n && target === -1; i++) {
            if (letters.has(i)) {
                target = i;
            }
        }

        for (let i = letter - 1; i >= 0 && target === -1; i--) {
            if (letters.has(i)) {
                target = i;
            }
        }

        let heading = headings[target],
            view = cells?.parentElement;

        if (!cells || !heading || !view) {
            return;
        }

        // The heading where the first one rests, at the top of the grid's padding.
        let duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : GLIDE,
            from = view.scrollTop,
            start = performance.now(),
            to = Math.max(0, Math.min(
                heading.getBoundingClientRect().top - view.getBoundingClientRect().top + from - (parseFloat(getComputedStyle(cells).paddingTop) || 0),
                view.scrollHeight - view.clientHeight
            ));

        let tick = (now: number) => {
            let progress = duration ? Math.min((now - start) / duration, 1) : 1;

            view.scrollTop = from + (to - from) * (1 - (1 - progress) ** 3);

            if (progress < 1) {
                scrolling = requestAnimationFrame(tick);
            }
        };

        cancelAnimationFrame(scrolling);
        tick(start);
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

    // Back to the bar's box, released once there so it sizes itself again. Closed before it grew, or with no morph to
    // run (reduced motion), no transition ends to say so, so it lets go at once.
    function land() {
        if (!fit.sized) {
            return;
        }

        if (
            (fit.height === resting.height && fit.width === resting.width) ||
            !shelf ||
            !parseFloat(getComputedStyle(shelf).getPropertyValue('--morph-duration'))
        ) {
            release();
            return;
        }

        Object.assign(fit, resting);
    }

    // A button carried out of a group's panel has landed. Let go off every list without a drawer to go back to, it
    // landed back in the group, which opens again to show it.
    function landed(member: Member) {
        let path = read(trail);

        removeEventListener('pointermove', stray);
        tidy();

        if (!folder.active && path.length && path[path.length - 1].items.includes(member)) {
            folder.active = true;
        }
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

    // Lifted out of a group's panel: the panel closes once the pointer carries it away. Listened for only while it is
    // carried, rather than bound for the bar's whole life, since it runs on every move.
    function lifted() {
        addEventListener('pointermove', stray);
    }

    function matches(item: Button) {
        // A group dropped in the drawer is spread out as it lands.
        if (grouped(item)) {
            return true;
        }

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

    // A group's name as its panel's inline edit holds it, kept per group: the edit's own state, so the bar, the trail
    // and the hover label follow it as it changes. Unnamed, it is ''.
    function naming(member: Group) {
        let current = names.get(member);

        if (!current) {
            current = reactive({ editing: false, saved: false, value: member.label ? text(member.label) : '' });
            names.set(member, current);
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
            row = ({ ArrowDown: 1, ArrowUp: -1 } as Record<string, -1 | 1>)[e.key],
            step = ({ ArrowLeft: -1, ArrowRight: 1 } as Record<string, number>)[e.key];

        if (row || step) {
            e.preventDefault();

            if (list.length) {
                launch.index = launch.index < 0
                    ? 0
                    : row ? across(list, selected(), row) : Math.min(Math.max(selected() + step, 0), list.length - 1);

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

    // Pressing a button closes the drawer and any group's panel; in a dock, it also launches the app.
    function open(item: Button) {
        state.active = false;
        shut();

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

    // A group's panel, beside the bar over the group's slot. Opened into a group inside, the groups on the way there
    // list above it as a menu panel under its sub-panel, the nearest last, each row going back to its group when
    // pressed. It stays in the page while closed, since a button carried out of it is still its to land, and closes on
    // a press anywhere off the bar, or Escape.
    function pane() {
        return html`
            <div
                class='toolbar-group'
                id='${id}-group'
                role='dialog'
                ${{
                    'aria-label': () => {
                        let path = read(trail),
                            current = path[path.length - 1];

                        return (current && naming(current).value) || 'Group';
                    },
                    class: () => folder.active && '--active',
                    inert: () => !folder.active,
                    onconnect: (element: HTMLElement) => {
                        sheet = element;
                    },
                    ondocumentkeydown: (e: KeyboardEvent) => {
                        if (e.key === 'Escape' && folder.active && !e.defaultPrevented) {
                            e.preventDefault();
                            shut(true);
                        }
                    },
                    ondocumentpointerdown: (e: PointerEvent) => {
                        if (folder.active && !shelf?.contains(e.target as Node | null)) {
                            shut();
                        }
                    },
                    style: () => `--group-x: ${folder.x}px; --group-y: ${folder.y}px;`
                }}
            >
                ${() => {
                    let path = read(trail);

                    if (path.length < 2) {
                        return '';
                    }

                    return html`
                        <div class='toolbar-group-trail'>
                            ${path.slice(0, -1).map((member, index) => html`
                                <button
                                    class='toolbar-group-trail-item'
                                    type='button'
                                    ${{
                                        'aria-label': () => `Back to ${naming(member).value || 'Group'}`,
                                        onclick: () => {
                                            write(trail, path.slice(0, index + 1));
                                        }
                                    }}
                                >
                                    <span class='toolbar-group-trail-name'>${() => naming(member).value || 'Group'}</span>
                                </button>
                            `)}
                        </div>
                    `;
                }}
                <div class='toolbar-group-card ${() => read(trail).length > 1 && 'toolbar-group-card--nested'}'>
                    ${() => {
                        let path = read(trail),
                            current = path[path.length - 1];

                        return current && contents(current);
                    }}
                </div>
            </div>
        `;
    }

    // Where a heading, or a button under it, falls in an alphabetical drawer: each letter's heading, then its buttons
    // in order. Laid out by CSS 'order', so the drawer's own order stays the consumer's.
    function place(letter: number, rank = -1) {
        return letter * ((stash?.$length ?? 0) + 1) + rank + 1;
    }

    // Groups down to one member give way to it, in their place, and empty ones go, deepest first.
    function prune<T>(items: ReactiveArray<T>) {
        for (let i = items.length - 1; i >= 0; i--) {
            let entry = items[i];

            if (!grouped(entry)) {
                continue;
            }

            prune(entry.items);

            if (entry.items.length > 1) {
                continue;
            }

            items.splice(i, 1);

            if (entry.items.length) {
                let only = entry.items[0];

                entry.items.splice(0, 1);
                items.splice(i, 0, only as T);
                sorted(only, 0, i, entry.items, items);
            }
        }
    }

    // The letters beside an alphabetical drawer. The pointer's letter is read from where it falls along the rail, which
    // the letters share evenly, so a touch dragged along it scrubs as a mouse does, and their swell moves none of them.
    // Hidden from assistive tech, which has the search to find a button by name.
    function rail(letters: NonNullable<typeof filled>) {
        let element: HTMLElement | undefined;

        function leave() {
            write(pointed, -1);
        }

        function point(e: PointerEvent) {
            let first = element?.firstElementChild,
                last = element?.lastElementChild;

            if (!first || !last) {
                return;
            }

            // From the first letter's top to the last's bottom, inside the rail's padding.
            let top = first.getBoundingClientRect().top,
                height = last.getBoundingClientRect().bottom - top,
                letter = Math.max(0, Math.min(Math.floor((e.clientY - top) / height * LETTERS.length), LETTERS.length - 1));

            if (letter === read(pointed)) {
                return;
            }

            write(pointed, letter);
            glide(letter, read(letters));
        }

        return html`
            <div
                aria-hidden='true'
                class='toolbar-rail'
                ${{
                    onconnect: (connected: HTMLElement) => {
                        element = connected;
                    },
                    onpointercancel: leave,
                    onpointerdown: (e: PointerEvent) => {
                        // Held by a touch, which would otherwise leave it at the first letter it crosses.
                        if (e.pointerType !== 'mouse') {
                            element?.setPointerCapture(e.pointerId);
                        }

                        point(e);
                    },
                    onpointerleave: leave,
                    onpointermove: point,
                    onpointerup: (e: PointerEvent) => {
                        if (e.pointerType !== 'mouse') {
                            leave();
                        }
                    }
                }}
            >
                ${LETTERS.map((letter, index) => html`
                    <span
                        class='toolbar-rail-letter'
                        ${{ class: [() => !read(letters).has(index) && 'toolbar-rail-letter--empty', () => signal.selector(pointed, index) && '--active'] }}
                    >
                        ${letter}
                    </span>
                `)}
            </div>
        `;
    }

    // The bar sizes itself again.
    function release() {
        fit.morphing = false;
        fit.sized = false;
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

    // Opens a group's panel. From the bar it opens over the group's slot, and closes again on a second press; from a
    // panel, the group opens in the panel's place, with a way back. Opened by the keys, they move into it.
    function reveal(member: Group, button: HTMLElement, nested: boolean, keyed: boolean) {
        if (nested) {
            write(trail, [...read(trail), member]);
        }
        else if (folder.active && read(trail)[0] === member) {
            shut();
            return;
        }
        else if (shelf) {
            let bar = shelf.getBoundingClientRect(),
                slot = (button.closest('.toolbar-item') ?? button).getBoundingClientRect();

            state.active = false;
            opener = button;
            folder.x = slot.left + slot.width / 2 - bar.left;
            folder.y = slot.top + slot.height / 2 - bar.top;
            write(trail, [member]);
            folder.active = true;
        }

        if (keyed) {
            requestAnimationFrame(() => {
                sheet?.querySelector<HTMLElement>('.toolbar-app > .toolbar-button')?.focus();
            });
        }
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

    function selected() {
        return launch.index < 0 ? -1 : Math.min(launch.index, shown().length - 1);
    }

    function shown() {
        if (!stash) {
            return [];
        }

        stash.$length;

        let list = stash.filter(matches);

        if (alphabet) {
            let places = read(alphabet);

            list.sort((a, b) => places.get(a)!.rank - places.get(b)!.rank);
        }

        return list;
    }

    // Closes a group's panel; closed by the keys, focus goes back to the group's button on the bar.
    function shut(restore = false) {
        if (!folder.active) {
            return;
        }

        folder.active = false;

        if (restore && sheet?.contains(document.activeElement)) {
            opener?.focus();
        }
    }

    // Dividers, custom items and the drawer's button sort with the rest, but only buttons and groups are dragged.
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

        // A group is named by its panel, as it is edited; unnamed, it has no hover label.
        let named = grouped(entry) ? () => naming(entry).value : undefined;

        return html`
            <div
                class='toolbar-item'
                ${sorting ? attributes : {}}
                ${{
                    class: [() => hidden(entry) && 'toolbar-item--hidden', () => named && !named() && 'toolbar-item--quiet'],
                    onclick: relay,
                    onconnect: (element: Slot) => {
                        element[LABEL] = named ?? (grouped(entry) ? '' : entry.hint ?? entry.label);
                        element[MEMBER] = entry;
                    }
                }}
            >
                ${grouped(entry) ? bunch(entry, false) : control(entry)}
                ${labels && html`<span class='toolbar-item-label'>${named ?? entry.label}</span>`}
                ${dock && !grouped(entry) && html`<span aria-hidden='true' class='toolbar-light ${() => status(entry).running && '--active'}'></span>`}
            </div>
        `;
    }

    // Shared by the bar's list, the drawer's and the groups', whose arrays trade entries; either end of a move can be
    // any of them.
    function sorted<S, T>(item: Entry, from: number, to: number, source: ReactiveArray<S>, target: ReactiveArray<T>) {
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

    // Carrying a button out of a group's panel closes the panel once the pointer is clear of it, leaving the bar free
    // to drop on.
    function stray(e: PointerEvent) {
        let box = sheet?.getBoundingClientRect();

        if (box && (e.clientX < box.left - SLACK || e.clientX > box.right + SLACK || e.clientY < box.top - SLACK || e.clientY > box.bottom + SLACK)) {
            removeEventListener('pointermove', stray);
            shut();
        }
    }

    // Thrown off the bar or out of a group's panel, a button goes back to the drawer, at its end; a group spreads its
    // buttons there.
    function thrown<T>(item: Entry, from: number, list: ReactiveArray<T>) {
        if (!stash || !movable(item)) {
            return;
        }

        let spread = buttons(item);

        for (let i = 0, n = spread.length; i < n; i++) {
            stash.push(spread[i]);
        }

        sorted(item, from, stash.length - 1, list, stash);
        tidy();
    }

    // After every move: a group down to one member gives way to it, the drawer spreads out any group dropped in it,
    // since it only holds buttons, and a panel whose group has gone falls back to what remains of its way in.
    function tidy() {
        prune(entries);

        if (stash) {
            for (let i = stash.length - 1; i >= 0; i--) {
                let item: Member = stash[i];

                if (grouped(item)) {
                    stash.splice(i, 1, ...buttons(item));
                }
            }
        }

        let kept = 0,
            path = read(trail);

        while (kept < path.length && (kept === 0 ? entries : path[kept - 1].items).includes(path[kept])) {
            kept++;
        }

        if (kept === path.length) {
            return;
        }

        write(trail, path.slice(0, kept));

        if (!kept) {
            shut();
        }
    }

    if (!stash && marker !== -1) {
        entries.splice(marker, 1);
    }
    else if (stash && marker === -1) {
        entries.push(TOOLBAR_DRAWER);
    }

    // One label glides between the buttons; hidden from assistive tech, since each button is already named by it. Only
    // buttons and groups are dragged, so 'copy' only ever gets one, and only those are ever thrown back to the drawer.
    // Dragging a group whose panel shows closes the panel, which could otherwise take the group into itself.
    let combining: SortableCombine<Entry> | undefined = gathering ? { accepts: admits, oncombine: combine } : undefined,
        list = sortable(entries, slot, {
            combine: combining,
            drag: copy as (item: Entry) => Renderable<unknown>,
            group: id,
            onland: tidy,
            onlift: (entry) => {
                if (grouped(entry) && read(trail).includes(entry)) {
                    shut();
                }
            },
            onsort: sorted,
            onthrow: sorting && stash ? thrown : undefined
        }),
        tip = tooltip.shared({ 'aria-hidden': 'true', axis: vertical ? 'x' : 'y', class: 'toolbar-label', delay: { open: delay }, swap: false });

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
            class='toolbar toolbar--${direction} ${labels && 'toolbar--labels'} ${stash && 'tooltip'}'
            ${attributes}
            ${!labels && tip.delegate({ content: name, edge: true, selector: '.toolbar-item:not(.toolbar-item--quiet), .toolbar-custom--hinted' })}
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
                        release();
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
            ${pane()}
        </div>
    `;
};


export default component(toolbar, { button, divider, drawer, group, item });
export type { Button, Custom, Direction, Divider, Entry, Group, Member, Mode };
