import { html } from '@esportsplus/template';
import { lineShadowText } from '@esportsplus/ui';
import './line-shadow-text.scss';


export default {
    name: 'line-shadow-text',
    variants: [
        {
            render: () => html`
                <h1 class='line-shadow-text-demo'>
                    Ship ${lineShadowText({ class: 'line-shadow-text-demo-word' }, 'Fast')}
                </h1>
            `,
            title: 'headline'
        },
        {
            render: () => html`
                <h1 class='line-shadow-text-demo'>
                    ${lineShadowText({ color: 'var(--color-blue-400)' }, 'Colored')}
                </h1>
            `,
            title: 'custom shadow color'
        }
    ]
};
