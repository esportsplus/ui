import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { sheet } from '@esportsplus/ui';
import './sheet.scss';


function demo(variant: string, title: string, description: string) {
    let state = reactive({ active: false });

    return html`
        <button class='sheet-demo-open' type='button' onclick='${() => state.active = true}'>
            Open sheet
        </button>

        ${sheet(
            { class: variant, label: title, state },
            html`
                <h2 class='sheet-demo-title'>${title}</h2>
                <p class='sheet-demo-text'>${description}</p>
                <button class='sheet-demo-done' type='button' onclick='${() => state.active = false}'>
                    Done
                </button>
            `
        )}
    `;
}


export default {
    name: 'sheet',
    variants: [
        {
            render: () => demo('', 'Lab notes', 'Drag this sheet down to close it. A quick flick works too, and dragging it up pushes back.'),
            title: 'drag to dismiss'
        },
        {
            render: () => demo('sheet--full', 'Full width', 'Spans the whole viewport with a tighter corner, like a mobile action sheet.'),
            title: 'full width'
        }
    ]
};
