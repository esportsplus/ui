import { input, textarea } from '@esportsplus/ui/components';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import type { Variant } from 'docs/types';
import 'docs/examples/form-options/scss/index.scss';


// Original previews exploring patterns from these references, without copied source:
// https://mantine.dev/core/input/ — filled fields and attached sections
// https://mantine.dev/core/textarea/ — counters and autosizing
let instance = 0;

export function moreFieldVariations(kind: 'input' | 'textarea'): Variant[] {
    const options = [
        ['counter', 'Counter · Character budget', 'A live counter with a 160-character limit.'],
        ...(kind === 'input' ? [
            ['prefix', 'Prefix · Attached address segment', 'An attached prefix gives the value context.']
        ] : [
            ['autosize', 'Autosize · Grows with your notes', 'Add lines: the field grows up to 260px, then scrolls.']
        ])
    ];

    return options.map(([mode, title, hint]) => ({
        title,
        render: () => {
            const id = `field-option-${++instance}`,
                label = mode === 'prefix' ? 'Workspace address' : kind === 'input' ? 'Project name' : 'Notes',
                state = reactive({ length: 0 }),
                attributes = {
                    id,
                    placeholder: kind === 'input' ? 'Type here…' : 'Write a few notes…',
                    'aria-describedby': `${id}-hint`,
                    ...(mode === 'counter' ? { maxlength: 160 } : {}),
                    ...(kind === 'textarea' ? { rows: mode === 'autosize' ? 2 : 4 } : {}),
                    ...(kind === 'textarea' && mode === 'autosize' ? { autoresize: { height: { min: '76px' as const, max: '260px' as const } } } : {}),
                    oninput: (event: Event) => {
                        const field = event.target as HTMLInputElement | HTMLTextAreaElement;
                        state.length = field.value.length;
                    }
                };

            return html`
                <div class='form-prototype field-option field-option--${mode}'>
                    <label for='${id}'>${label}</label>
                    <div class='field-option-surface'>
                        ${mode === 'prefix' && html`<span class='field-option-prefix' aria-hidden='true'>workspace /</span>`}
                        ${kind === 'input' ? input.call({}, attributes) : textarea.call({}, attributes)}
                        ${mode === 'counter' && html`<div class='field-option-footer'><span>Keep it concise</span><output for='${id}'>${() => state.length} / 160</output></div>`}
                    </div>
                    <small id='${id}-hint'>${hint}</small>
                </div>
            `;
        }
    }));
}
