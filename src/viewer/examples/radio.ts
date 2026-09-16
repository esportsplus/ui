import { radio } from '@esportsplus/ui';
import { html } from '@esportsplus/template';
import type { Entry } from '~/viewer/types';


let style = '--accent: var(--color-white); --background-active: var(--color-primary-400); --border-color-active: var(--color-primary-400); --border-color-default: var(--color-border-500); --border-width: var(--border-width-400); --size: var(--size-500);';


const entry: Entry = {
    name: 'radio',
    variants: [
        {
            render: () => html`
                <div style='display: flex; gap: var(--size-400); align-items: center;'>
                    ${radio({ checked: true, name: 'viewer-radio', style, value: 'a' })}
                    ${radio({ name: 'viewer-radio', style, value: 'b' })}
                    ${radio({ name: 'viewer-radio', style, value: 'c' })}
                </div>
            `,
            title: 'group'
        }
    ]
};


export default entry;
