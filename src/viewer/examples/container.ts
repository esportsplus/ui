import { html } from '@esportsplus/template';
import type { Entry } from '~/viewer/types';


let item = 'padding: var(--size-400) var(--size-500); border-radius: var(--border-radius-300); background: var(--color-grey-300);';


const entry: Entry = {
    name: 'container',
    variants: [
        {
            render: () => html`
                <div class='container' style='--gap-horizontal: var(--size-400); --gap-vertical: var(--size-400); --max-width: 480px; --margin-horizontal: 0px;'>
                    ${['One', 'Two', 'Three', 'Four', 'Five'].map((n) => html`
                        <div class='text' style='${item}'>${n}</div>
                    `)}
                </div>
            `,
            title: 'centered flex wrap'
        }
    ]
};


export default entry;
