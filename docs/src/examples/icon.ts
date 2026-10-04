import { icon } from '@esportsplus/ui/components';
import { html } from '@esportsplus/template';
import bolt from '@esportsplus/ui/svg/bolt.svg';
import star from '@esportsplus/ui/svg/star.svg';


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
                    ${icon({ style: '--size: var(--size-500);' }, star)}
                    ${icon({ style: '--size: 40px; color: var(--color-purple-300);' }, bolt)}
                </div>
            `,
            title: 'sized & coloured'
        }
    ]
};
