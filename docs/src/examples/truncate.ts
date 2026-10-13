import { truncate } from '@esportsplus/ui/components';
import { html } from '@esportsplus/template';


let address = 'Fk4nZ9pQ2wR7tY1uX3vB6cM8dL0aS5gH2jK4nZ9pQ2w';


export default {
    name: 'truncate',
    variants: [
        {
            render: () => html`
                <div style='display: flex; flex-direction: column; gap: var(--size-300); word-break: break-all;'>
                    <div class='preview-text'>full: ${address}</div>
                    <div class='preview-text'>center: ${truncate.center(address, { prefix: 6, suffix: 6 })}</div>
                    <div class='preview-text'>start: ${truncate.start(address, 8)}</div>
                    <div class='preview-text'>end: ${truncate.end(address, 8)}</div>
                </div>
            `,
            title: 'center / start / end'
        }
    ]
};
