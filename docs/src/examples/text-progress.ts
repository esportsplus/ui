import { onCleanup, reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { textProgress } from '@esportsplus/ui';
import './text-progress.scss';


type Upload = { value: number };


// A fake upload: uneven chunks at uneven intervals, like a real network.
function upload(state: Upload) {
    let timer: ReturnType<typeof setTimeout> | undefined;

    function restart() {
        clearTimeout(timer);
        state.value = 0;
        timer = setTimeout(tick, 600);
    }

    function tick() {
        state.value = Math.min(100, state.value + 4 + Math.random() * 14);

        if (state.value < 100) {
            timer = setTimeout(tick, 220 + Math.random() * 480);
        }
    }

    onCleanup(() => clearTimeout(timer));
    restart();

    return restart;
}

function demo(attributes: Record<string, string>, label: string, doneLabel: string) {
    let state = reactive({ value: 0 }),
        restart = upload(state);

    return html`
        <div class='text-progress-demo'>
            ${textProgress({ ...attributes, doneLabel, label, state })}
            <button class='text-progress-demo-restart' type='button' onclick='${restart}'>
                <svg aria-hidden='true' fill='none' viewBox='0 0 16 16'>
                    <path
                        d='M2.75 8a5.25 5.25 0 1 0 1.54-3.71M2.75 2.5v2.25H5'
                        stroke='currentColor'
                        stroke-linecap='round'
                        stroke-linejoin='round'
                        stroke-width='1.5'
                    />
                </svg>
                Restart
            </button>
        </div>
    `;
}


export default {
    name: 'text-progress',
    variants: [
        {
            render: () => demo({}, 'Uploading 3 files', 'Uploaded'),
            title: 'upload'
        },
        {
            render: () => {
                let state = reactive({ value: 62 });

                return html`
                    <div class='text-progress-demo'>
                        ${textProgress({ label: 'Syncing library', state })}
                        <input
                            aria-label='Progress'
                            class='text-progress-demo-range'
                            max='100'
                            min='0'
                            type='range'
                            value='${state.value}'
                            oninput='${(e: Event) => state.value = Number((e.currentTarget as HTMLInputElement).value)}'
                        />
                    </div>
                `;
            },
            title: 'controlled (drag to scrub)'
        },
        {
            render: () => demo({ class: 'text-progress--large text-progress--blue' }, 'Exporting video', 'Exported'),
            title: 'large, blue'
        }
    ]
};
