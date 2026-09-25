import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { colorPicker } from '@esportsplus/ui';
import './color-picker.scss';


export default {
    name: 'color-picker',
    variants: [
        {
            render: () => colorPicker(),
            title: 'default'
        },
        {
            render: () => {
                let state = reactive({ error: '', value: '#30A46C80' });

                return html`
                    <div class='color-picker-demo'>
                        ${colorPicker({ recent: ['#111111', '#FFFFFF'], state })}
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
