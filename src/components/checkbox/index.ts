import { html, reactive, root, type Attributes } from '@esportsplus/frontend';
import { omit } from '@esportsplus/utilities';
import form from '~/components/form';
import './scss/index.scss';


const OMIT = ['checked', 'value'];


const factory = (type: string) => {
    function template(
        this: { attributes?: Attributes } | any,
        attributes?: Attributes & { state?: { active: boolean, error: string } }
    ) {
        let state = attributes?.state || reactive({
                active: false,
                error: ''
            });

        if (attributes?.checked) {
            state.active = true;
        }

        return html`
            <div
                class='${type} ${() => state.active && '--active'}'
                ${this?.attributes && omit(this.attributes, OMIT)}
                ${attributes && omit(attributes, OMIT)}
            >
                <input
                    ${{
                        checked: attributes?.checked || root(() => state.active),
                        class: `${type}-tag`,
                        onchange: (e: Event) => {
                            state.active = (e.target as HTMLInputElement).checked;
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