import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import pause from '@esportsplus/ui/svg/pause.svg';
import play from '@esportsplus/ui/svg/play.svg';
import '~/components/frame/scss/index.scss';
import './scss/index.scss';


const STORY_TOGGLE = Symbol.for('@esportsplus/ui/story.toggle');


type A = Attributes & {
    [STORY_TOGGLE]?: Attributes;
    // Milliseconds per story; defaults to the stylesheet's '--duration'.
    duration?: number;
    label?: string;
    state?: State;
    stories: Renderable<unknown>[];
};

type Drag = {
    locked: boolean;
    moved: boolean;
    pointer: number;
    samples: [number, number][];
    width: number;
    x: number;
    y: number;
};

type State = {
    index: number;
    paused: boolean;
};


// Share of the card a drag must cover to change story.
const DISTANCE = 0.25;

// Pixels per second that change story on release, however short the drag.
const FLICK = 500;

// Shorter presses are taps that navigate; longer ones are holds that pause.
const HOLD = 200;

const INTERACTIVE = '.story-slide :is(a, button, input, label, select, textarea, [contenteditable], [tabindex])';

// Movement that commits a press to a drag, or hands a vertical one to the page scroll.
const LOCK = 6;

// Drag past the first or last story moves the track this share of the pointer's travel.
const RESIST = 0.3;

const SAMPLE = 100;


function template(this: { attributes?: Partial<A> } | void, { duration, label = 'Stories', state = reactive({ index: 0, paused: false }), stories, ...attributes }: A) {
    let bound = this?.attributes,
        count = stories.length,
        drag: Drag | null = null,
        fills: HTMLElement[] = [],
        hold: ReturnType<typeof setTimeout> | undefined,
        // Auto-advancing stays silent; only stories the user moved to are announced.
        view = reactive({ dragging: false, held: false, hidden: false, manual: false, offset: 0, pressing: false });

    function edge(step: number) {
        return step < 0 ? state.index === 0 : state.index === count - 1;
    }

    function go(step: number) {
        view.manual = true;

        // Going back from the first story replays it instead of wrapping to the last.
        if (step < 0 && state.index === 0) {
            for (let animation of fills[0]?.getAnimations() ?? []) {
                animation.currentTime = 0;
            }

            return;
        }

        state.index = (state.index + step) % count;
    }

    function keydown(e: KeyboardEvent) {
        if (e.key === 'ArrowRight') {
            go(1);
        }
        else if (e.key === 'ArrowLeft') {
            go(-1);
        }
        else if (e.key === ' ' && !e.repeat) {
            state.paused = !state.paused;
        }
        else {
            return;
        }

        e.preventDefault();
    }

    function release(e: PointerEvent, navigate: boolean) {
        let gesture = drag;

        clearTimeout(hold);
        drag = null;
        view.pressing = false;

        if (!gesture || gesture.pointer !== e.pointerId) {
            return;
        }

        if (gesture.locked) {
            let dx = e.clientX - gesture.x,
                [time, x] = gesture.samples[0],
                elapsed = e.timeStamp - time,
                step = dx < 0 ? 1 : -1,
                vx = elapsed > 0 ? ((dx - x) / elapsed) * 1000 : 0;

            view.dragging = false;
            view.offset = 0;

            if (navigate && !edge(step) && (Math.abs(dx) >= gesture.width * DISTANCE || Math.abs(vx) >= FLICK)) {
                go(step);
            }

            return;
        }

        if (view.held) {
            view.held = false;
            return;
        }

        if (!navigate || gesture.moved) {
            return;
        }

        let box = (e.currentTarget as HTMLElement).getBoundingClientRect();

        go(e.clientX < box.left + box.width / 3 ? -1 : 1);
    }

    return html`
        <div
            aria-label='${label}'
            aria-roledescription='stories'
            class='story'
            role='region'
            tabindex='0'
            ${bound}
            ${attributes}
            ${{
                class: () => (view.pressing || state.paused || view.hidden) && '--paused',
                oncontextmenu: (e: MouseEvent) => {
                    e.preventDefault();
                },
                ondisconnect: () => {
                    clearTimeout(hold);
                },
                ondocumentvisibilitychange: () => {
                    view.hidden = document.hidden;
                },
                onkeydown: keydown,
                onpointercancel: (e: PointerEvent) => release(e, false),
                onpointerdown: (e: PointerEvent) => {
                    // Controls inside a story keep their own clicks.
                    if (e.button !== 0 || (e.target as Element).closest(INTERACTIVE)) {
                        return;
                    }

                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

                    drag = {
                        locked: false,
                        moved: false,
                        pointer: e.pointerId,
                        samples: [[e.timeStamp, 0]],
                        width: (e.currentTarget as HTMLElement).offsetWidth,
                        x: e.clientX,
                        y: e.clientY
                    };

                    // The fill freezes the moment you press; the dim waits until it is clearly a hold, so
                    // quick taps don't flicker.
                    view.pressing = true;
                    hold = setTimeout(() => {
                        view.held = true;
                    }, HOLD);
                },
                onpointermove: (e: PointerEvent) => {
                    if (!drag || drag.pointer !== e.pointerId || drag.moved) {
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
                            drag.moved = true;
                            return;
                        }

                        clearTimeout(hold);
                        drag.locked = true;
                        view.dragging = true;
                        view.held = false;
                    }

                    drag.samples.push([e.timeStamp, dx]);

                    while (drag.samples.length > 2 && e.timeStamp - drag.samples[0][0] > SAMPLE) {
                        drag.samples.shift();
                    }

                    view.offset = (edge(dx < 0 ? 1 : -1) ? dx * RESIST : dx) / drag.width;
                },
                onpointerup: (e: PointerEvent) => release(e, true),
                style: duration === undefined ? undefined : `--duration: ${duration}ms`
            }}
        >
            <div aria-hidden='true' class='story-bars'>
                ${stories.map((_, i) => html`
                    <span class='story-bar ${() => i < state.index && '--done'} ${() => i === state.index && '--active'}'>
                        <span
                            class='story-fill'
                            ${{
                                onanimationend: () => {
                                    if (i !== state.index) {
                                        return;
                                    }

                                    view.manual = false;
                                    state.index = (i + 1) % count;
                                },
                                onrender: (element: HTMLElement) => {
                                    fills[i] = element;
                                }
                            }}
                        ></span>
                    </span>
                `)}
            </div>

            <div class='story-header'>
                <span class='story-count'>${() => `${state.index + 1} / ${count}`}</span>
                <button
                    aria-label='${() => state.paused ? 'Play' : 'Pause'}'
                    class='story-toggle ${() => (view.held || state.paused) && '--paused'}'
                    type='button'
                    ${bound?.[STORY_TOGGLE]}
                    ${attributes[STORY_TOGGLE]}
                    ${{
                        onclick: () => {
                            state.paused = !state.paused;
                        },
                        // Space and Enter reach the button's own click instead of toggling twice.
                        onkeydown: (e: KeyboardEvent) => {
                            if (e.key !== ' ' && e.key !== 'Enter') {
                                keydown(e);
                            }
                        },
                        onpointerdown: () => {},
                        onpointerup: () => {}
                    }}
                >
                    <svg aria-hidden='true' class='story-pause'><use href='#${pause}' /></svg>
                    <svg aria-hidden='true' class='story-play'><use href='#${play}' /></svg>
                </button>
            </div>

            <div
                class='story-track ${() => (view.held || state.paused) && '--dimmed'} ${() => view.dragging && '--dragging'}'
                style='${() => `--i: ${state.index - view.offset}`}'
            >
                ${stories.map((story, i) => html`
                    <div
                        aria-label='${`${i + 1} of ${count}`}'
                        aria-roledescription='story'
                        class='story-slide frame frame--slide ${() => state.index === i && '--active'}'
                        role='group'
                        style='${`--n: ${i}`}'
                        ${{
                            'aria-hidden': () => String(state.index !== i),
                            inert: () => state.index !== i
                        }}
                    >
                        ${story}
                    </div>
                `)}
                <p aria-live='${() => view.manual ? 'polite' : 'off'}' class='story-sr'>
                    ${() => `Story ${state.index + 1} of ${count}`}
                </p>
            </div>

            <div class='story-zones'>
                <button
                    aria-label='Previous story'
                    tabindex='-1'
                    type='button'
                    onclick='${(e: MouseEvent) => e.detail === 0 && go(-1)}'
                ></button>
                <button
                    aria-label='Next story'
                    tabindex='-1'
                    type='button'
                    onclick='${(e: MouseEvent) => e.detail === 0 && go(1)}'
                ></button>
            </div>
        </div>
    `;
}


export default component(template, { toggle: STORY_TOGGLE });
export type { State as StoryState };
