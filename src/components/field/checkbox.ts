import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import description from './description';


type Data = {
    class?: string;
    field?: {
        content?: any;
    };
    mask?: {
        class?: string;
        style?: string;
    };
    name?: string;
    style?: string;
    title: string;
    value?: any;
} & Parameters<typeof description>[0];


export default (data: Data) => {
    let state = reactive({
            active: false
        });

    return html`
        <div
            class="field --flex-column ${data?.class || ''} ${() => state.active ? '--active' : ''}"
            onchange='${(e: Event) => {
                if ((e.target as HTMLInputElement).type !== 'checkbox') {
                    return;
                }

                state.active = (e.target as HTMLInputElement)?.checked;
            }}'
            style='${data?.style || ''}'
        >
            <div class="field-title --flex-horizontal-space-between --flex-vertical">
                ${data.title}

                <label
                    class="field-mask ${(data?.mask?.class || '').indexOf('field-mask--switch') === -1 ? 'field-mask--checkbox' : ''} --margin-left --margin-400 ${data?.mask?.class || ''}"
                    style='${data?.mask?.style || ''}'
                >
                    <input
                        class='field-tag field-tag--hidden'
                        ${data.name ? `name='${data.name}'` : ''}
                        type='checkbox'
                        value='1'
                        ${(data?.class || '').indexOf('--active') !== -1 || data?.value ? 'checked' : ''}
                    >
                </label>
            </div>

            ${data?.field?.content || ''}

            ${description(data)}
        </div>
    `
};