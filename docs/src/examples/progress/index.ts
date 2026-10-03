import { onCleanup, reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { progress } from '@esportsplus/ui';
import './scss/index.scss';


type Download = { value: number };

type Upload = { value: number };


function demo(attributes: Record<string, string>, label: string, doneLabel: string) {
    let state = reactive({ value: 0 }),
        restart = upload(state);

    return html`
        <div class='progress-text-demo'>
            ${progress.text({ ...attributes, doneLabel, label, state })}
            <button class='progress-text-demo-restart' type='button' onclick='${restart}'>
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

// A looping fake download: small uneven steps, then back to zero.
function simulate(state: Download) {
    let timer = setInterval(() => {
        state.value = state.value >= 100 ? 0 : Math.min(100, state.value + Math.random() * 3 + 1);
    }, 150);

    onCleanup(() => clearInterval(timer));
}

function stage(value: number) {
    if (value < 5) return 'Initializing download...';
    if (value < 15) return 'Setting up environment...';
    if (value < 25) return 'Connecting to server...';
    if (value < 35) return 'Verifying permissions...';
    if (value < 50) return 'Downloading core files...';
    if (value < 65) return 'Downloading assets...';
    if (value < 80) return 'Downloading dependencies...';
    if (value < 90) return 'Extracting files...';
    if (value < 95) return 'Validating integrity...';
    if (value < 100) return 'Finalizing installation...';
    return 'Download complete!';
}

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


export default {
    name: 'progress',
    variants: [
        {
            render: () => {
                let state = reactive({ value: 0 });

                simulate(state);

                return html`
                    <div style='max-width: 100%; width: 448px;'>
                        ${progress({ label: 'Workspace Setup', state, status: stage })}
                    </div>
                `;
            },
            title: 'status'
        },
        {
            render: () => html`
                <div style='display: grid; gap: 16px; max-width: 100%; width: 448px;'>
                    ${progress({ 'aria-label': 'Upload', value: 20 })}
                    ${progress({ 'aria-label': 'Upload', value: 60 })}
                    ${progress({ label: 'Storage used', value: 85 })}
                </div>
            `,
            title: 'static values'
        },
        {
            render: () => demo({}, 'Uploading 3 files', 'Uploaded'),
            title: 'text · upload'
        },
        {
            render: () => {
                let state = reactive({ value: 62 });

                return html`
                    <div class='progress-text-demo'>
                        ${progress.text({ label: 'Syncing library', state })}
                        <input
                            aria-label='Progress'
                            class='progress-text-demo-range'
                            max='100'
                            min='0'
                            type='range'
                            value='${state.value}'
                            oninput='${(e: Event) => state.value = Number((e.currentTarget as HTMLInputElement).value)}'
                        />
                    </div>
                `;
            },
            title: 'text · controlled (drag to scrub)'
        },
        {
            render: () => demo({ class: 'progress-text--large progress-text--blue' }, 'Exporting video', 'Exported'),
            title: 'text · large, blue'
        }
    ]
};
