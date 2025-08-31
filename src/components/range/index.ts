import { reactive, root } from '@esportsplus/reactivity';
import { html, type Attributes } from '@esportsplus/template';
import form from '~/components/form';
import template from '~/components/template';
import './scss/index.scss';


type A = Attributes & { state?: { active: boolean, error: string, value: number } };


export default template.factory<A, never>(
    function(attributes) {
        let state = attributes.state || reactive({
                active: false,
                error: '',
                value: 0
            });

        if (attributes?.value) {
            state.value = Number( attributes.value );
        }

        return html`
            <input
                class='range --border-state --border-black'
                type='range'
                ${{
                    class: () => state.active && '--active',
                    onfocusin: () => {
                        state.active = true;
                    },
                    onfocusout: () => {
                        state.active = false;
                    },
                    oninput: (e) => {
                        state.value = Number((e.target as HTMLInputElement).value);
                    },
                    onrender: form.input.onrender(state),
                    value: root(() => (attributes?.value as number) || state.value || 0)
                }}
                ${attributes}
            />
        `;
    }
);