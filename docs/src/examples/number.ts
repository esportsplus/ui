import { number } from '@esportsplus/ui';
import { html } from '@esportsplus/template';


export default {
    name: 'number',
    variants: [
        {
            render: () => html`
                <div style='display: flex; flex-direction: column; gap: var(--size-300);'>
                    <div class='text'>abbreviate(1234567) → ${number.abbreviate(1234567)}</div>
                    <div class='text'>abbreviate(8900) → ${number.abbreviate(8900)}</div>
                    <div class='text'>ordinal(23) → ${number.ordinal(23)}</div>
                    <div class='text'>ordinal(1) → ${number.ordinal(1)}</div>
                </div>
            `,
            title: 'abbreviate & ordinal'
        }
    ]
};
