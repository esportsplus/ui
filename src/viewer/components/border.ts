import { html } from '@esportsplus/template';
import type { Entry } from '../types';


const entry: Entry = {
    name: 'border',
    variants: [
        {
            render: () => html`
                <div style='display: flex; flex-direction: column; gap: var(--size-400);'>
                    <div class='text'>Section one</div>
                    <div class='border'></div>
                    <div class='text'>Section two</div>
                    <div class='border'></div>
                    <div class='text'>Section three</div>
                </div>
            `,
            title: 'separators'
        },
        {
            render: () => html`
                <div style='display: flex; flex-direction: column; gap: var(--size-400);'>
                    <div class='text'>Adjacent borders collapse (only one shows):</div>
                    <div class='border'></div>
                    <div class='border'></div>
                    <div class='text'>…still one line above.</div>
                </div>
            `,
            title: 'adjacent collapse'
        }
    ]
};


export default entry;
