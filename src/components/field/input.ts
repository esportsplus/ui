import { reactive } from '@esportsplus/reactivity';
import { html, type Attributes, type Renderable } from '@esportsplus/template';
import { omit, pick } from '@esportsplus/utilities';
import form from '~/components/form';
import template from '~/components/template';
import error from './error';


const FILE_TAG_KEYS = ['accept', 'disabled', 'name', 'required', 'value'];

const TEXT_TAG_KEYS = [
    'autocapitalize',
    'autocomplete',
    'autocorrect',
    'autofocus',
    'disabled',
    'maxlength',
    'minlength',
    'name',
    'placeholder',
    'readonly',
    'required',
    'spellcheck',
    'type',
    'value',
    'wrap'
];


const field = template.factory<
    Attributes & { state?: { active: boolean, error: string } },
    (mask: typeof file | typeof text | typeof textarea) =>  Renderable
>(
    function(
        this: typeof text | typeof textarea,
        attributes,
        content
    ) {
        let state = attributes.state || reactive({
                active: false,
                error: ''
            });

        return html`
            <div
                class='
                    ${() => state.active && '--active'}
                    field
                '
                onfocusin='${() => {
                    state.active = true;
                }}'
                onfocusout='${() => {
                    state.active = false;
                }}'
                ${omit(attributes, ['state'])}
            >
                ${content(
                    ((...args: any[]) => (this.call as any)(state, ...args))
                )}
                ${error(state)}
            </div>
        `;
    }
);

const file = template.factory<Attributes>(
    function(this: { active: boolean, error: string }, attributes, content) {
        return html`
            <label
                class='field-mask field-mask--file'
                ${omit(attributes, FILE_TAG_KEYS)}
            >
                <input
                    class='field-mask-tag field-mask-tag--hidden'
                    onrender='${form.input.onrender(this)}'
                    type='file'
                    ${pick(attributes, FILE_TAG_KEYS)}
                >

                ${content}
            </label>
        `;
    }
);

const text = template.factory<Attributes>(
    function(this: { active: boolean, error: string }, attributes, content) {
        return html`
            <label class='field-mask field-mask--input' ${omit(attributes, TEXT_TAG_KEYS)}>
                <input
                    class='field-mask-tag'
                    onrender='${form.input.onrender(this)}'
                    type='${attributes.type || 'text'}'
                    ${pick(attributes, TEXT_TAG_KEYS)}
                >
                ${content}
            </label>
        `;
    }
);

const textarea = template.factory<Attributes>(
    function(this: { active: boolean, error: string }, attributes, content) {
        return html`
            <label class='field-mask field-mask--textarea' ${omit(attributes, TEXT_TAG_KEYS)}>
                <textarea
                    class='field-mask-tag'
                    onrender='${form.input.onrender(this)}'
                    ${pick(attributes, TEXT_TAG_KEYS)}
                >
                    ${attributes.value}
                </textarea>
                ${content}
            </label>
        `;
    }
);


export default {
    file: field.bind(file),
    text: field.bind(text),
    textarea: field.bind(textarea)
};
