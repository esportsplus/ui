import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import { drag, INTERACTIVE, type Direction } from '~/lib/drag';
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

// A press: whether it has moved off the spot, which rules out a tap.
type Press = {
    moved: boolean;
    pointer: number;
    x: number;
    y: number;
};

type State = {
    index: number;
    paused: boolean;
};


// Shorter presses are taps that navigate; longer ones are holds that pause.
const HOLD = 200;

// Controls inside a story keep their own clicks.
const CONTROLS = `.story-slide :is(${INTERACTIVE}, [tabindex])`;

// Movement past this is no longer a tap.
const LOCK = 6;


function template(this: { attributes?: Partial<A> } | void, { duration, label = 'Stories', state = reactive({ index: 0, paused: false }), stories, ...attributes }: A) {
    let bound = this?.attributes,
        count = stories.length,
        dragged = false,
        fills: HTMLElement[] = [],
        hold: ReturnType<typeof setTimeout> | undefined,
        press: Press | null = null,
        // Auto-advancing stays silent; only stories the user moved to are announced.
        view = reactive({ dragging: false, held: false, hidden: false, manual: false, offset: 0, pressing: false });

    // The stories on either side are the ways a drag may leave by: toward the next is leftward, the previous
    // rightward. Dragged toward one that isn't there, it rubber-bands. Vertical movement is the page's to scroll.
    let gesture = drag({
        begin: () => {
            let ways: Direction[] = [];

            if (state.index < count - 1) {
                ways.push({ axis: 'x', sign: -1 });
            }

            if (state.index > 0) {
                ways.push({ axis: 'x', sign: 1 });
            }

            return ways;
        },
        capture: () => {
            clearTimeout(hold);
            dragged = true;
            view.dragging = true;
            view.held = false;
        },
        move: (element, { x }) => {
            view.offset = x / element.offsetWidth;
        },
        release: (_, { x }, dismiss) => {
            view.dragging = false;
            view.offset = 0;

            if (dismiss) {
                go(x < 0 ? 1 : -1);
            }
        }
    });

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

    function settle() {
        clearTimeout(hold);
        press = null;
        view.pressing = false;
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
                onpointercancel: (e: PointerEvent) => {
                    gesture.onpointercancel(e);
                    settle();
                    view.held = false;
                },
                onpointerdown: (e: PointerEvent) => {
                    if (e.button !== 0 || (e.target as Element).closest(CONTROLS)) {
                        return;
                    }

                    dragged = false;
                    gesture.onpointerdown(e);

                    // Held from the press, so a tap or hold that ends beyond the story still reaches it.
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    press = { moved: false, pointer: e.pointerId, x: e.clientX, y: e.clientY };

                    // The fill freezes the moment you press; the dim waits until it is clearly a hold, so
                    // quick taps don't flicker.
                    view.pressing = true;
                    hold = setTimeout(() => {
                        view.held = true;
                    }, HOLD);
                },
                onpointermove: (e: PointerEvent) => {
                    gesture.onpointermove(e);

                    if (press && press.pointer === e.pointerId && Math.hypot(e.clientX - press.x, e.clientY - press.y) >= LOCK) {
                        press.moved = true;
                    }
                },
                onpointerup: (e: PointerEvent) => {
                    let current = press;

                    gesture.onpointerup(e);
                    settle();

                    if (!current || current.pointer !== e.pointerId || dragged) {
                        return;
                    }

                    if (view.held) {
                        view.held = false;
                        return;
                    }

                    if (current.moved) {
                        return;
                    }

                    let box = (e.currentTarget as HTMLElement).getBoundingClientRect();

                    go(e.clientX < box.left + box.width / 3 ? -1 : 1);
                },
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
