import { reactive } from '@esportsplus/reactivity';
import { html, type Renderable } from '@esportsplus/template';
import { colorPicker } from '@esportsplus/ui/components';
import 'docs/examples/color-picker/scss/index.scss';


function card(content: Renderable<unknown>) {
    return html`<div class='card color-picker-demo-card'>${content}</div>`;
}


export default {
    name: 'color-picker',
    variants: [
        {
            render: () => card(colorPicker({ value: '#5B8DEF' })),
            title: 'default'
        },
        {
            render: () => card(colorPicker({ compact: true, value: '#384251' })),
            title: 'compact'
        },
        {
            render: () => card(colorPicker({ recent: ['#E5484D', '#F5A524', '#30A46C', '#0090FF', '#8E4EC6'], value: '#5B8DEF' })),
            title: 'recent colors'
        },
        {
            render: () => card(colorPicker({ recent: false, value: '#5B8DEF' })),
            title: 'recent: false'
        },
        {
            render: () => {
                let state = reactive({ error: '', value: '' });

                return html`
                    <div class='color-picker-demo'>
                        ${card(colorPicker({ recent: ['#111111', '#FFFFFF'], state, value: '#30A46C80' }))}
                        <div class='color-picker-demo-output'>
                            <span class='color-picker-demo-chip' style='${() => `--chip: ${state.value};`}'></span>
                            <code>${() => state.value}</code>
                        </div>
                    </div>
                `;
            },
            title: 'controlled state'
        }
    ]
};
