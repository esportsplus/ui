import { reactive, root } from '@esportsplus/reactivity';
import { html, type Attributes } from '@esportsplus/template';
import { omit } from '@esportsplus/utilities';
import form from '~/components/form';
import template from '~/components/template';
import './scss/index.scss';


type A = Attributes & {
    'range-tag'?: Attributes,
    state?: { active: boolean, error: string, value: number }
};


const OMIT = ['range-tag'];


export default template.factory(
    function(attributes: A, content) {
        let a = attributes['range-tag'],
            state = attributes.state || reactive({
                active: false,
                error: '',
                value: 0
            });

        if (a?.value) {
            state.value = Number( a.value );
        }

        return html`
            <div
                class='range --border-state --border-black'
                ${{
                    class: () => state.active && '--active',
                    onfocusin: () => {
                        state.active = true;
                    },
                    onfocusout: () => {
                        state.active = false;
                    }
                }}
                ${a ? omit(attributes, OMIT) : attributes}
            >
                <input
                    class='range-tag'
                    type='range'
                    ${{
                        oninput: (e) => {
                            state.value = Number((e.target as HTMLInputElement).value);
                        },
                        onrender: form.input.onrender(state),
                        value: root(() => (a?.value as number) || state.value || 0)
                    }}
                    ${a}
                >
                ${content}
            </div>
        `;
    }
);