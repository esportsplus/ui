import { field, input, textarea } from '@esportsplus/ui/components';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import type { Variant } from 'docs/types';


const LIMIT = 160;


// Original previews exploring patterns from these references, without copied source:
// https://mantine.dev/core/input/ — filled fields and attached sections
// https://mantine.dev/core/textarea/ — counters and autosizing
let instance = 0;


function moreFieldVariations(kind: 'input' | 'textarea'): Variant[] {
    let options = [
        ['counter', 'Counter · Character budget', `Keep it concise: up to ${LIMIT} characters.`],
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
                    id,
                    maxlength: mode === 'counter' ? LIMIT : undefined,
                    oninput: (event: Event) => {
                        state.length = (event.target as HTMLInputElement | HTMLTextAreaElement).value.length;
                    },
                    placeholder: kind === 'input' ? 'Type here…' : 'Write a few notes…'
                };

            return html`
                <div class='field' style='width: min(100%, 400px);'>
                    <label class='field-label' for='${id}'>${label}</label>
                    ${kind === 'textarea'
                        ? textarea({
                            ...attributes,
                            autoresize: mode === 'autosize' ? { height: { max: '260px', min: '76px' } } : undefined,
                            rows: mode === 'autosize' ? 2 : 4
                        })
                        : mode === 'prefix'
                            ? field.tag({}, html`
                                <span aria-hidden='true' class='field-tag-item field-tag-item--prefix'>workspace /</span>
                                ${input(attributes)}
                            `)
                            : input(attributes)}
                    ${mode === 'counter'
                        ? html`
                            <div style='display: flex; gap: var(--size-400); justify-content: space-between;'>
                                <small class='field-description' id='${id}-hint'>${hint}</small>
                                <small class='field-description' style='flex-shrink: 0; font-variant-numeric: tabular-nums;'>${() => state.length} / ${LIMIT}</small>
                            </div>
                        `
                        : html`<small class='field-description' id='${id}-hint'>${hint}</small>`}
                </div>
            `;
        },
        title
    }));
}


export { moreFieldVariations };
