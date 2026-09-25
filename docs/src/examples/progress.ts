import { onCleanup, reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { progress } from '@esportsplus/ui';


type Download = { value: number };


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

// A looping fake download: small uneven steps, then back to zero.
function simulate(state: Download) {
    let timer = setInterval(() => {
        state.value = state.value >= 100 ? 0 : Math.min(100, state.value + Math.random() * 3 + 1);
    }, 150);

    onCleanup(() => clearInterval(timer));
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
        }
    ]
};
