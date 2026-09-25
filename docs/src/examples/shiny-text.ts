import { html } from '@esportsplus/template';
import { shinyText } from '@esportsplus/ui';
import './shiny-text.scss';


export default {
    name: 'shiny-text',
    variants: [
        {
            render: () => html`
                <a class='shiny-text-demo-pill' href='#shiny-text'>
                    ${shinyText({ class: 'shiny-text-demo-label' }, html`
                        <span>✨ Introducing Magic UI</span>
                        <svg aria-hidden='true' class='shiny-text-demo-arrow' fill='none' viewBox='0 0 15 15'>
                            <path
                                d='M8.15 3.15a.5.5 0 0 1 .7 0l4 4a.5.5 0 0 1 0 .7l-4 4a.5.5 0 0 1-.7-.7L11.29 8H2.5a.5.5 0 0 1 0-1h8.79L8.15 3.85a.5.5 0 0 1 0-.7Z'
                                fill='currentColor'
                            />
                        </svg>
                    `)}
                </a>
            `,
            title: 'announcement pill'
        },
        {
            render: () => html`
                <p class='shiny-text-demo-headline'>
                    ${shinyText({ width: 200 }, 'Shimmering across a headline')}
                </p>
            `,
            title: 'wide shine'
        }
    ]
};
