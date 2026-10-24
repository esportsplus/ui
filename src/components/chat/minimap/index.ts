import { effect, onCleanup, reactive, ReactiveArray, untrack } from '@esportsplus/reactivity';
import { component, html, type Attributes } from '@esportsplus/template';
import { lead, step, type Range } from './model';
import icon from '~/components/icon';
import tooltip from '~/components/tooltip';
import subscribe from '~/shared/subscribe';
import down from '@esportsplus/ui/svg/chevron-down.svg';
import up from '@esportsplus/ui/svg/chevron-up.svg';
import spy from './spy';
import './scss/index.scss';


type ChatMinimapAttributes = Attributes & {
    [CHAT_MINIMAP_CARD]?: Attributes;
    [CHAT_MINIMAP_DESCRIPTION]?: Attributes;
    [CHAT_MINIMAP_ITEM]?: Attributes;
    [CHAT_MINIMAP_ITEMS]?: Attributes;
    [CHAT_MINIMAP_LABEL]?: Attributes;
    [CHAT_MINIMAP_LINE]?: Attributes;
    [CHAT_MINIMAP_NAV]?: Attributes;
    [CHAT_MINIMAP_PREVIEW]?: Attributes;
    [CHAT_MINIMAP_TITLE]?: Attributes;
    label?: string;
    next?: string;
    // Called with the turn to bring to the top of the thread, from a line or the previous and next buttons; without
    // it, those just move 'state' there.
    onnavigate?: (index: number) => void;
    previous?: string;
    side?: Side;
    state?: Range;
    // A ReactiveArray grows the rail as the conversation does.
    turns: ReactiveArray<Turn> | Turn[];
};

type Item = HTMLElement & { [TURN]: Turn };

type Side = 'left' | 'right';

type Turn = {
    // Clamped to two lines in the card.
    description?: string;
    // The card's heading and the line's accessible name.
    title: string;
};


const CHAT_MINIMAP_CARD = Symbol.for('@esportsplus/ui/chat-minimap.card');

const CHAT_MINIMAP_DESCRIPTION = Symbol.for('@esportsplus/ui/chat-minimap.description');

const CHAT_MINIMAP_ITEM = Symbol.for('@esportsplus/ui/chat-minimap.item');

const CHAT_MINIMAP_ITEMS = Symbol.for('@esportsplus/ui/chat-minimap.items');

// The previous and next buttons' tooltips.
const CHAT_MINIMAP_LABEL = Symbol.for('@esportsplus/ui/chat-minimap.label');

const CHAT_MINIMAP_LINE = Symbol.for('@esportsplus/ui/chat-minimap.line');

// The previous and next buttons.
const CHAT_MINIMAP_NAV = Symbol.for('@esportsplus/ui/chat-minimap.nav');

// The shared tooltip the card shows in.
const CHAT_MINIMAP_PREVIEW = Symbol.for('@esportsplus/ui/chat-minimap.preview');

const CHAT_MINIMAP_TITLE = Symbol.for('@esportsplus/ui/chat-minimap.title');

// The card's first open waits a beat so a pointer crossing the rail doesn't flash one; it then glides between lines.
const DELAY = { close: 150, open: 100 };

const TURN = Symbol();


let uid = 0;


function itemFrom(target: EventTarget | null) {
    return (target as HTMLElement | null)?.closest<Item>('.chat-minimap-item') ?? null;
}

function template({ label = 'Conversation turns', next = 'Next turn', onnavigate, previous = 'Previous turn', side = 'right', state = reactive({ end: 0, start: 0 }), turns, ...attributes }: ChatMinimapAttributes) {
    let card = tooltip.shared({ delay: DELAY, direction: side === 'left' ? 'w' : 'e' }),
        id = `chat-minimap-${++uid}`,
        items = new Map<Turn, Item>(),
        list = turns instanceof ReactiveArray ? turns : new ReactiveArray(turns),
        local = reactive({ focus: -1, total: 0, version: 0 }),
        positions = new Map<Turn, number>(),
        tips = { next: tooltip.shared({ direction: 's' }), previous: tooltip.shared({ direction: 'n' }) };

    function bubble() {
        return { 'aria-hidden': 'true', ...attributes[CHAT_MINIMAP_LABEL], class: ['chat-minimap-label', attributes[CHAT_MINIMAP_LABEL]?.class ?? []].flat() };
    }

    function index(turn: Turn) {
        // Read so every line re-checks its place when the list changes.
        local.version;

        return positions.get(turn) ?? -1;
    }

    function move(to: number) {
        let target = Math.max(0, Math.min(to, local.total - 1));

        local.focus = target;
        items.get(list[target])?.focus();
    }

    function nav(direction: -1 | 1) {
        let disabled = () => step(direction, state, local.total) === -1,
            tip = direction === -1 ? tips.previous : tips.next,
            text = direction === -1 ? previous : next;

        return html`
            <button
                aria-label='${text}'
                class='chat-minimap-nav ${`chat-minimap-nav--${direction === -1 ? 'previous' : 'next'}`}'
                type='button'
                ${attributes[CHAT_MINIMAP_NAV]}
                ${tip.bind(text)}
                ${{
                    disabled,
                    onclick: () => {
                        select(step(direction, state, local.total));
                    },
                    // Reaching the end disables the button under the pointer, which then never sees it leave.
                    onconnect: () => {
                        effect(() => {
                            if (disabled()) {
                                untrack(tip.close);
                            }
                        });
                    }
                }}
            >
                ${icon({ 'aria-hidden': 'true', class: 'chat-minimap-nav-icon' }, direction === -1 ? up : down)}
            </button>
        `;
    }

    function renumber() {
        positions.clear();

        for (let i = 0, n = list.length; i < n; i++) {
            positions.set(list[i], i);
        }

        local.total = list.length;
        local.version++;
    }

    function select(target: number) {
        if (target < 0 || target >= local.total) {
            return;
        }

        if (onnavigate) {
            onnavigate(target);
            return;
        }

        let range = lead(target, state, local.total);

        state.end = range.end;
        state.start = range.start;
    }

    // The roving tab stop: the last line focused or, until one has been, the first turn in view.
    function stop() {
        let focus = local.focus;

        return focus === -1 || focus >= local.total ? Math.min(state.start, local.total - 1) : focus;
    }

    // Its focus handler runs from the rail's own, which also tracks the tab stop: two spreads can't share an event.
    let { onfocusin: reveal, ...delegate } = card.delegate({
        content: (trigger) => {
            let turn = (trigger as Item)[TURN];

            return html`
                <span class='chat-minimap-card' ${attributes[CHAT_MINIMAP_CARD]}>
                    <span class='chat-minimap-title' ${attributes[CHAT_MINIMAP_TITLE]}>${turn.title}</span>
                    ${turn.description ? html`<span class='chat-minimap-description' ${attributes[CHAT_MINIMAP_DESCRIPTION]}>${turn.description}</span>` : ''}
                </span>
            `;
        },
        selector: '.chat-minimap-item'
    }) as Attributes & { onfocusin: (this: HTMLElement, e: FocusEvent) => void };

    renumber();

    // The card stays out of the accessibility tree: each line is named by its title and described by its own hidden
    // description, which the card only repeats.
    return html`
        <nav
            class='chat-minimap ${`chat-minimap--${side}`}'
            ${attributes}
            ${{
                'aria-label': label,
                onconnect: () => {
                    onCleanup(subscribe(list, renumber));
                    renumber();
                }
            }}
        >
            ${nav(-1)}

            <div
                class='chat-minimap-items'
                ${attributes[CHAT_MINIMAP_ITEMS]}
                ${delegate}
                ${{
                    onfocusin: (e: FocusEvent) => {
                        let item = itemFrom(e.target);

                        if (item) {
                            local.focus = index(item[TURN]);
                        }

                        reveal.call(e.currentTarget as HTMLElement, e);
                    },
                    onkeydown: (e: KeyboardEvent) => {
                        let item = itemFrom(e.target);

                        if (!item) {
                            return;
                        }

                        let i = index(item[TURN]),
                            to = ({
                                ArrowDown: i + 1,
                                ArrowUp: i - 1,
                                End: local.total - 1,
                                Home: 0
                            } as Record<string, number>)[e.key];

                        if (to === undefined) {
                            return;
                        }

                        e.preventDefault();
                        move(to);
                    }
                }}
            >
                ${html.reactive(list, (turn) => {
                    let description = `${id}-${++uid}`;

                    return html`
                        <button
                            aria-label='${turn.title}'
                            class='chat-minimap-item'
                            type='button'
                            ${attributes[CHAT_MINIMAP_ITEM]}
                            ${{
                                'aria-describedby': turn.description ? description : undefined,
                                class: () => {
                                    let i = index(turn);

                                    return i >= state.start && i < state.end && '--active';
                                },
                                onclick: () => {
                                    select(index(turn));
                                },
                                onconnect: (element: Item) => {
                                    element[TURN] = turn;
                                    items.set(turn, element);
                                },
                                ondisconnect: (element: Item) => {
                                    if (items.get(turn) === element) {
                                        items.delete(turn);
                                    }
                                },
                                tabindex: () => index(turn) === stop() ? '0' : '-1'
                            }}
                        >
                            <span aria-hidden='true' class='chat-minimap-line' ${attributes[CHAT_MINIMAP_LINE]}></span>
                            ${turn.description ? html`<span class='chat-minimap-hidden' id='${description}'>${turn.description}</span>` : ''}
                        </button>
                    `;
                })}
            </div>

            ${nav(1)}

            ${card.render({ 'aria-hidden': 'true', ...attributes[CHAT_MINIMAP_PREVIEW], class: ['chat-minimap-preview', attributes[CHAT_MINIMAP_PREVIEW]?.class ?? []].flat() })}
            ${tips.previous.render(bubble())}
            ${tips.next.render(bubble())}
        </nav>
    `;
}


export default component(template, {
    card: CHAT_MINIMAP_CARD,
    description: CHAT_MINIMAP_DESCRIPTION,
    item: CHAT_MINIMAP_ITEM,
    items: CHAT_MINIMAP_ITEMS,
    label: CHAT_MINIMAP_LABEL,
    line: CHAT_MINIMAP_LINE,
    nav: CHAT_MINIMAP_NAV,
    preview: CHAT_MINIMAP_PREVIEW,
    title: CHAT_MINIMAP_TITLE,
    spy
});
export type {
    ChatMinimapAttributes,
    Range as ChatMinimapRange,
    Side as ChatMinimapSide,
    Turn as ChatMinimapTurn
};
