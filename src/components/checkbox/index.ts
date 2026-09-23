import { html, type Attributes } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import { omit } from '@esportsplus/utilities';
import form from '~/components/form';
import icon from '~/components/icon';
import check from './svg/check.svg';
import './scss/index.scss';


const OMIT = ['checked', 'id', 'name', 'state', 'value'];


const factory = (type: 'checkbox' | 'radio' | 'switch') => {
    function template(
        this: { attributes?: Attributes } | any,
        attributes?: Attributes & { state?: { active: boolean, error: string } }
    ) {
        let state = attributes?.state || reactive({
                error: ''
            });

        return html`
            <div
                class='checkbox ${(type === 'radio' || type === 'switch') && `checkbox--${type}`}'
                ${this?.attributes && omit(this.attributes, OMIT)}
                ${attributes && omit(attributes, OMIT)}
            >
                <input
                    ${{
                        'aria-label': attributes?.['aria-label'] ?? this?.attributes?.['aria-label'],
                        checked: attributes?.checked,
                        class: 'checkbox-tag',
                        id: attributes?.id ?? this?.attributes?.id,
                        name: attributes?.name ?? this?.attributes?.name,
                        onrender: form.input.onrender(state),
                        type: type === 'radio' ? 'radio' : 'checkbox',
                        value: attributes?.value ?? 1
                    }}
                >
                ${type === 'checkbox' && icon({ 'aria-hidden': 'true', class: 'checkbox-check' }, check)}
            </div>
        `;
    }

    return template;
};


export default factory('checkbox');
export { factory };
