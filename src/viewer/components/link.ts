import { html } from '@esportsplus/template';
import type { Entry } from '../types';


let color = '--color: var(--color-purple-300); --width: auto;';


const entry: Entry = {
    name: 'link',
    variants: [
        {
            render: () => html`<div class='link' style='${color}'>Basic link</div>`,
            title: 'default'
        },
        {
            render: () => html`<div class='link link--underline' style='${color}'>Underline on hover</div>`,
            title: 'underline'
        },
        {
            render: () => html`
                <div class='link' style='${color} overflow: hidden;'>
                    <span class='link-hover link-hover--one'>Hover swap</span>
                    <span class='link-hover link-hover--two'>Swapped!</span>
                </div>
            `,
            title: 'hover swap layers'
        }
    ]
};


export default entry;
