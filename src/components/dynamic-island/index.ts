import { html, type Attributes, type Renderable } from '@esportsplus/template';
import { effect, reactive, untrack } from '@esportsplus/reactivity';
import './scss/index.scss';


const DYNAMIC_ISLAND_TOGGLE = Symbol.for('@esportsplus/ui/dynamic-island.toggle');


type A = Attributes & {
    [DYNAMIC_ISLAND_TOGGLE]?: Attributes;
    state?: State;
};

type Mode = 'idle' | 'music' | 'ring' | 'timer';

type State = {
    artist: string;
    elapsed: number;
    mode: Mode;
    playing: boolean;
    title: string;
};


// Uneven durations and negative delays so the bars never fall into step; `rest` is the static height
// shown under reduced motion.
const BARS = [
    { delay: -120, duration: 520, rest: 0.55 },
    { delay: -400, duration: 760, rest: 0.9 },
    { delay: -250, duration: 610, rest: 0.4 },
    { delay: -600, duration: 840, rest: 0.7 }
];


function describe(mode: Mode, playing: boolean, elapsed: number, title: string) {
    if (mode === 'timer') {
        return `Timer, ${Math.floor(elapsed / 60)}:${pad(elapsed % 60)}`;
    }

    if (mode === 'music') {
        return `${playing ? 'Playing' : 'Paused'}, ${title}`;
    }

    if (mode === 'ring') {
        return 'Ringer on';
    }

    return 'Idle';
}

function format(seconds: number) {
    return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
}

function pad(value: number) {
    return String(value).padStart(2, '0');
}


function template(
    this: { attributes?: Partial<A> } | void,
    { state = reactive({ artist: 'M83', elapsed: 0, mode: 'idle' as Mode, playing: true, title: 'Midnight City' }), ...attributes }: A = {}
) {
    let bound = this?.attributes,
        stop: VoidFunction | undefined,
        view = reactive({ announcement: '' });

    function content(mode: Mode, children: Renderable<unknown>) {
        return html`
            <div
                class='dynamic-island-content dynamic-island-content--${mode} ${() => state.mode === mode && '--active'}'
                inert='${() => state.mode !== mode}'
            >
                ${children}
            </div>
        `;
    }

    return html`
        <div
            class='dynamic-island ${() => `dynamic-island--${state.mode}`}'
            ${bound}
            ${attributes}
            ${{
                onconnect: () => {
                    let initial = true;

                    // Announced once per change rather than on every tick, so a screen reader is not read
                    // the clock every second.
                    stop = effect(() => {
                        let mode = state.mode,
                            playing = state.playing;

                        if (initial) {
                            initial = false;
                            return;
                        }

                        view.announcement = untrack(() => describe(mode, playing, state.elapsed, state.title));
                    });
                },
                ondisconnect: () => {
                    stop?.();
                }
            }}
        >
            <div class='dynamic-island-pill'>
                ${content('idle', html`<span class='dynamic-island-lens'></span>`)}
                ${content('timer', html`
                    <svg aria-hidden='true' class='dynamic-island-icon' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 16 16'>
                        <circle cx='8' cy='9' r='5.25' />
                        <path d='M8 6.5V9l1.5 1.25M6.5 1.75h3' />
                    </svg>
                    <span class='dynamic-island-time'>${() => format(state.elapsed)}</span>
                `)}
                ${content('ring', html`
                    <svg aria-hidden='true' class='dynamic-island-icon dynamic-island-bell' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 16 16'>
                        <path d='M4 11.25V7.5a4 4 0 0 1 8 0v3.75l1 1H3Z' />
                        <path d='M6.75 13.75a1.25 1.25 0 0 0 2.5 0' />
                    </svg>
                    <span class='dynamic-island-label'>Ringer on</span>
                `)}
                ${content('music', html`
                    <div class='dynamic-island-track'>
                        <span class='dynamic-island-title'>${() => state.title}</span>
                        <span class='dynamic-island-artist'>${() => state.artist}</span>
                    </div>
                    <span aria-hidden='true' class='dynamic-island-eq ${() => !state.playing && '--paused'}'>
                        ${BARS.map((bar) => html`
                            <span style='${`--rest: ${bar.rest}; animation-delay: ${bar.delay}ms; animation-duration: ${bar.duration}ms;`}'></span>
                        `)}
                    </span>
                    <button
                        aria-label='${() => state.playing ? 'Pause' : 'Play'}'
                        class='dynamic-island-toggle ${() => state.playing && '--playing'}'
                        type='button'
                        ${bound?.[DYNAMIC_ISLAND_TOGGLE]}
                        ${attributes[DYNAMIC_ISLAND_TOGGLE]}
                        ${{
                            onclick: () => {
                                state.playing = !state.playing;
                            }
                        }}
                    >
                        <svg aria-hidden='true' class='dynamic-island-play' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 16 16'>
                            <path d='M5.5 3.5v9l7-4.5Z' fill='currentColor' />
                        </svg>
                        <svg aria-hidden='true' class='dynamic-island-pause' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 16 16'>
                            <path d='M5 3.5v9M11 3.5v9' />
                        </svg>
                    </button>
                `)}
            </div>
            <span aria-live='polite' class='dynamic-island-sr'>${() => view.announcement}</span>
        </div>
    `;
}


export default Object.assign(template, { toggle: DYNAMIC_ISLAND_TOGGLE } as const);
export type { Mode as DynamicIslandMode, State as DynamicIslandState };
