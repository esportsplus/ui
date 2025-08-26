import { reactive, root } from '@esportsplus/reactivity';
import { html, type Attributes, type Renderable } from '@esportsplus/template';
import { omit } from '@esportsplus/utilities';
import template from '~/components/template';


type A = Attributes & {
    'field-mask-tag'?: Attributes
};


const OMIT_FIELD = ['state'];

const OMIT_TAG = ['field-mask-tag'];


function mask(attributes: A, modifier: string, state: { active: boolean }) {
    let a = attributes['field-mask-tag'] || {};

    return html`
        <div
            class='field-mask'
            ${omit(attributes, OMIT_TAG)}
            ${{
                class: `field-mask--${modifier}`
            }}
        >
            <input
                class='field-mask-tag field-mask-tag--hidden'
                ${{
                    checked: a.checked || root(() => state.active),
                    type: modifier === 'radio' ? 'radio' : 'checkbox',
                    value: a.value || 1
                }}
                ${a}
            >
        </div>
    `;
}


const field = template.factory(
    function(
        this: { mask: (attributes: A, state: { active: boolean }) => Renderable<unknown> },
        attributes: Attributes & { state?: { active: boolean } },
        content: (mask: ((attributes: A) => Renderable<unknown>)) => Renderable<unknown>
    ) {
        let state = attributes?.state || reactive({
                active: false
            });

        return html`
            <label
                class='field'
                ${omit(attributes, OMIT_FIELD)}
                ${{
                    class: () => state.active && '--active',
                    onchange: (e) => {
                        let target = (e.target as HTMLInputElement),
                            type = target.type;

                        if (type !== 'checkbox' && type !== 'radio') {
                            return;
                        }

                        state.active = target.checked;
                    }
                }}
            >
                ${content((attributes) => this.mask(attributes, state))}
            </label>
        `
    }
);


export default {
    checkbox: field.bind({
        mask: (attributes: A, state: { active: boolean }) => {
            return mask(attributes, 'checkbox', state);
        }
    }),
    radio: field.bind({
        mask: (attributes: A, state: { active: boolean }) => {
            return mask(attributes, 'radio', state);
        }
    }),
    switch: field.bind({
        mask: (attributes: A, state: { active: boolean }) => {
            return mask(attributes, 'switch', state);
        }
    }),
};