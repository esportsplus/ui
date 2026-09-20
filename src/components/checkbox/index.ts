import { html, type Attributes } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import { omit } from '@esportsplus/utilities';
import form from '~/components/form';
import icon from '~/components/icon';
import check from './svg/check.svg';
import './scss/index.scss';


const OMIT = ['checked', 'state', 'value'];


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
                onclick=${(event: MouseEvent) => {
                    if (event.target !== ref) {
                        ref.click();
                    }
                }}
            >
                <input
                    ${{
                        checked: () => state.active,
                        'aria-label': attributes?.['aria-label'] ?? this?.attributes?.['aria-label'],
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
                ${type === 'checkbox' && icon({ class: 'checkbox-check', 'aria-hidden': 'true' }, check)}
            </div>
        `;
    }

    return template;
};


export default factory('checkbox');
export { factory };
