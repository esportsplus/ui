import { html, type Attributes } from '@esportsplus/template';
import { effect, reactive } from '@esportsplus/reactivity';
import './scss/index.scss';


const STORY_PROGRESS_TOGGLE = Symbol.for('@esportsplus/ui/story-progress.toggle');


type A = Attributes & {
    [STORY_PROGRESS_TOGGLE]?: Attributes;
    duration?: number;
    label?: string;
    state?: State;
    stories: Story[];
};

type State = {
    index: number;
    paused: boolean;
};

type Story = {
    caption: string;
    value: string;
};


// Long enough to read a short caption, the same as Instagram's default.
const DURATION = 4000;

// Shorter presses are taps that navigate; longer ones are holds that pause.
const HOLD = 200;


function template(this: { attributes?: Partial<A> } | void, { duration = DURATION, label = 'Stories', state = reactive({ index: 0, paused: false }), stories, ...attributes }: A) {
    let bound = this?.attributes,
        count = stories.length,
        fills: HTMLElement[] = [],
        hold: ReturnType<typeof setTimeout> | undefined,
        stopPause: VoidFunction | undefined,
        stopTimer: VoidFunction | undefined,
        timer: Animation | undefined,
        // Auto-advancing stays silent; only stories the user moved to are announced.
        view = reactive({ held: false, hidden: false, manual: false, pressing: false });

    function go(step: number) {
        view.manual = true;
        state.index = (state.index + step + count) % count;
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

    function paused() {
        return view.pressing || state.paused || view.hidden;
    }

    function release(navigate: boolean, e?: PointerEvent) {
        clearTimeout(hold);
        view.pressing = false;

        if (view.held) {
            view.held = false;
            return;
        }

        if (!navigate || !e) {
            return;
        }

        let box = (e.currentTarget as HTMLElement).getBoundingClientRect();

        go(e.clientX < box.left + box.width / 2 ? -1 : 1);
    }

    return html`
        <div
            aria-label='${label}'
            aria-roledescription='stories'
            class='story-progress'
            role='region'
            tabindex='0'
            ${bound}
            ${attributes}
            ${{
                onconnect: (element: HTMLElement) => {
                    fills = Array.from(element.querySelectorAll<HTMLElement>('.story-progress-fill'));

                    // A compositor-driven fill is the timer itself: when it finishes the story advances,
                    // so the bar and the content can't drift.
                    stopTimer = effect(() => {
                        let fill = fills[state.index];

                        timer?.cancel();

                        if (!fill) {
                            return;
                        }

                        let animation = fill.animate(
                            [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
                            { duration, easing: 'linear', fill: 'forwards' }
                        );

                        if (paused()) {
                            animation.pause();
                        }

                        animation.onfinish = () => {
                            view.manual = false;
                            state.index = (state.index + 1) % count;
                        };
                        timer = animation;
                    });
                    stopPause = effect(() => {
                        let stop = paused();

                        if (!timer) {
                            return;
                        }

                        if (stop) {
                            timer.pause();
                        }
                        else if (timer.playState === 'paused') {
                            timer.play();
                        }
                    });
                },
                oncontextmenu: (e: MouseEvent) => {
                    e.preventDefault();
                },
                ondisconnect: () => {
                    clearTimeout(hold);
                    stopPause?.();
                    stopTimer?.();
                    timer?.cancel();
                },
                ondocumentvisibilitychange: () => {
                    view.hidden = document.hidden;
                },
                onkeydown: keydown,
                onpointercancel: () => release(false),
                onpointerdown: (e: PointerEvent) => {
                    if (e.button !== 0) {
                        return;
                    }

                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

                    // The fill freezes the moment you press; the dim waits until it is clearly a hold, so
                    // quick taps don't flicker.
                    view.pressing = true;
                    hold = setTimeout(() => {
                        view.held = true;
                    }, HOLD);
                },
                onpointerup: (e: PointerEvent) => release(true, e)
            }}
        >
            <div aria-hidden='true' class='story-progress-bars'>
                ${stories.map((_, i) => html`
                    <span class='story-progress-bar'>
                        <span class='story-progress-fill' style='${() => `transform: scaleX(${i < state.index ? 1 : 0})`}'></span>
                    </span>
                `)}
            </div>

            <div class='story-progress-header'>
                <span class='story-progress-count'>${() => `${state.index + 1} / ${count}`}</span>
                <button
                    aria-label='${() => state.paused ? 'Play' : 'Pause'}'
                    class='story-progress-toggle ${() => (view.held || state.paused) && '--paused'}'
                    type='button'
                    ${bound?.[STORY_PROGRESS_TOGGLE]}
                    ${attributes[STORY_PROGRESS_TOGGLE]}
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
                    <svg aria-hidden='true' class='story-progress-pause' fill='currentColor' viewBox='0 0 16 16'>
                        <rect height='10' rx='1' width='2.5' x='4' y='3' />
                        <rect height='10' rx='1' width='2.5' x='9.5' y='3' />
                    </svg>
                    <svg aria-hidden='true' class='story-progress-play' fill='currentColor' viewBox='0 0 16 16'>
                        <path d='M5.5 3.4v9.2a.6.6 0 0 0 .9.5l7-4.6a.6.6 0 0 0 0-1L6.4 2.9a.6.6 0 0 0-.9.5Z' />
                    </svg>
                </button>
            </div>

            <div class='story-progress-stories ${() => (view.held || state.paused) && '--dimmed'}'>
                ${stories.map((story, i) => html`
                    <div aria-hidden='true' class='story-progress-story ${() => state.index === i && '--active'}'>
                        <span class='story-progress-value'>${story.value}</span>
                        <span class='story-progress-caption'>${story.caption}</span>
                    </div>
                `)}
                <p aria-live='${() => view.manual ? 'polite' : 'off'}' class='story-progress-sr'>
                    ${() => `${stories[state.index].value}. ${stories[state.index].caption}`}
                </p>
            </div>

            <div class='story-progress-zones'>
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


export default Object.assign(template, { toggle: STORY_PROGRESS_TOGGLE } as const);
export type { State as StoryProgressState, Story as StoryProgressStory };
