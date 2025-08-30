import { reactive, root } from '@esportsplus/reactivity';
import { html, type Attributes } from '@esportsplus/template';
import { omit } from '@esportsplus/utilities';
import form from '~/components/form';
import './scss/index.scss';


type A = Attributes & {
    'checkbox-tag'?: Attributes,
    state?: { active: boolean, error: string }
};


const OMIT = ['checkbox-tag'];


export default function(attributes?: A) {
    let a = attributes?.['checkbox-tag'],
        state = attributes?.state || reactive({
            active: false,
            error: ''
        });

    if (a?.checked) {
        state.active = true;
    }

    return html`
        <div class='checkbox ${() => state.active && '--active'}' ${a ? omit(attributes!, OMIT) : attributes}>
            <input
                class='checkbox-tag'
                type='checkbox'
                ${{
                    checked: a?.checked || root(() => state.active),
                    onchange: (e: Event) => {
                        state.active = (e.target as HTMLInputElement).checked;
                    },
                    onrender: form.input.onrender(state),
                    value: a?.value || 1
                }}
                ${a}
            >
        </div>
    `;
};