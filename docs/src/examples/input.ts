import { form, password, tagInput } from '@esportsplus/ui';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { boardInputVariations, boardOtpVariations } from './board-fields';
import { fieldVariations } from './form-prototypes';
import { moreFieldVariations } from './form-options';
import { inputPatternVariations } from './form-patterns';
import './input.scss';


const TAG_HINT = 'Press Enter or comma to add. Backspace twice removes the last tag.';


let instance = 0,
    style = `
        --border-color-active: color-mix(in oklch, var(--color-text-500) 40%, transparent);
        --border-color-default: var(--color-border-400);
        --border-radius: var(--border-radius-500);
        --border-width: var(--border-width-400);
        --box-shadow-active: 0 0 0 3px color-mix(in oklch, var(--color-text-500) 10%, transparent);
        --box-shadow-default: 0 1px 2px oklch(0 0 0 / 0.04);
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
            render: () => {
                let id = `password-${++instance}`;

                return html`
                    <div class='form-prototype'>
                        <label for='${id}'>Password</label>
                        ${password({ style, [password.input]: { id, name: 'password' } })}
                    </div>
                `;
            },
            title: 'password · caps lock warning'
        },
        {
            render: () => tagInput({ hint: TAG_HINT, label: 'Topics', tags: ['motion', 'design', 'react'] }),
            title: 'tag input · topics'
        },
        {
            render: () => {
                let state = reactive({ active: false, error: '', tags: [] as string[] });

                return html`
                    <div class='tag-input-demo'>
                        ${tagInput({ hint: 'Paste a comma or newline separated list to add many at once.', label: 'Recipients', placeholder: 'name@example.com', state })}
                        <span class='tag-input-demo-status'>${() => `${state.tags.length} added: ${state.tags.join(', ') || '—'}`}</span>
                    </div>
                `;
            },
            title: 'tag input · paste + observed state'
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
                    <div class='tag-input-demo'>
                        ${tagInput({ label: 'Labels', name: 'labels', tags: ['bug', 'needs triage'] })}
                        <button class='button tag-input-demo-submit' type='submit'>Submit</button>
                        <span class='tag-input-demo-status'>${() => result.submitted && `Submitted labels: ${result.submitted}`}</span>
                    </div>
                `);
            },
            title: 'tag input · form submission'
        }
    ]
};
