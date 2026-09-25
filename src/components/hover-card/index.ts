import { reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import './scss/index.scss';


type A = Attributes & {
    [HOVER_CARD_CONTENT]?: Attributes;
    [HOVER_CARD_TRIGGER]?: Attributes;
    card: Renderable<unknown>;
    group?: Group;
    label?: string;
    ondocumentpointerdown?: never;
    onfocusin?: never;
    onfocusout?: never;
    onkeydown?: never;
    onpointerout?: never;
    onpointerover?: never;
    state?: { active: boolean };
};

type Card = {
    close: (instant: boolean) => void;
    open: (instant: boolean, from?: DOMRect) => void;
    rect: () => DOMRect | undefined;
};

type Group = {
    close: VoidFunction;
    release: (card: Card) => void;
    request: (card: Card, immediate?: boolean) => void;
};


// Covers the moment the pointer is between the trigger and the card, or wobbles off an edge.
const CLOSE_GRACE = 150;

// The contents re-develop on arrival instead of swapping in place.
const DEVELOP: KeyframeAnimationOptions = { duration: 220, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' };

// Keeps the card this far from the viewport edges.
const EDGE = 12;

const GAP = 8;

const HOVER_CARD_CONTENT = Symbol.for('@esportsplus/ui/hover-card.content');

const HOVER_CARD_TRIGGER = Symbol.for('@esportsplus/ui/hover-card.trigger');

// Long enough that sweeping the pointer across a paragraph opens nothing.
const OPEN_DELAY = 500;

// Just after a card closes, hovering another trigger skips the delay: the reader is browsing, not passing through.
const SKIP_DELAY_FOR = 300;

// The trip between two triggers: long enough to follow a card crossing a paragraph, decelerating onto the
// new trigger so the eye lands with it.
const TRAVEL: KeyframeAnimationOptions = { duration: 260, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' };


let uid = 0;


// Shares one open card between every trigger using it, which is what lets a second trigger open instantly,
// travelling over from the first, while a card is showing.
function group(): Group {
    let closeTimer: ReturnType<typeof setTimeout> | undefined,
        closedAt = -Infinity,
        current: Card | null = null,
        // Where the last card was when it closed, for a quick return trip.
        last: DOMRect | null = null,
        openTimer: ReturnType<typeof setTimeout> | undefined;

    function commit(next: Card | null, instant = false, from?: DOMRect) {
        let previous = current;

        if (previous && previous !== next) {
            if (!next) {
                closedAt = performance.now();
                last = previous.rect() ?? null;
            }

            // Instant when another card is taking its place.
            previous.close(next !== null);
        }

        current = next;
        next?.open(instant, from);
    }

    return {
        close: () => {
            clearTimeout(closeTimer);
            clearTimeout(openTimer);

            if (current) {
                commit(null);
            }
        },
        release: (card) => {
            clearTimeout(openTimer);

            if (current !== card) {
                return;
            }

            clearTimeout(closeTimer);
            closeTimer = setTimeout(() => commit(null), CLOSE_GRACE);
        },
        request: (card, immediate) => {
            clearTimeout(closeTimer);

            if (current === card) {
                return;
            }

            clearTimeout(openTimer);

            let recent = performance.now() - closedAt < SKIP_DELAY_FOR;

            if (current) {
                commit(card, true, current.rect());
            }
            else if (recent && last) {
                commit(card, true, last);
            }
            else if (immediate || recent) {
                commit(card, false);
            }
            else {
                openTimer = setTimeout(() => commit(card, false), OPEN_DELAY);
            }
        }
    };
}

function place(element: HTMLElement, root: HTMLElement, trigger: HTMLElement) {
    let rect = trigger.getBoundingClientRect(),
        below = innerHeight - rect.bottom,
        south = below >= element.offsetHeight + GAP + EDGE || below >= rect.top,
        width = Math.min(element.offsetWidth, innerWidth - EDGE * 2),
        left = Math.min(Math.max(rect.left + rect.width / 2 - width / 2, EDGE), innerWidth - EDGE - width);

    element.classList.toggle('hover-card-content--n', !south);
    element.classList.toggle('hover-card-content--s', south);
    element.style.left = `${left - root.getBoundingClientRect().left}px`;
    // Scales out of the trigger itself, even when the card is pushed sideways.
    element.style.transformOrigin = `${rect.left + rect.width / 2 - left}px ${south ? '0%' : '100%'}`;
}

function reduced() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
}


export default Object.assign(
    component<A>(
        function(this, { card, group: shared, label, state = reactive({ active: false }), ...attributes }, content) {
            let animations: Animation[] = [],
                body: HTMLElement | undefined,
                element: HTMLElement | undefined,
                id = `hover-card-${++uid}`,
                owner = shared ?? group(),
                pointer = 'mouse',
                root: HTMLElement | undefined,
                self: Card = {
                    close: (instant) => {
                        if (!element) {
                            return;
                        }

                        element.classList.toggle('--instant', instant);
                        element.classList.remove('--active');
                        state.active = false;
                    },
                    open: (instant, from) => {
                        if (!element || !body || !root || !trigger) {
                            return;
                        }

                        for (let i = 0, n = animations.length; i < n; i++) {
                            animations[i].cancel();
                        }

                        animations = [];
                        place(element, root, trigger);
                        element.classList.toggle('--instant', instant);
                        element.classList.add('--active');
                        state.active = true;

                        if (!from) {
                            return;
                        }

                        let to = element.getBoundingClientRect(),
                            dx = from.left - to.left,
                            dy = from.top - to.top,
                            still = reduced();

                        if (!still && (dx || dy)) {
                            animations.push(element.animate({ translate: [`${dx}px ${dy}px`, '0 0'] }, TRAVEL));
                        }

                        animations.push(
                            body.animate(
                                still ? { opacity: [0, 1] } : { filter: ['blur(4px)', 'blur(0px)'], opacity: [0, 1] },
                                DEVELOP
                            )
                        );
                    },
                    rect: () => element?.isConnected ? element.getBoundingClientRect() : undefined
                },
                trigger: HTMLElement | undefined;

            return html`
                <span
                    class='hover-card'
                    ${this?.attributes}
                    ${attributes}
                    ${{
                        ondocumentpointerdown: (e: PointerEvent) => {
                            // Taps have no hover, so a tap opens the card and a tap anywhere else closes it.
                            if (state.active && root && !root.contains(e.target as Node | null)) {
                                owner.close();
                            }
                        },
                        onfocusin: (e: FocusEvent) => {
                            // Keyboard focus only; a tap also focuses the trigger, and opening here would let the
                            // click that follows close it again.
                            if (e.target === trigger && trigger?.matches(':focus-visible')) {
                                owner.request(self, true);
                            }
                        },
                        onfocusout: (e: FocusEvent) => {
                            if (!root?.contains(e.relatedTarget as Node | null)) {
                                owner.release(self);
                            }
                        },
                        onkeydown: (e: KeyboardEvent) => {
                            if (e.key !== 'Escape' || !state.active) {
                                return;
                            }

                            owner.close();
                            trigger?.focus();
                        },
                        onpointerout: (e: PointerEvent) => {
                            if (e.pointerType === 'touch' || root?.contains(e.relatedTarget as Node | null)) {
                                return;
                            }

                            owner.release(self);
                        },
                        onpointerover: (e: PointerEvent) => {
                            if (e.pointerType === 'touch' || root?.contains(e.relatedTarget as Node | null)) {
                                return;
                            }

                            owner.request(self);
                        },
                        onrender: (el: HTMLElement) => {
                            root = el;
                        }
                    }}
                >
                    <button
                        class='hover-card-trigger'
                        type='button'
                        ${this?.attributes?.[HOVER_CARD_TRIGGER]}
                        ${attributes[HOVER_CARD_TRIGGER]}
                        ${{
                            'aria-controls': () => state.active ? id : undefined,
                            'aria-expanded': () => state.active ? 'true' : 'false',
                            onclick: (e: MouseEvent) => {
                                // A mouse has already opened it by hovering; taps and keys toggle.
                                if (state.active && (e.detail === 0 || pointer === 'touch')) {
                                    owner.close();
                                }
                                else {
                                    owner.request(self, true);
                                }
                            },
                            onpointerdown: (e: PointerEvent) => {
                                pointer = e.pointerType;
                            },
                            onrender: (el: HTMLElement) => {
                                trigger = el;
                            }
                        }}
                    >
                        ${content}
                    </button>

                    <span
                        aria-label='${label ?? ''}'
                        class='hover-card-content hover-card-content--s'
                        id='${id}'
                        role='group'
                        ${this?.attributes?.[HOVER_CARD_CONTENT]}
                        ${attributes[HOVER_CARD_CONTENT]}
                        ${{
                            ondisconnect: () => {
                                owner.release(self);
                            },
                            onrender: (el: HTMLElement) => {
                                element = el;
                            }
                        }}
                    >
                        <span class='hover-card-body' ${{ onrender: (el: HTMLElement) => { body = el; } }}>
                            ${card}
                        </span>
                    </span>
                </span>
            `;
        }
    ),
    { content: HOVER_CARD_CONTENT, group, trigger: HOVER_CARD_TRIGGER } as const
);
export type { Group };
