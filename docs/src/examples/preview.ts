import { preview } from '@esportsplus/ui/components';
import { html } from '@esportsplus/template';


function demo() {
    return html`<button class='button' style='--width: auto;' type='button'>Hello</button>`;
}


export default {
    name: 'preview',
    variants: [
        {
            render: () => html`
                <div style='width: 100%;'>
                    ${preview({}, [
                        preview.header({ index: 1, title: 'Example' }),
                        preview.stage({}, demo)
                    ])}
                </div>
            `,
            title: 'default'
        }
    ]
};
