import { html, type Attributes } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import form from '~/components/form';
import icon from '~/components/icon';
import check from './svg/check.svg';
import './scss/index.scss';


type A = Attributes & { onrender?: never, type?: never };

type Attr = A & { [CHECKBOX_INPUT]?: A };


const CHECKBOX_INPUT = Symbol.for('@esportsplus/ui/checkbox.input');


const factory = (type: 'checkbox' | 'radio' | 'switch') => {
    function template(
        this: { attributes?: Attr } | void,
        { state = reactive({ error: '' }), ...attributes }: Attr & { state?: { error: string } } = {}
    ) {
        return html`
            <div
                class='checkbox ${(type === 'radio' || type === 'switch') && `checkbox--${type}`}'
                ${this?.attributes}
                ${attributes}
            >
                <input
                    class='checkbox-tag'
                    onrender=${form.input.onrender(state)}
                    type=${type === 'radio' ? 'radio' : 'checkbox'}
                    value='1'
                    ${this?.attributes?.[CHECKBOX_INPUT]}
                    ${attributes[CHECKBOX_INPUT]}
                >
                ${type === 'checkbox' && icon({ 'aria-hidden': true, class: 'checkbox-check' }, check)}
            </div>
        `;
    }

    return Object.assign(template, { input: CHECKBOX_INPUT } as const);
};


export default factory('checkbox');
export { factory, CHECKBOX_INPUT };
