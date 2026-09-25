import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { form, tagInput } from '@esportsplus/ui';
import './tag-input.scss';


const HINT = 'Press Enter or comma to add. Backspace twice removes the last tag.';


export default {
    name: 'tag-input',
    variants: [
        {
            render: () => tagInput({ hint: HINT, label: 'Topics', tags: ['motion', 'design', 'react'] }),
            title: 'topics'
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
            title: 'paste + observed state'
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
            title: 'form submission'
        }
    ]
};
