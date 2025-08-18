import { reactive } from '@esportsplus/reactivity';
import { html, type Attributes, type Renderable } from '@esportsplus/template';
import { omit, pick } from '@esportsplus/utilities';
import form from '~/components/form';
import template from '~/components/template';
import error from './error';


const FILE_TAG = ['accept', 'disabled', 'name', 'required', 'value'];

const OMIT = ['state'];

const TEXT_TAG = [
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


const field = template.factory(
    function(
        this: typeof text | typeof textarea,
        attributes: Attributes & { state?: { active: boolean, error: string } },
        content: (mask: typeof file | typeof text | typeof textarea) => Renderable<unknown>
    ) {
        let state = attributes.state || reactive({
                active: false,
                error: ''
            });

        return html`
            <div
                class='field'
                ${omit(attributes, OMIT)}
                ${{
                    class: () => state.active && '--active',
                    onfocusin: () => {
                        state.active = true;
                    },
                    onfocusout: () => {
                        state.active = false;
                    }
                }}
            >
                ${content(
                    ((...args: any[]) => (this.call as any)(state, ...args))
                )}
                ${error(state)}
            </div>
        `;
    }
);

const file = template.factory(
    function(this: { active: boolean, error: string }, attributes, content) {
        return html`
            <label
                class='field-mask field-mask--file'
                ${omit(attributes, FILE_TAG)}
            >
                <input
                    class='field-mask-tag field-mask-tag--hidden'
                    type='file'
                    ${pick(attributes, FILE_TAG) as Attributes}
                    ${{
                        onrender: form.input.onrender(this)
                    }}
                >

                ${content}
            </label>
        `;
    }
);

const text = template.factory(
    function(this: { active: boolean, error: string }, attributes, content) {
        return html`
            <label class='field-mask field-mask--input' ${omit(attributes, TEXT_TAG)}>
                <input
                    class='field-mask-tag'
                    ${pick(attributes, TEXT_TAG) as Attributes}
                    ${{
                        onrender: form.input.onrender(this),
                        type: attributes.type || 'text'
                    }}
                >
                ${content}
            </label>
        `;
    }
);

const textarea = template.factory(
    function(this: { active: boolean, error: string }, attributes: Attributes & { value?: string }, content) {
        return html`
            <label
                class='field-mask field-mask--textarea'
                ${omit(attributes, TEXT_TAG)}
            >
                <textarea
                    class='field-mask-tag'
                    ${pick(attributes, TEXT_TAG) as Attributes}
                    ${{
                        onrender: form.input.onrender(this)
                    }}
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
