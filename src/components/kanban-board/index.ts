import { reactive } from '@esportsplus/reactivity';
import { html, type Attributes } from '@esportsplus/template';
import counter from '~/components/counter';
import sortable from '~/components/sortable';
import './scss/index.scss';


type A = Attributes & {
    columns: Column[];
    label?: string;
    onfocusin?: never;
    onfocusout?: never;
    onkeydown?: never;
    onpointerdown?: never;
    onsort?: (columns: Column[]) => void;
};

type Card = {
    id: string;
    title: string;
};

type Column = {
    cards: Card[];
    id: string;
    title: string;
};

type Held = {
    before: Element[][];
    item: HTMLElement;
};


const FLIP: KeyframeAnimationOptions = { duration: 300, easing: 'cubic-bezier(0.2, 0, 0, 1)' };


function button(item: Element) {
    return item.querySelector<HTMLElement>('.kanban-board-card')!;
}

// Cards moved from the keyboard glide to their new slot, and their neighbours make room the same way.
function flip(board: HTMLElement, mutate: VoidFunction) {
    let first = new Map<HTMLElement, DOMRect>(),
        items = board.querySelectorAll<HTMLElement>('.kanban-board-item');

    for (let i = 0, n = items.length; i < n; i++) {
        first.set(items[i], items[i].getBoundingClientRect());
    }

    mutate();

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
    }

    for (let [item, start] of first) {
        let rect = item.getBoundingClientRect(),
            x = start.left - rect.left,
            y = start.top - rect.top;

        if (x || y) {
            item.animate([{ translate: `${x}px ${y}px` }, { translate: '0px 0px' }], FLIP);
        }
    }
}


export default ({ columns, label = 'Board', onsort, ...attributes }: A) => {
    let board: HTMLElement | undefined,
        cards = new Map(columns.flatMap((column) => column.cards.map((card) => [card.id, card] as const))),
        counts = columns.map((column) => reactive({ value: column.cards.length })),
        first = columns.flatMap((column) => column.cards)[0]?.id,
        frame = 0,
        group = `kanban-board-${Math.random().toString(36).slice(2)}`,
        held: Held | null = null,
        state = reactive({ announcement: '' });

    function cancel() {
        if (!held) {
            return;
        }

        let { before, item } = held,
            all = lists();

        held = null;
        flip(board!, () => {
            for (let i = 0, n = all.length; i < n; i++) {
                all[i].append(...before[i]);
            }
        });
        release(item);
        focus(item);
        sync();
        state.announcement = `Cancelled. ${title(item)} returned to ${where(item)}.`;
    }

    function drop() {
        if (!held) {
            return;
        }

        let item = held.item;

        held = null;
        release(item);
        state.announcement = `Dropped ${title(item)} in ${where(item)}.`;
    }

    function focus(item: Element) {
        let target = button(item);

        if (document.activeElement !== target) {
            target.focus({ preventScroll: true });
        }
    }

    function lists() {
        return Array.from(board!.querySelectorAll<HTMLElement>('.kanban-board-list'));
    }

    function release(item: HTMLElement) {
        item.classList.remove('--held');
        button(item).removeAttribute('aria-pressed');
    }

    function sync() {
        let all = lists(),
            next = columns.map((column, i) => ({
                ...column,
                cards: Array.from(all[i].children, (item) => cards.get((item as HTMLElement).dataset.id!)!)
            }));

        for (let i = 0, n = next.length; i < n; i++) {
            counts[i].value = next[i].cards.length;
        }

        onsort?.(next);
    }

    function title(item: HTMLElement) {
        return cards.get(item.dataset.id!)?.title ?? '';
    }

    function where(item: HTMLElement) {
        let list = item.parentElement!;

        return `${columns[lists().indexOf(list)].title}, position ${Array.prototype.indexOf.call(list.children, item) + 1} of ${list.children.length}`;
    }

    return html`
        <div
            class='kanban-board'
            aria-label='${label}'
            role='group'
            ${attributes}
            ${{
                onconnect: (element: HTMLElement) => {
                    board = element;
                },
                ondisconnect: () => {
                    cancelAnimationFrame(frame);
                },
                onfocusin: (e: FocusEvent) => {
                    let target = (e.target as Element).closest?.('.kanban-board-card');

                    if (!target) {
                        return;
                    }

                    let buttons = board!.querySelectorAll<HTMLElement>('.kanban-board-card');

                    for (let i = 0, n = buttons.length; i < n; i++) {
                        buttons[i].tabIndex = buttons[i] === target ? 0 : -1;
                    }
                },
                // A card moved between columns is re-inserted and briefly loses focus, so wait a frame
                // before treating the blur as tabbing or clicking away.
                onfocusout: () => {
                    cancelAnimationFrame(frame);
                    frame = requestAnimationFrame(() => {
                        if (held && document.activeElement !== button(held.item)) {
                            drop();
                        }
                    });
                },
                onkeydown: (e: KeyboardEvent) => {
                    let target = (e.target as Element).closest?.('.kanban-board-card');

                    if (!target || board!.querySelector('.sortable.--active')) {
                        return;
                    }

                    let item = target.parentElement as HTMLElement,
                        list = item.parentElement!,
                        all = lists(),
                        column = all.indexOf(list),
                        index = Array.prototype.indexOf.call(list.children, item),
                        isHeld = held?.item === item;

                    function across(step: number) {
                        for (let i = column + step; i >= 0 && i < all.length; i += step) {
                            let children = all[i].children;

                            if (children.length) {
                                focus(children[Math.min(index, children.length - 1)]);
                                return;
                            }
                        }
                    }

                    function move(to: number, position: number) {
                        if (to < 0 || to >= all.length) {
                            return;
                        }

                        let others = Array.from(all[to].children).filter((child) => child !== item),
                            slot = Math.min(Math.max(position, 0), others.length);

                        if (to === column && slot === index) {
                            return;
                        }

                        flip(board!, () => all[to].insertBefore(item, others[slot] ?? null));
                        focus(item);
                        sync();
                        state.announcement = `Moved to ${where(item)}.`;
                    }

                    function toggle() {
                        if (isHeld) {
                            drop();
                            return;
                        }

                        drop();
                        held = { before: all.map((list) => Array.from(list.children)), item };
                        item.classList.add('--held');
                        target!.setAttribute('aria-pressed', 'true');
                        state.announcement = `Picked up ${title(item)}, ${where(item)}.`;
                    }

                    function within(step: number) {
                        let sibling = list.children[index + step];

                        if (sibling) {
                            focus(sibling);
                        }
                    }

                    let keys: Record<string, VoidFunction | undefined> = {
                            ' ': toggle,
                            ArrowDown: () => isHeld ? move(column, index + 1) : within(1),
                            ArrowLeft: () => isHeld ? move(column - 1, index) : across(-1),
                            ArrowRight: () => isHeld ? move(column + 1, index) : across(1),
                            ArrowUp: () => isHeld ? move(column, index - 1) : within(-1),
                            Enter: toggle,
                            Escape: isHeld ? cancel : undefined
                        },
                        run = keys[e.key];

                    if (!run) {
                        return;
                    }

                    e.preventDefault();
                    run();
                },
                onpointerdown: () => {
                    drop();
                }
            }}
        >
            ${columns.map((column, i) => html`
                <div class='kanban-board-column'>
                    <div class='kanban-board-header' aria-hidden='true'>
                        <span>${column.title}</span>
                        ${counter({
                            class: 'kanban-board-count counter--ticker',
                            currency: 'IGNORE',
                            decimals: 0,
                            delay: 0,
                            state: counts[i],
                            value: column.cards.length
                        })}
                    </div>

                    <ul
                        class='kanban-board-list'
                        aria-label='${column.title}'
                        ${sortable({
                            group,
                            onsort: (item) => {
                                sync();
                                state.announcement = `Dropped ${title(item)} to ${where(item)}.`;
                            }
                        })}
                    >
                        ${column.cards.map((card) => html`
                            <li class='kanban-board-item' data-id='${card.id}'>
                                <button
                                    class='kanban-board-card'
                                    aria-describedby='${group}-instructions'
                                    tabindex='${card.id === first ? 0 : -1}'
                                    type='button'
                                >
                                    <span class='kanban-board-card-title'>${card.title}</span>
                                </button>
                            </li>
                        `)}
                    </ul>
                </div>
            `)}

            <p class='kanban-board-sr' id='${group}-instructions'>
                Press Space to pick up. While holding, use the arrow keys to move within or between columns,
                Space to drop, or Escape to cancel.
            </p>
            <p class='kanban-board-sr' aria-atomic='true' aria-live='assertive'>${() => state.announcement}</p>
        </div>
    `;
};


export type { Card, Column };
