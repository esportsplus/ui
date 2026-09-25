import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { dynamicIsland } from '@esportsplus/ui';
import type { DynamicIslandMode } from '~/components/dynamic-island';
import './dynamic-island.scss';


let keys: Record<string, (index: number) => number> = {
        ArrowDown: (index) => index + 1,
        ArrowLeft: (index) => index - 1,
        ArrowRight: (index) => index + 1,
        ArrowUp: (index) => index - 1,
        End: () => options.length - 1,
        Home: () => 0
    },
    options: { label: string; value: DynamicIslandMode }[] = [
        { label: 'Idle', value: 'idle' },
        { label: 'Timer', value: 'timer' },
        { label: 'Music', value: 'music' },
        { label: 'Ring', value: 'ring' }
    ];


function demo(mode: DynamicIslandMode, style = '') {
    // Starts partway in so the timer reads as already running.
    let state = reactive({ artist: 'M83', elapsed: 12, mode, playing: true, title: 'Midnight City' }),
        timer: ReturnType<typeof setInterval> | undefined;

    return html`
        <div
            class='dynamic-island-demo'
            ${{
                onconnect: () => {
                    timer = setInterval(() => {
                        if (state.mode === 'timer') {
                            state.elapsed++;
                        }
                    }, 1000);
                },
                ondisconnect: () => {
                    clearInterval(timer);
                }
            }}
        >
            ${dynamicIsland({ state, style })}
            <div
                aria-label='Island state'
                class='dynamic-island-demo-options'
                role='radiogroup'
                onkeydown='${(e: KeyboardEvent) => {
                    let move = keys[e.key];

                    if (!move) {
                        return;
                    }

                    e.preventDefault();

                    let index = move(options.findIndex((option) => option.value === state.mode)),
                        next = (index + options.length) % options.length;

                    state.mode = options[next].value;
                    ((e.currentTarget as HTMLElement).children[next] as HTMLElement).focus();
                }}'
            >
                ${options.map((option) => html`
                    <button
                        aria-checked='${() => String(state.mode === option.value)}'
                        class='dynamic-island-demo-option ${() => state.mode === option.value && '--active'}'
                        role='radio'
                        tabindex='${() => state.mode === option.value ? 0 : -1}'
                        type='button'
                        onclick='${() => state.mode = option.value}'
                    >
                        ${option.label}
                    </button>
                `)}
            </div>
        </div>
    `;
}


export default {
    name: 'dynamic-island',
    variants: [
        {
            render: () => demo('timer'),
            title: 'states'
        },
        {
            render: () => demo('music', '--background: var(--color-blue-500); --music-height: 84px; --music-width: 340px;'),
            title: 'custom shapes and color'
        }
    ]
};
