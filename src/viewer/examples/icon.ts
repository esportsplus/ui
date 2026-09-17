import { icon } from '@esportsplus/ui';
import { html } from '@esportsplus/template';
import bolt from '~/storage/svg/bolt.svg';
import star from '~/storage/svg/star.svg';


export default {
    name: 'icon',
    variants: [
        {
            render: () => html`
                <div style='display: flex; gap: var(--size-500); align-items: center;'>
                    ${icon(star)}
                    ${icon(bolt)}
                </div>
            `,
            title: 'default size'
        },
        {
            render: () => html`
                <div style='display: flex; gap: var(--size-500); align-items: center;'>
                    ${icon({ class: '--size-500' }, star)}
                    ${icon({ style: '--size: 40px; color: var(--color-purple-300);' }, bolt)}
                </div>
            `,
            title: 'sized & coloured'
        }
    ]
};
