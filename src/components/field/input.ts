import { reactive } from '@esportsplus/reactivity';
import { html, type Attributes, type Renderable } from '@esportsplus/template';
import { omit } from '@esportsplus/utilities';
import form from '~/components/form';
import template from '~/components/template';
import error from './error';


type A = Attributes & {
    'field-mask-tag'?: Attributes
};


const OMIT_FIELD = ['state'];

const OMIT_TAG = ['field-mask-tag'];


const field = template.factory(
    function(
        this: { mask: typeof file | typeof text | typeof textarea },
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
                ${omit(attributes, OMIT_FIELD)}
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
                    // @ts-ignore
                    (...args: any[]) => this.mask.call({ state }, ...args)
                )}
                ${error(state)}
            </div>
        `;
    }
);

const file = template.factory(
    function(this: { state: { active: boolean, error: string } }, attributes: A, content) {
        return html`
            <label
                class='field-mask field-mask--file'
                ${omit(attributes, OMIT_TAG)}
            >
                <input
                    class='field-mask-tag field-mask-tag--hidden'
                    type='file'
                    ${attributes['field-mask-tag']}
                    ${{
                        onrender: form.input.onrender(this.state)
                    }}
                >

                ${content}
            </label>
        `;
    }
);

const text = template.factory(
    function(this: { state: { active: boolean, error: string } }, attributes: A, content) {
        return html`
            <label
                class='field-mask field-mask--input'
                ${omit(attributes, OMIT_TAG)}
            >
                <input
                    class='field-mask-tag'
                    ${attributes['field-mask-tag']}
                    ${{
                        onrender: form.input.onrender(this.state),
                        type: attributes.type || 'text'
                    }}
                >
                ${content}
            </label>
        `;
    }
);

const textarea = template.factory(
    function(this: { state: { active: boolean, error: string } }, attributes: A, content) {
        let a = attributes['field-mask-tag'] || {};

        return html`
            <label
                class='field-mask field-mask--textarea'
                ${omit(attributes, OMIT_TAG)}
            >
                <textarea
                    class='field-mask-tag'
                    ${a}
                    ${{
                        onrender: form.input.onrender(this.state)
                    }}
                >
                    ${a.value as string}
                </textarea>
                ${content}
            </label>
        `;
    }
);


export default {
    file: field.bind({ mask: file }),
    text: field.bind({ mask: text }),
    textarea: field.bind({ mask: textarea })
};
