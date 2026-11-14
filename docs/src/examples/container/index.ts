import { html } from '@esportsplus/template';
import 'docs/examples/container/scss/index.scss';


export default {
    name: 'container',
    variants: [
        {
            render: () => html`
                <div class='container' style='--gap-horizontal: var(--size-400); --gap-vertical: var(--size-400); --max-width: 480px; --margin-horizontal: 0px;'>
                    ${['One', 'Two', 'Three', 'Four', 'Five'].map((n) => html`
                        <div class='container-demo-item preview-text'>${n}</div>
                    `)}
                </div>
            `,
            title: 'centered flex wrap'
        }
    ]
};
