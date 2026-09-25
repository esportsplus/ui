import { html, type Attributes, type Renderable } from '@esportsplus/template';
import { effect, reactive } from '@esportsplus/reactivity';
import './scss/index.scss';


const CAROUSEL_3D_BUTTON = Symbol.for('@esportsplus/ui/carousel-3d.button');

const CAROUSEL_3D_CARD = Symbol.for('@esportsplus/ui/carousel-3d.card');


type A = Attributes & {
    [CAROUSEL_3D_BUTTON]?: Attributes;
    [CAROUSEL_3D_CARD]?: Attributes;
    items: Item[];
    label: string;
    state?: State;
};

type Drag = {
    card: number | null;
    from: number;
    id: number;
    moved: boolean;
    x: number;
};

type Item = {
    note: Renderable<unknown>;
    title: string;
};

type Sample = {
    t: number;
    value: number;
};

type State = {
    active: number;
};


// How much a card shrinks and dims by the time it reaches the back.
const BACK_OPACITY = 0.35;

const BACK_SCALE = 0.9;

// Past this the pointer is dragging, not clicking a card.
const CLICK_SLOP = 6;

// Apple's scroll deceleration; projecting the release velocity picks the card a flick is heading for.
const DECELERATION = 0.998;

const NEXT = 'm6 3.5 4.5 4.5L6 12.5';

const PREVIOUS = 'M10 3.5 5.5 8l4.5 4.5';

// Dragging this far turns the ring by one card: close to the arc a front card travels, so the card
// under the finger stays under it.
const PX_PER_CARD = 180;

const REDUCED = '(prefers-reduced-motion: reduce)';

// Reduced motion lays the ring out flat; neighbours sit at half strength.
const ROW_OPACITY = 0.5;

// Pointer samples older than this say nothing about the speed at release.
const SAMPLE_WINDOW = 100;

// Spring with a 0.4s visual duration and 0.2 bounce: the small overshoot is earned, since the ring
// only moves after a spin, a throw or a step.
const STIFFNESS = (2 * Math.PI / 0.48) ** 2;

const DAMPING = 2 * 0.8 * Math.sqrt(STIFFNESS);

const SUBSTEP = 1 / 240;


// The copy of `index` nearest the current rotation, so clicking a card always turns the short way round.
function nearestTurn(index: number, rotation: number, count: number) {
    return index + Math.round((rotation - index) / count) * count;
}

function pad(value: number) {
    return String(value).padStart(2, '0');
}

function project(velocity: number) {
    return ((velocity / 1000) * DECELERATION) / (1 - DECELERATION);
}

function wrap(value: number, count: number) {
    return ((Math.round(value) % count) + count) % count;
}


function template(this: { attributes?: Partial<A> } | void, { items, label, state = reactive({ active: 0 }), ...attributes }: A) {
    let bound = this?.attributes,
        cards: HTMLElement[] = [],
        count = items.length,
        drag: Drag | null = null,
        frame = 0,
        media: MediaQueryList | undefined,
        radius = 0,
        reduce = false,
        ring: HTMLElement | null = null,
        rotation = 0,
        samples: Sample[] = [],
        spacing = 0,
        stop: VoidFunction | undefined,
        target = 0,
        time = 0,
        velocity = 0;

    function button(direction: -1 | 1) {
        return html`
            <button
                aria-label='${direction === -1 ? 'Previous card' : 'Next card'}'
                class='carousel-3d-button'
                type='button'
                ${bound?.[CAROUSEL_3D_BUTTON]}
                ${attributes[CAROUSEL_3D_BUTTON]}
                ${{
                    onclick: () => step(direction)
                }}
            >
                <svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 16 16'>
                    <path d='${direction === -1 ? PREVIOUS : NEXT}' />
                </svg>
            </button>
        `;
    }

    function goTo(next: number, initial = velocity) {
        let index = wrap(next, count);

        target = next;

        if (state.active !== index) {
            state.active = index;
        }

        if (reduce) {
            halt();
            rotation = next;
            render();
            return;
        }

        velocity = initial;

        if (!frame) {
            time = 0;
            frame = requestAnimationFrame(tick);
        }
    }

    function halt() {
        cancelAnimationFrame(frame);
        frame = 0;
        velocity = 0;
    }

    function layout() {
        if (!ring) {
            return;
        }

        let style = getComputedStyle(ring);

        reduce = media?.matches ?? false;
        spacing = parseFloat(style.getPropertyValue('--card-width')) + parseFloat(style.getPropertyValue('--card-gap'));
        radius = spacing / 2 / Math.tan(Math.PI / count);

        // Pushed back by the radius, so the front card sits on the perspective plane at its own size.
        ring.style.transform = reduce ? 'none' : `translateZ(${-radius}px)`;
        ring.classList.toggle('--flat', reduce);

        if (reduce) {
            halt();
            rotation = target = Math.round(rotation);
        }

        render();
    }

    function release(e: PointerEvent) {
        if (!drag || drag.id !== e.pointerId) {
            return;
        }

        let { card, moved } = drag;

        drag = null;

        if (e.type === 'pointercancel') {
            goTo(Math.round(rotation), 0);
        }
        else if (moved) {
            let speed = sampled(e.timeStamp),
                // Capped at one full turn, so a wild flick never loses your place.
                reach = Math.max(-count, Math.min(project(speed), count));

            goTo(Math.round(rotation + reach), speed);
        }
        else if (card !== null) {
            goTo(nearestTurn(card, rotation, count), 0);
        }
        else {
            goTo(Math.round(rotation), 0);
        }
    }

    function render() {
        for (let i = 0, n = cards.length; i < n; i++) {
            let card = cards[i],
                distance = (((i - rotation) % count) + count) % count,
                offset = distance > count / 2 ? distance - count : distance;

            if (reduce) {
                card.style.opacity = String(Math.abs(offset) < 0.5 ? 1 : ROW_OPACITY);
                card.style.transform = `translateX(${offset * spacing}px)`;
                card.style.setProperty('--text', '1');
                continue;
            }

            // 1 facing you, -1 facing away; every depth cue reads from this one number.
            let facing = Math.cos((offset / count) * Math.PI * 2);

            card.style.opacity = String(BACK_OPACITY + ((1 - BACK_OPACITY) * (facing + 1)) / 2);
            card.style.transform = `rotateY(${(offset / count) * 360}deg) translateZ(${radius}px) scale(${BACK_SCALE + ((1 - BACK_SCALE) * (facing + 1)) / 2})`;

            // Text is gone before a card turns side-on, so nobody reads a card mirrored through the ring.
            card.style.setProperty('--text', String(Math.min(Math.max((facing - 0.1) / 0.5, 0), 1)));
        }
    }

    // Cards per second over the last stretch of the drag; a hand that stopped has no momentum left.
    function sampled(now: number) {
        let first = samples[0],
            last = samples[samples.length - 1];

        if (!first || last.t <= first.t || now - last.t > SAMPLE_WINDOW / 2) {
            return 0;
        }

        return (last.value - first.value) / ((last.t - first.t) / 1000);
    }

    // Presses stack: two quick presses aim two cards ahead instead of restarting mid-turn.
    function step(direction: -1 | 1) {
        goTo(target + direction);
    }

    function tick(now: number) {
        let dt = time ? Math.min((now - time) / 1000, 1 / 30) : 1 / 60,
            steps = Math.max(1, Math.ceil(dt / SUBSTEP)),
            h = dt / steps;

        time = now;

        for (let i = 0; i < steps; i++) {
            velocity += (STIFFNESS * (target - rotation) - DAMPING * velocity) * h;
            rotation += velocity * h;
        }

        if (Math.abs(target - rotation) < 0.0005 && Math.abs(velocity) < 0.005) {
            rotation = target;
            velocity = 0;
            frame = 0;
            render();
            return;
        }

        render();
        frame = requestAnimationFrame(tick);
    }

    return html`
        <div
            class='carousel-3d'
            ${bound}
            ${attributes}
            ${{
                onconnect: (element: HTMLElement) => {
                    cards = Array.from(element.querySelectorAll<HTMLElement>('.carousel-3d-card'));
                    ring = element.querySelector<HTMLElement>('.carousel-3d-ring');
                    media = matchMedia(REDUCED);
                    media.addEventListener('change', layout);
                    layout();

                    stop = effect(() => {
                        let active = state.active;

                        if (active !== wrap(target, count)) {
                            goTo(nearestTurn(active, rotation, count));
                        }
                    });
                },
                ondisconnect: () => {
                    halt();
                    media?.removeEventListener('change', layout);
                    stop?.();
                }
            }}
        >
            <div
                aria-label='${label}'
                aria-roledescription='carousel'
                class='carousel-3d-stage'
                role='group'
                tabindex='0'
                ${{
                    onkeydown: (e: KeyboardEvent) => {
                        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
                            return;
                        }

                        e.preventDefault();
                        step(e.key === 'ArrowLeft' ? -1 : 1);
                    },
                    onpointercancel: release,
                    onpointerdown: (e: PointerEvent) => {
                        // A second finger mid-drag would make the ring jump to it.
                        if (e.button !== 0 || drag) {
                            return;
                        }

                        let card = (e.target as HTMLElement).closest<HTMLElement>('[data-card]');

                        // Grabbing a spinning ring stops it exactly where it is.
                        halt();

                        drag = {
                            card: card ? Number(card.dataset.card) : null,
                            from: rotation,
                            id: e.pointerId,
                            moved: false,
                            x: e.clientX
                        };
                        samples = [{ t: e.timeStamp, value: rotation }];
                        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    },
                    onpointermove: (e: PointerEvent) => {
                        if (!drag || drag.id !== e.pointerId) {
                            return;
                        }

                        let dx = e.clientX - drag.x;

                        if (!drag.moved) {
                            if (Math.abs(dx) < CLICK_SLOP) {
                                return;
                            }

                            // Start from the finger, not from where the slop ran out.
                            drag.moved = true;
                            drag.x = e.clientX;
                            return;
                        }

                        // Dragging right brings the card on the left forward.
                        rotation = drag.from - dx / PX_PER_CARD;
                        samples.push({ t: e.timeStamp, value: rotation });

                        while (samples.length > 2 && e.timeStamp - samples[0].t > SAMPLE_WINDOW) {
                            samples.shift();
                        }

                        render();
                    },
                    onpointerup: release
                }}
            >
                <div class='carousel-3d-ring'>
                    ${items.map((item, i) => html`
                        <div
                            aria-hidden='${() => String(state.active !== i)}'
                            class='carousel-3d-card'
                            data-card='${i}'
                            ${bound?.[CAROUSEL_3D_CARD]}
                            ${attributes[CAROUSEL_3D_CARD]}
                        >
                            <span class='carousel-3d-index'>${pad(i + 1)}</span>
                            <p class='carousel-3d-title'>
                                ${item.title}
                                <span class='carousel-3d-note'>${item.note}</span>
                            </p>
                        </div>
                    `)}
                </div>
            </div>
            <div class='carousel-3d-controls'>
                ${button(-1)}
                <p aria-atomic='true' aria-live='polite' class='carousel-3d-counter'>
                    <span class='carousel-3d-sr'>${() => items[state.active].title}, card </span>${() => pad(state.active + 1)}<span aria-hidden='true'> / </span><span class='carousel-3d-sr'> of </span>${pad(count)}
                </p>
                ${button(1)}
            </div>
        </div>
    `;
}


export default Object.assign(template, { button: CAROUSEL_3D_BUTTON, card: CAROUSEL_3D_CARD } as const);
export type { Item as Carousel3dItem, State as Carousel3dState };
