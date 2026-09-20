import { input, textarea } from '@esportsplus/ui';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import type { Variant } from '../types';
import './form-options.scss';

// Original previews exploring patterns from these references, without copied source:
// https://codepen.io/AdrianBece/pen/KKKZQOY — floating labels
// https://mantine.dev/core/input/ — filled fields and attached sections
// https://mantine.dev/core/textarea/ — counters and autosizing
// https://codepen.io/Rakeshid03/pen/BaPzzxv — range value and progress
let instance = 0;

export function moreFieldVariations(kind: 'input' | 'textarea'): Variant[] {
    const options = [
        ['floating', 'Floating · Label lifts inside the field', 'The label stays visible after you type.'],
        ['inset', 'Inset · Recessed surface', 'A soft inset shadow becomes a crisp focus ring.'],
        ['rail', 'Rail · Left accent grows on focus', 'A quiet filled field with a strong side accent.'],
        ['double', 'Double · Offset outline', 'An outer frame separates from the field on focus.'],
        ['tinted', 'Tinted · Solid soft surface', 'A filled surface with a subtle bottom edge.'],
        ['counter', 'Counter · Character budget', 'A live counter with a 160-character limit.'],
        ...(kind === 'input' ? [
            ['capsule', 'Capsule · Rounded search field', 'A pill-shaped field with a search accent.'],
            ['prefix', 'Prefix · Attached address segment', 'An attached prefix gives the value context.']
        ] : [
            ['paper', 'Paper · Ruled writing surface', 'A notebook-inspired surface for longer notes.'],
            ['autosize', 'Autosize · Grows with your notes', 'Add lines: the field grows up to 260px, then scrolls.'],
            ['editor', 'Editor · Quiet writing panel', 'A spacious writing surface with a live word count.']
        ])
    ];

    return options.map(([mode, title, hint]) => ({
        title,
        render: () => {
            const id = `field-option-${++instance}`,
                label = mode === 'prefix' ? 'Workspace address' : mode === 'capsule' ? 'Search projects' : kind === 'input' ? 'Project name' : 'Notes',
                state = reactive({ length: 0, words: 0 }),
                attributes = {
                    id,
                    placeholder: mode === 'floating' ? ' ' : kind === 'input' ? 'Type here…' : 'Write a few notes…',
                    'aria-describedby': `${id}-hint`,
                    ...(mode === 'counter' ? { maxlength: 160 } : {}),
                    ...(kind === 'textarea' ? { rows: mode === 'autosize' ? 2 : 4 } : {}),
                    oninput: (event: Event) => {
                        const field = event.target as HTMLInputElement | HTMLTextAreaElement;
                        state.length = field.value.length;
                        state.words = field.value.trim() ? field.value.trim().split(/\s+/).length : 0;
                        if (mode === 'autosize') {
                            field.style.height = 'auto';
                            field.style.height = `${Math.min(field.scrollHeight, 260)}px`;
                        }
                    }
                };

            return html`
                <div class='form-prototype field-option field-option--${mode}'>
                    ${mode !== 'floating' && html`<label for='${id}'>${label}</label>`}
                    <div class='field-option-surface'>
                        ${mode === 'prefix' && html`<span class='field-option-prefix' aria-hidden='true'>workspace /</span>`}
                        ${mode === 'capsule' && html`<span class='field-option-search' aria-hidden='true'></span>`}
                        ${kind === 'input' ? input.call({}, attributes) : textarea.call({}, attributes)}
                        ${mode === 'floating' && html`<label for='${id}'>${label}</label>`}
                        ${mode === 'counter' && html`<div class='field-option-footer'><span>Keep it concise</span><output for='${id}'>${() => state.length} / 160</output></div>`}
                        ${mode === 'editor' && html`<div class='field-option-footer'><span>Plain text</span><output for='${id}'>${() => state.words} words</output></div>`}
                    </div>
                    <small id='${id}-hint'>${hint}</small>
                </div>
            `;
        }
    }));
}

export function moreRangeVariations(): Variant[] {
    return [
        ['bar', 'Fill bar · 48px with an inside value'],
        ['bar-tall', 'Tall fill · 64px with a following value'],
        ['bar-segments', 'Segmented fill · 48px with an inside value'],
        ['bubble', 'Bubble · Value follows the thumb'],
        ['ruler', 'Ruler · Fine graduation marks'],
        ['split', 'Split · Thick rail and a vertical handle'],
        ['soft', 'Soft · Recessed track and raised thumb']
    ].map(([mode, title]) => ({
        title,
        render: () => {
            const id = `range-option-${++instance}`,
                state = reactive({ value: 40 }),
                bar = mode.startsWith('bar');

            return html`
                <div class='form-prototype range-option range-option--${mode}'>
                    <label for='${id}'>${bar ? 'Intensity' : 'Volume'}</label>
                    <div class='range-option-control' style='${() => `--progress: ${state.value}%; --fraction: ${state.value / 100};`}'>
                        <div class='range-option-track' aria-hidden='true'><div class='range-option-fill'></div></div>
                        <input id='${id}' type='range' min='0' max='100' value='40' step='${mode === 'bar-segments' ? 10 : 1}'
                            oninput='${(event: Event) => state.value = Number((event.target as HTMLInputElement).value)}'>
                        <output for='${id}' class='range-option-value'>${() => state.value}%</output>
                        ${bar && html`<span class='range-option-value range-option-value--filled' aria-hidden='true'>${() => state.value}%</span>`}
                    </div>
                    <div class='range-option-scale'><span>0</span><small>Drag or use arrow keys</small><span>100</span></div>
                </div>
            `;
        }
    }));
}
