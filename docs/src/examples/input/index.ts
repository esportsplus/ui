import { form, input } from '@esportsplus/ui/components';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { boardInputVariations, boardOtpVariations } from '~/examples/board-fields';
import { fieldVariations } from '~/examples/form-prototypes';
import { moreFieldVariations } from '~/examples/form-options';
import { inputPatternVariations } from '~/examples/input/patterns';
import '~/examples/input/scss/index.scss';


const TAG_HINT = 'Press Enter or comma to add. Backspace twice removes the last tag.';


let angle = html`
    <svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 16 16'>
        <path d='M3 3v10h10' />
        <path d='M3 7.5a5.5 5.5 0 0 1 5.5 5.5' />
    </svg>
`;


export default {
    name: 'input',
    variants: [
        ...fieldVariations('input'),
        ...moreFieldVariations('input'),
        ...boardInputVariations(),
        ...boardOtpVariations(),
        ...inputPatternVariations(),
        {
            render: () => input.tag({ hint: TAG_HINT, label: 'Topics', tags: ['motion', 'design', 'react'] }),
            title: 'tag · topics'
        },
        {
            render: () => {
                let state = reactive({ active: false, error: '', tags: [] as string[] });

                return html`
                    <div class='input-tag-demo'>
                        ${input.tag({ hint: 'Paste a comma or newline separated list to add many at once.', label: 'Recipients', placeholder: 'name@example.com', state })}
                        <span class='input-tag-demo-status'>${() => `${state.tags.length} added: ${state.tags.join(', ') || '—'}`}</span>
                    </div>
                `;
            },
            title: 'tag · paste + observed state'
        },
        {
            render: () => {
                let result = reactive({ submitted: '' });

                return form.action({
                    action: ({ input }: { input: { labels?: string[] } }) => {
                        result.submitted = JSON.stringify(input.labels ?? []);

                        return { errors: [] };
                    }
                }, html`
                    <div class='input-tag-demo'>
                        ${input.tag({ label: 'Labels', name: 'labels', tags: ['bug', 'needs triage'] })}
                        <button class='button input-tag-demo-submit' type='submit'>Submit</button>
                        <span class='input-tag-demo-status'>${() => result.submitted && `Submitted labels: ${result.submitted}`}</span>
                    </div>
                `);
            },
            title: 'tag · form submission'
        },
        {
            render: () => html`
                <div class='input-scrub-demo'>
                    <div class='input-scrub-demo-title'>Transform</div>
                    <div class='input-scrub-demo-grid'>
                        ${input.scrub({ label: 'X position', value: 120 }, 'X')}
                        ${input.scrub({ label: 'Y position', value: 48 }, 'Y')}
                        ${input.scrub({ label: 'Rotation', max: 180, min: -180, suffix: '°' }, angle)}
                    </div>
                </div>
            `,
            title: 'scrub · transform'
        },
        {
            render: () => {
                let opacity = reactive({ active: false, error: '', value: 80 }),
                    scale = reactive({ active: false, error: '', value: 1 });

                return html`
                    <div class='input-scrub-demo'>
                        <div class='input-scrub-demo-title'>Layer</div>
                        <div class='input-scrub-demo-grid'>
                            ${input.scrub({ label: 'Opacity', max: 100, min: 0, pixelsPerStep: 2, precision: 0, state: opacity, suffix: '%' }, 'O')}
                            ${input.scrub({ label: 'Scale', max: 4, min: 0.1, pixelsPerStep: 4, state: scale, step: 0.01 }, 'S')}
                        </div>
                        <div class='input-scrub-demo-preview'>
                            <div style=${() => `opacity: ${opacity.value / 100}; scale: ${scale.value};`}></div>
                        </div>
                    </div>
                `;
            },
            title: 'scrub · bounded + observed state'
        },
        {
            render: () => html`
                <div class='input-scrub-demo'>
                    <div class='input-scrub-demo-grid'>
                        ${input.scrub({ label: 'Width', lockPointer: true, min: 0, suffix: 'px', value: 1280 }, 'W')}
                        ${input.scrub({ label: 'Height', lockPointer: true, min: 0, suffix: 'px', value: 720 }, 'H')}
                    </div>
                    <span class='input-scrub-demo-hint'>Pointer lock: scrub past the screen edge. Shift for ×10, Alt for ×0.1.</span>
                </div>
            `,
            title: 'scrub · pointer lock'
        }
    ]
};
