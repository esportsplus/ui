import { json } from '@esportsplus/ui/components';
import { html } from '@esportsplus/template';


export default {
    name: 'json',
    variants: [
        {
            render: () => html`
                <button
                    class='button button--primary'
                    style='--width: auto;'
                    onclick='${() => json.download({ component: 'json', exported: true, values: [1, 2, 3] }, 'demo')}'
                    type='button'
                >
                    download demo.json
                </button>
            `,
            title: 'download'
        }
    ]
};
