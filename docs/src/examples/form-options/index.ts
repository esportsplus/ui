import { input, textarea } from '@esportsplus/ui/components';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import type { Variant } from 'docs/types';
import 'docs/examples/form-options/scss/index.scss';


const LIMIT = 160;


// Original previews exploring patterns from these references, without copied source:
// https://mantine.dev/core/input/ — filled fields and attached sections
// https://mantine.dev/core/textarea/ — counters and autosizing
let instance = 0;


function moreFieldVariations(kind: 'input' | 'textarea'): Variant[] {
    let options = [
        ['counter', 'Counter · Character budget', `A live counter with a ${LIMIT}-character limit.`],
        kind === 'input'
            ? ['prefix', 'Prefix · Attached address segment', 'An attached prefix gives the value context.']
            : ['autosize', 'Autosize · Grows with your notes', 'Add lines: the field grows up to 260px, then scrolls.']
    ];

    return options.map(([mode, title, hint]) => ({
        render: () => {
            let id = `field-option-${++instance}`,
                label = mode === 'prefix' ? 'Workspace address' : kind === 'input' ? 'Project name' : 'Notes',
                state = reactive({ length: 0 }),
                attributes = {
                    'aria-describedby': `${id}-hint`,
                    class: 'field-option-control',
                    id,
                    maxlength: mode === 'counter' ? LIMIT : undefined,
                    oninput: (event: Event) => {
                        state.length = (event.target as HTMLInputElement | HTMLTextAreaElement).value.length;
                    },
                    placeholder: kind === 'input' ? 'Type here…' : 'Write a few notes…'
                };

            return html`
                <div class='form-prototype field-option'>
                    <label for='${id}'>${label}</label>
                    <div class='field-option-surface field-option-surface--${mode}'>
                        ${mode === 'prefix' && html`<span aria-hidden='true' class='field-option-prefix'>workspace /</span>`}
                        ${kind === 'input'
                            ? input(attributes)
                            : textarea({
                                ...attributes,
                                autoresize: mode === 'autosize' ? { height: { max: '260px', min: '76px' } } : undefined,
                                class: ['field-option-control', mode === 'counter' && 'field-option-control--resizable'],
                                rows: mode === 'autosize' ? 2 : 4
                            })}
                        ${mode === 'counter' && html`
                            <div class='field-option-footer'>
                                <span>Keep it concise</span>
                                <output class='field-option-count' for='${id}'>${() => state.length} / ${LIMIT}</output>
                            </div>
                        `}
                    </div>
                    <small class='form-prototype-hint' id='${id}-hint'>${hint}</small>
                </div>
            `;
        },
        title
    }));
}


export { moreFieldVariations };
