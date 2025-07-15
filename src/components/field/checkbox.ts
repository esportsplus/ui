import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { omit } from '@esportsplus/utilities';
import description from './description';


type Data = {
    class?: string;
    content?: unknown;
    description?: unknown;
    mask?: Record<string, unknown>;
    name?: string;
    style?: string;
    tag?: Record<string, unknown>;
    title: string;
    value?: unknown;
} & Record<string, unknown>;


const FIELD_OMIT: (keyof Data)[] = ['content', 'description', 'mask', 'name', 'title', 'value'];


export default (data: Data) => {
    let state = reactive({
            active: false
        });

    return html`
        <div
            class='
                ${() => state.active && '--active'}
                field
                --flex-column
            '
            onchange='${(e: Event) => {
                if ((e.target as HTMLInputElement).type !== 'checkbox') {
                    return;
                }

                state.active = (e.target as HTMLInputElement)?.checked;
            }}'
            ${omit(data, FIELD_OMIT)}
        >
            <div class='field-title --flex-horizontal-space-between --flex-vertical'>
                ${data.title}

                <label
                    class='
                        ${data.mask?.class && String(data.mask.class).indexOf('field-mask--switch') !== -1 && 'field-mask--switch'}
                        field-mask
                        --margin-left --margin-400
                    '
                    ${data.mask}
                >
                    <input
                        ${(data.class && data.class.indexOf('--active') !== -1) || data.value ? 'checked' : ''}
                        ${data.name && `name='${data.name}'`}
                        class='field-tag field-tag--hidden'
                        type='checkbox'
                        value='1'
                        ${data.tag}
                    >
                </label>
            </div>

            ${data.content || ''}

            ${description(data)}
        </div>
    `
};