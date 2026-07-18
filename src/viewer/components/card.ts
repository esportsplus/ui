import { html } from '@esportsplus/template';
import type { Entry } from '../types';


let box = '--padding-horizontal: var(--size-500); --padding-vertical: var(--size-500); --border-radius: var(--border-radius-400); --width: 200px; background: var(--color-grey-300);';


const entry: Entry = {
    name: 'card',
    variants: [
        {
            render: () => html`
                <div class='card' style='${box} --box-shadow: var(--box-shadow-300);'>
                    <div class='text'>Card with shadow</div>
                </div>
            `,
            title: 'default'
        },
        {
            render: () => html`
                <div class='card card--flat' style='${box}'>
                    <div class='text'>Flat card (no shadow)</div>
                </div>
            `,
            title: 'flat'
        },
        {
            render: () => html`
                <div style='display: flex;'>
                    <div class='card card--option' style='${box} --width: 150px; border: 1px solid var(--color-border-400);'>
                        <div class='text'>Option A</div>
                    </div>
                    <div class='card card--option' style='${box} --width: 150px; border: 1px solid var(--color-border-400);'>
                        <div class='text'>Option B</div>
                    </div>
                </div>
            `,
            title: 'option group'
        }
    ]
};


export default entry;
