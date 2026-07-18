import { json } from '@esportsplus/ui';
import { html } from '@esportsplus/template';
import type { Entry } from '../types';


const entry: Entry = {
    name: 'json',
    variants: [
        {
            render: () => html`
                <div
                    class='button button--primary'
                    style='--width: auto;'
                    onclick='${() => json.download({ component: 'json', exported: true, values: [1, 2, 3] }, 'demo.json')}'
                >
                    download demo.json
                </div>
            `,
            title: 'download'
        }
    ]
};


export default entry;
