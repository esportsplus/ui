import { html, type Attributes } from '@esportsplus/template';
import { reactive, root } from '@esportsplus/reactivity';
import { omit } from '@esportsplus/utilities';
import form from '~/components/form';
import './scss/index.scss';


const OMIT = ['checked', 'value'];


const factory = (type: string) => {
    function template(
        this: { attributes?: Attributes } | any,
        attributes?: Attributes & { state?: { active: boolean, error: string } }
    ) {
        let ref: HTMLElement,
            state = attributes?.state || reactive({
                active: false,
                error: ''
            });

        if (attributes?.checked) {
            state.active = true;
        }

        return html`
            <div
                class='${() => state.active ? type + " --active" : type}'
                ${this?.attributes && omit(this.attributes, OMIT)}
                ${attributes && omit(attributes, OMIT)}
                onclick=${() => ref.click()}
            >
                <input
                    ${{
                        checked: attributes?.checked || root(() => state.active),
                        class: `${type}-tag`,
                        onchange: (e: Event) => {
                            state.active = (e.target as HTMLInputElement).checked;
                        },
                        onconnect: (input) => {
                            ref = input;
                        },
                        onrender: form.input.onrender(state),
                        type: type === 'radio' ? 'radio' : 'checkbox',
                        value: attributes?.value || 1
                    }}
                >
            </div>
        `;
    }

    return template;
};


export default factory('checkbox');
export { factory };