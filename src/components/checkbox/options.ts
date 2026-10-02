import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import form from '~/components/form';
import icon from '~/components/icon';
import check from '@esportsplus/ui/svg/check.svg';
import { group } from './group';
import './scss/index.scss';


type A = Attributes & { type?: never };

type Attr = A & { [CHECKBOX_INPUT]?: A };


const CHECKBOX_INPUT = Symbol.for('@esportsplus/ui/checkbox.input');


function factory<const P extends Record<PropertyKey, unknown> = {}>(type: 'checkbox' | 'radio' | 'switch', properties?: P) {
    return component(
        function(
            this: { attributes?: Attr } | void,
            { state = reactive({ error: '' }), ...attributes }: Attr & { state?: { error: string } },
            content?: Renderable<unknown>
        ) {
            return html`
                <div
                    class='checkbox ${(type === 'radio' || type === 'switch') && `checkbox--${type}`}'
                    ${this?.attributes}
                    ${attributes}
                >
                    <input
                        class='checkbox-tag'
                        onconnect=${form.input.onconnect(state)}
                        type=${type === 'radio' ? 'radio' : 'checkbox'}
                        value='1'
                        ${this?.attributes?.[CHECKBOX_INPUT]}
                        ${attributes[CHECKBOX_INPUT]}
                    >
                    ${type === 'checkbox' && icon({ 'aria-hidden': true, class: 'checkbox-check' }, check)}
                    ${content}
                </div>
            `;
        },
        { ...properties as P, input: CHECKBOX_INPUT }
    );
}


// Every component built from the template is created here, beside the input symbol, so their types stay inferred.
export default {
    checkbox: factory('checkbox', { group: group('checkbox') }),
    radio: factory('radio'),
    switch: factory('switch', { group: group('switch') })
};
export type { Attr };
