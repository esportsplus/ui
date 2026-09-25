import { pagination } from '@esportsplus/ui';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import type { Entry } from '../types';


function demo(page: number, total: number, siblings?: number) {
    let state = reactive({ page });

    return html`
        <div style='display: grid; gap: var(--size-400); width: 100%;'>
            ${pagination({ siblings, state, total })}
            <div class='--color-text' style='font-size: var(--font-size-300); text-align: center;'>
                Page ${() => state.page} of ${total}
            </div>
        </div>
    `;
}


export default {
    name: 'pagination',
    variants: [
        {
            render: () => demo(6, 181),
            title: 'overflow'
        },
        {
            render: () => demo(1, 5),
            title: 'few pages'
        },
        {
            render: () => demo(50, 100, 2),
            title: 'two siblings'
        }
    ]
} satisfies Entry;
