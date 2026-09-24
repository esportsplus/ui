import { html, type Attributes } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import form from '~/components/form';
import icon from '~/components/icon';
import { CHECKBOX_INPUT } from './constants';
import check from './svg/check.svg';
import './scss/index.scss';


type A = Attributes & { [CHECKBOX_INPUT]?: Attributes };


const factory = (type: 'checkbox' | 'radio' | 'switch') => {
    function template(
        this: { attributes?: A } | void,
        { state = reactive({ error: '' }), ...attributes }: A & { state?: { error: string } } = {}
    ) {
        return html`
            <div
                class='checkbox ${(type === 'radio' || type === 'switch') && `checkbox--${type}`}'
                ${this?.attributes}
                ${attributes}
            >
                <input
                    class='checkbox-tag'
                    value='1'
                    ${this?.attributes?.[CHECKBOX_INPUT]}
                    ${attributes[CHECKBOX_INPUT]}
                    onrender=${form.input.onrender(state)}
                    type=${type === 'radio' ? 'radio' : 'checkbox'}
                >
                ${type === 'checkbox' && icon({ 'aria-hidden': true, class: 'checkbox-check' }, check)}
            </div>
        `;
    }

    return Object.assign(template, { input: CHECKBOX_INPUT } as const);
};


export default factory('checkbox');
export { factory };
