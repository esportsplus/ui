import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { scrubInput } from '@esportsplus/ui';
import './scrub-input.scss';


let angle = html`
    <svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 16 16'>
        <path d='M3 3v10h10' />
        <path d='M3 7.5a5.5 5.5 0 0 1 5.5 5.5' />
    </svg>
`;


export default {
    name: 'scrub-input',
    variants: [
        {
            render: () => html`
                <div class='scrub-input-demo'>
                    <div class='scrub-input-demo-title'>Transform</div>
                    <div class='scrub-input-demo-grid'>
                        ${scrubInput({ label: 'X position', value: 120 }, 'X')}
                        ${scrubInput({ label: 'Y position', value: 48 }, 'Y')}
                        ${scrubInput({ label: 'Rotation', max: 180, min: -180, suffix: '°' }, angle)}
                    </div>
                </div>
            `,
            title: 'transform'
        },
        {
            render: () => {
                let opacity = reactive({ active: false, error: '', value: 80 }),
                    scale = reactive({ active: false, error: '', value: 1 });

                return html`
                    <div class='scrub-input-demo'>
                        <div class='scrub-input-demo-title'>Layer</div>
                        <div class='scrub-input-demo-grid'>
                            ${scrubInput({ label: 'Opacity', max: 100, min: 0, pixelsPerStep: 2, precision: 0, state: opacity, suffix: '%' }, 'O')}
                            ${scrubInput({ label: 'Scale', max: 4, min: 0.1, pixelsPerStep: 4, state: scale, step: 0.01 }, 'S')}
                        </div>
                        <div class='scrub-input-demo-preview'>
                            <div style=${() => `opacity: ${opacity.value / 100}; scale: ${scale.value};`}></div>
                        </div>
                    </div>
                `;
            },
            title: 'bounded + observed state'
        },
        {
            render: () => html`
                <div class='scrub-input-demo'>
                    <div class='scrub-input-demo-grid'>
                        ${scrubInput({ label: 'Width', lockPointer: true, min: 0, suffix: 'px', value: 1280 }, 'W')}
                        ${scrubInput({ label: 'Height', lockPointer: true, min: 0, suffix: 'px', value: 720 }, 'H')}
                    </div>
                    <span class='scrub-input-demo-hint'>Pointer lock: scrub past the screen edge. Shift for ×10, Alt for ×0.1.</span>
                </div>
            `,
            title: 'pointer lock'
        }
    ]
};
