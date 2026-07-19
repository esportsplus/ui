import { radio } from '@esportsplus/ui';
import { html } from '@esportsplus/template';
import type { Entry } from '~/viewer/types';


const entry: Entry = {
    name: 'radio',
    variants: [
        {
            render: () => html`
                <div style='display: flex; gap: var(--size-400); align-items: center;'>
                    ${radio({ checked: true, name: 'viewer-radio', value: 'a' })}
                    ${radio({ name: 'viewer-radio', value: 'b' })}
                    ${radio({ name: 'viewer-radio', value: 'c' })}
                </div>
            `,
            title: 'group'
        }
    ]
};


export default entry;
