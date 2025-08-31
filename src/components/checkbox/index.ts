import { reactive, root } from '@esportsplus/reactivity';
import { html, type Attributes } from '@esportsplus/template';
import { omit } from '@esportsplus/utilities';
import form from '~/components/form';
import './scss/index.scss';


const OMIT = ['checked', 'value'];


const template = function(
    this: { type: string },
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
        <div class='${this.type} ${() => state.active && '--active'}' ${attributes && omit(attributes, OMIT)}>
            <input
                ${{
                    checked: attributes?.checked || root(() => state.active),
                    class: `${this.type}-tag`,
                    onchange: (e: Event) => {
                        state.active = (e.target as HTMLInputElement).checked;
                    },
                    onrender: form.input.onrender(state),
                    type: this.type === 'radio' ? 'radio' : 'checkbox',
                    value: attributes?.value || 1
                }}
            >
        </div>
    `;
};


export default template.bind({ type: 'checkbox' });
export { template };