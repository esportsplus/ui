import { html, type Attributes } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import form from '~/components/form';
import icon from '~/components/icon';
import check from './svg/check.svg';
import './scss/index.scss';


type A = Attributes & {
    'aria-label'?: string;
    checked?: boolean;
    id?: string;
    name?: string;
    state?: { error: string };
    value?: number | string;
};


const factory = (type: 'checkbox' | 'radio' | 'switch') => {
    function template(
        this: { attributes?: Exclude<A, 'state'> } | void,
        { 'aria-label': ariaLabel, checked, id, name, state = reactive({ error: '' }), value = 1, ...attributes }: A = {}
    ) {
        let { 'aria-label': defaultAriaLabel, checked: _checked, id: defaultId, name: defaultName, state: _state, value: _value, ...defaults }: A = this?.attributes ?? {};

        return html`
            <div
                class='checkbox ${(type === 'radio' || type === 'switch') && `checkbox--${type}`}'
                ${defaults}
                ${attributes}
            >
                <input
                    aria-label=${ariaLabel ?? defaultAriaLabel}
                    checked=${checked}
                    class='checkbox-tag'
                    id=${id ?? defaultId}
                    name=${name ?? defaultName}
                    onrender=${form.input.onrender(state)}
                    type=${type === 'radio' ? 'radio' : 'checkbox'}
                    value=${value}
                >
                ${type === 'checkbox' && icon({ 'aria-hidden': true, class: 'checkbox-check' }, check)}
            </div>
        `;
    }

    return template;
};


export default factory('checkbox');
export { factory };
