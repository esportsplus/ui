import { html, type Attributes, type Renderable } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import './scss/index.scss';


type Card = {
    depth: number;
    dragging: boolean;
    index: number;
    phase: 'drop' | 'idle' | 'leave';
    x: number;
};

type Choice = 'left' | 'right';

type Drag = {
    card: Card;
    locked: boolean;
    pointer: number;
    samples: [number, number][];
    x: number;
    y: number;
};


// Far enough that a leaving card has faded out and cleared the stage before its transition ends.
const DISTANCE = 560;

const LOCK = 6;

const SAMPLE = 100;


export default <T>(
    {
        emptyLabel = 'Deck cleared',
        flick = 520,
        itemLabel,
        items,
        label = 'Card deck',
        leftLabel = 'Skip',
        onDecide,
        onUndo,
        peek = 3,
        rightLabel = 'Keep',
        steps = 6,
        threshold = 92,
        undoLabel = 'Undo',
        ...attributes
    }: Attributes & {
        emptyLabel?: string;
        flick?: number;
        itemLabel: (item: T) => string;
        items: readonly T[];
        label?: string;
        leftLabel?: string;
        onDecide?: (item: T, choice: Choice) => void;
        onUndo?: (item: T) => void;
        peek?: number;
        rightLabel?: string;
        steps?: number;
        threshold?: number;
        undoLabel?: string;
    },
    content: (item: T) => Renderable<unknown>
) => {
    let cards = reactive([] as Card[]),
        decisions: Choice[] = [],
        drag: Drag | null = null,
        grain = Math.max(1, Math.floor(steps)),
        reach = Math.max(1, threshold),
        span = Math.max(1, Math.floor(peek)),
        state = reactive({ dir: 0, index: 0, step: 0 }),
        total = items.length;

    function active(card: Card) {
        return card.depth === 0 && card.phase === 'idle';
    }

    function clear() {
        if (drag) {
            drag.card.dragging = false;
            drag.card.x = 0;
            drag = null;
        }

        state.dir = 0;
        state.step = 0;
    }

    function decide(choice: Choice) {
        if (state.index >= total) {
            return;
        }

        let at = state.index,
            card = find(at);

        decisions.push(choice);
        drag = null;
        state.dir = 0;
        state.index++;
        state.step = 0;

        if (card) {
            card.dragging = false;
            card.phase = 'leave';
            card.x = (choice === 'right' ? 1 : -1) * DISTANCE;
        }

        layout();
        onDecide?.(items[at], choice);
    }

    function find(index: number) {
        for (let i = 0, n = cards.length; i < n; i++) {
            if (cards[i].index === index) {
                return cards[i];
            }
        }
    }

    // Keep one card per index inside the window; everything outside it plays out its exit before removal.
    function layout(entry = 0) {
        let end = Math.min(state.index + span, total);

        for (let i = 0, n = cards.length; i < n; i++) {
            let card = cards[i];

            if (card.phase === 'idle' && (card.index < state.index || card.index >= end)) {
                card.phase = 'drop';
            }
        }

        for (let index = state.index; index < end; index++) {
            let card = find(index);

            if (card) {
                card.depth = index - state.index;
                card.phase = 'idle';
                card.x = 0;
                continue;
            }

            card = reactive({ depth: index - state.index, dragging: false, index, phase: 'idle', x: 0 }) as Card;

            if (index === state.index && entry) {
                card.x = entry * DISTANCE;
                cards.unshift(card);
            }
            else {
                cards.push(card);
            }
        }

        if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
            for (let i = cards.length - 1; i >= 0; i--) {
                if (cards[i].phase !== 'idle') {
                    cards.splice(i, 1);
                }
            }
        }
    }

    function release(dx: number, vx: number) {
        let far = Math.abs(dx) >= reach,
            fast = Math.abs(vx) >= flick && Math.abs(dx) >= reach * 0.35;

        if (!far && !fast) {
            clear();
            return;
        }

        decide((far ? dx : vx) > 0 ? 'right' : 'left');
    }

    function remove(card: Card) {
        let i = cards.indexOf(card);

        if (i !== -1) {
            cards.splice(i, 1);
        }
    }

    function report(dx: number) {
        let step = Math.min(grain, Math.round((Math.abs(dx) / reach) * grain));

        state.dir = step === 0 ? 0 : dx > 0 ? 1 : -1;
        state.step = step;
    }

    function undo() {
        if (state.index === 0) {
            return;
        }

        let choice = decisions.pop();

        clear();
        state.index--;
        layout(choice === 'right' ? 1 : -1);
        onUndo?.(items[state.index]);
    }

    layout();

    let badge = (card: Card, side: -1 | 1, text: string) => html`
            <span
                aria-hidden='true'
                class='swipe-deck-badge swipe-deck-badge--${side === 1 ? 'right' : 'left'} ${() => active(card) && state.dir === side && '--visible'} ${() => active(card) && state.dir === side && state.step >= grain && '--active'}'
                style='${() => `--intent: ${active(card) && state.dir === side ? state.step / grain : 0}`}'
            >
                ${text}
            </span>
        `,
        render = (card: Card) => {
            let item = items[card.index];

            // Only the exit property ends a card; leaving interrupts its promotion, which cancels '--depth'.
            function settle(this: HTMLElement, e: TransitionEvent) {
                if (e.target !== this) {
                    return;
                }

                if (
                    (card.phase === 'drop' && e.propertyName === 'opacity') ||
                    (card.phase === 'leave' && e.propertyName === '--x')
                ) {
                    remove(card);
                }
            }

            return html`
                <div
                    aria-label='${itemLabel(item)}'
                    class='swipe-deck-card'
                    role='group'
                    ${{
                        'aria-hidden': () => String(!active(card)),
                        class: [
                            () => active(card) && '--active',
                            () => card.dragging && '--dragging',
                            () => card.phase === 'drop' && '--dropping',
                            () => card.phase === 'leave' && '--leaving'
                        ],
                        inert: () => !active(card),
                        onconnect: (element: HTMLElement) => {
                            if (card.x === 0 || card.phase !== 'idle') {
                                return;
                            }

                            // Commit the off-stage start position so the return to 0 transitions.
                            element.getBoundingClientRect();
                            card.x = 0;
                        },
                        onpointercancel: () => {
                            if (drag?.card === card) {
                                clear();
                            }
                        },
                        onpointerdown: (e: PointerEvent) => {
                            if (!active(card) || e.button !== 0) {
                                return;
                            }

                            drag = { card, locked: false, pointer: e.pointerId, samples: [[e.timeStamp, 0]], x: e.clientX, y: e.clientY };
                        },
                        onpointermove: function (this: HTMLElement, e: PointerEvent) {
                            if (drag?.card !== card || drag.pointer !== e.pointerId) {
                                return;
                            }

                            let dx = e.clientX - drag.x,
                                dy = e.clientY - drag.y;

                            if (!drag.locked) {
                                if (Math.hypot(dx, dy) < LOCK) {
                                    return;
                                }

                                // Vertical intent belongs to the page scroll.
                                if (Math.abs(dy) > Math.abs(dx)) {
                                    drag = null;
                                    return;
                                }

                                card.dragging = true;
                                drag.locked = true;
                                this.setPointerCapture(e.pointerId);
                            }

                            drag.samples.push([e.timeStamp, dx]);

                            while (drag.samples.length > 2 && e.timeStamp - drag.samples[0][0] > SAMPLE) {
                                drag.samples.shift();
                            }

                            card.x = dx;
                            report(dx);
                        },
                        onpointerup: (e: PointerEvent) => {
                            if (drag?.card !== card || drag.pointer !== e.pointerId) {
                                return;
                            }

                            if (!drag.locked) {
                                drag = null;
                                return;
                            }

                            let [time, x] = drag.samples[0],
                                dx = e.clientX - drag.x,
                                elapsed = e.timeStamp - time;

                            release(dx, elapsed > 0 ? ((dx - x) / elapsed) * 1000 : 0);
                        },
                        ontransitioncancel: settle,
                        ontransitionend: settle,
                        style: () => {
                            // The card behind the active one rises toward the front as the drag commits.
                            let depth = card.depth === 1 ? 1 - state.step / grain : card.depth;

                            return `--depth: ${depth}; --x: ${card.x}; z-index: ${card.phase === 'leave' ? 12 : 10 - card.depth};`;
                        }
                    }}
                >
                    ${content(item)}
                    ${badge(card, -1, leftLabel)}
                    ${badge(card, 1, rightLabel)}
                </div>
            `;
        };

    return html`
        <div class='swipe-deck' ${attributes}>
            <div
                aria-description='Left and right arrow keys decide the top card. Backspace brings the last one back.'
                aria-keyshortcuts='ArrowLeft ArrowRight Backspace Delete'
                aria-label='${label}'
                aria-roledescription='card deck'
                class='swipe-deck-stage'
                role='group'
                tabindex='0'
                ${{
                    ondocumentvisibilitychange: () => {
                        if (document.hidden) {
                            clear();
                        }
                    },
                    onkeydown: function (this: HTMLElement, e: KeyboardEvent) {
                        if (e.target !== this) {
                            return;
                        }

                        if (e.key === 'ArrowLeft') {
                            e.preventDefault();
                            decide('left');
                        }
                        else if (e.key === 'ArrowRight') {
                            e.preventDefault();
                            decide('right');
                        }
                        else if (e.key === 'Backspace' || e.key === 'Delete') {
                            e.preventDefault();
                            undo();
                        }
                        else if (e.key === 'Escape') {
                            clear();
                        }
                    },
                    onwindowblur: clear
                }}
            >
                <div class='swipe-deck-viewport'>
                    <div
                        class='swipe-deck-empty ${() => state.index >= total && '--active'}'
                        ${{ 'aria-hidden': () => String(state.index < total) }}
                    >
                        ${emptyLabel}
                    </div>

                    ${html.reactive(cards, render)}
                </div>
            </div>

            <div class='swipe-deck-controls'>
                <button
                    class='swipe-deck-control swipe-deck-control--left ${() => state.index >= total && '--spent'}'
                    onclick='${() => decide('left')}'
                    type='button'
                    ${{ inert: () => state.index >= total }}
                >
                    <svg aria-hidden='true' fill='none' height='12' viewBox='0 0 256 256' width='12'>
                        <line stroke='currentColor' stroke-linecap='round' stroke-width='16' x1='200' x2='56' y1='56' y2='200' />
                        <line stroke='currentColor' stroke-linecap='round' stroke-width='16' x1='200' x2='56' y1='200' y2='56' />
                    </svg>
                    <span>${leftLabel}</span>
                </button>

                <span class='swipe-deck-status'>
                    <span aria-hidden='true' class='swipe-deck-count'>
                        <span class='swipe-deck-count-reserve'>${total}</span>
                        <span>${() => total - state.index}</span>
                    </span>
                    <span aria-hidden='true'>left</span>
                    <button
                        class='swipe-deck-undo ${() => state.index === 0 && '--spent'}'
                        onclick='${undo}'
                        type='button'
                        ${{ inert: () => state.index === 0 }}
                    >
                        <svg aria-hidden='true' fill='none' height='12' viewBox='0 0 256 256' width='12'>
                            <polyline points='72 104 24 104 24 56' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='16' />
                            <path d='M67.6,192.1a88,88,0,1,0,0-128.2L24,104' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='16' />
                        </svg>
                        <span>${undoLabel}</span>
                    </button>
                </span>

                <button
                    class='swipe-deck-control swipe-deck-control--right ${() => state.index >= total && '--spent'}'
                    onclick='${() => decide('right')}'
                    type='button'
                    ${{ inert: () => state.index >= total }}
                >
                    <span>${rightLabel}</span>
                    <svg aria-hidden='true' fill='none' height='12' viewBox='0 0 256 256' width='12'>
                        <polyline points='216 72 104 184 48 128' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='16' />
                    </svg>
                </button>
            </div>

            <p aria-atomic='true' aria-live='polite' class='swipe-deck-announcer'>
                ${() => state.index >= total ? emptyLabel : `${itemLabel(items[state.index])}. Card ${state.index + 1} of ${total}.`}
            </p>
        </div>
    `;
};
