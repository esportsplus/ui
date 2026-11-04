import { html } from '@esportsplus/template';
import type { Entry } from 'docs/types';
import 'docs/examples/shell/scss/index.scss';


let levels = [
        ['', 'Default'],
        ['shell-sidebar--lower', 'Lower'],
        ['shell-sidebar--raise', 'Raise']
    ];


export default {
    name: 'shell',
    variants: [
        {
            render: () => html`
                <div class='shell-demo'>
                    ${levels.map(([modifier, label]) => html`
                        <div class='shell-sidebar ${modifier}'>
                            <span class='preview-text'>${label}</span>
                        </div>
                    `)}
                </div>
            `,
            title: 'shell-sidebar--lower · shell-sidebar--raise'
        }
    ]
} satisfies Entry;
