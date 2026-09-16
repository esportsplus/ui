import { truncate } from '@esportsplus/ui';
import { html } from '@esportsplus/template';
import type { Entry } from '~/viewer/types';


let address = 'Fk4nZ9pQ2wR7tY1uX3vB6cM8dL0aS5gH2jK4nZ9pQ2w';


const entry: Entry = {
    name: 'truncate',
    variants: [
        {
            render: () => html`
                <div style='display: flex; flex-direction: column; gap: var(--size-300); word-break: break-all;'>
                    <div class='text'>full: ${address}</div>
                    <div class='text'>center: ${truncate.center(address, { prefix: 6, suffix: 6 })}</div>
                    <div class='text'>start: ${truncate.start(address, 8)}</div>
                    <div class='text'>end: ${truncate.end(address, 8)}</div>
                </div>
            `,
            title: 'center / start / end'
        }
    ]
};


export default entry;
