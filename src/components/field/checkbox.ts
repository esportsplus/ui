import { reactive } from '@esportsplus/reactivity';
import { html, type Attributes, type Renderable } from '@esportsplus/template';
import { omit, pick } from '@esportsplus/utilities';
import template from '~/components/template';


type A = Attributes & {
    checked?: boolean;
    disabled?: boolean;
    name?: string;
    required?: boolean;
    type?: string;
    value?: unknown;
};


const OMIT_FIELD = ['state'];

const TAG = ['checked', 'disabled', 'name', 'required'];


function mask(attributes: A, modifier: string, state: { active: boolean }) {
    return html`
        <div
            class='field-mask'
            ${omit(attributes, TAG)}
            ${{
                class: `field-mask--${modifier}`
            }}
        >
            <input
                class='field-mask-tag field-mask-tag--hidden'
                ${{
                    checked: attributes.checked || attributes.value || state.active,
                    type: modifier === 'radio' ? 'radio' : 'checkbox',
                    value: attributes.value || 1
                }}
                ${pick(attributes, TAG) as Attributes}
            >
        </div>
    `;
}


const field = template.factory(
    function(
        this: ((attributes: A, state: { active: boolean }) => Renderable<unknown>),
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
                        if ((e.target as HTMLInputElement).type !== 'checkbox') {
                            return;
                        }

                        state.active = (e.target as HTMLInputElement)?.checked;
                    }
                }}
            >
                ${content((attributes) => this(attributes, state))}
            </label>
        `
    }
);


export default {
    checkbox: field.bind((attributes: A, state: { active: boolean }) => {
        return mask(attributes, 'checkbox', state);
    }),
    radio: field.bind((attributes: A, state: { active: boolean }) => {
        return mask(attributes, 'radio', state);
    }),
    switch: field.bind((attributes: A, state: { active: boolean }) => {
        return mask(attributes, 'switch', state);
    }),
};