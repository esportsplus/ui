import { highlight } from '@esportsplus/ui';
import { html } from '@esportsplus/template';


export default {
    name: 'highlight',
    variants: [
        {
            render: () => highlight({}, html`
                <div class='text' style='padding: var(--size-500);'>This block highlights once it scrolls fully into view.</div>
            `),
            title: 'on scroll into view'
        },
        {
            render: () => highlight({ background: 'var(--color-purple-300)' }, html`
                <div class='text' style='padding: var(--size-500); --color: var(--color-white-400);'>Custom highlight background colour.</div>
            `),
            title: 'custom background'
        }
    ]
};
