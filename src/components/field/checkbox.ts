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


const TAG_KEYS = ['checked', 'disabled', 'name', 'required'];


function mask(attributes: A, modifier: string, state: { active: boolean }) {
    return html`
        <div
            class='
                ${`field-mask--${modifier}`}
                field-mask
            '
            ${omit(attributes, TAG_KEYS)}
        >
            <input
                ${attributes.checked || attributes.value || state.active && 'checked'}
                class='field-mask-tag field-mask-tag--hidden'
                type='${modifier === 'radio' ? 'radio' : 'checkbox'}'
                value='${attributes.value || 1}'
                ${pick(attributes, TAG_KEYS)}
            >
        </div>
    `;
}


const field = template.factory<
    Attributes & { state?: { active: boolean } },
    (mask: ((attributes: A) => Renderable)) => Renderable
>(
    function(
        this: ((attributes: A, state: { active: boolean }) => Renderable),
        attributes,
        content
    ) {
        let state = attributes.state || reactive({
                active: false
            });

        return html`
            <label
                class='
                    ${() => state.active && '--active'}
                    field
                '
                onchange='${(e: Event) => {
                    if ((e.target as HTMLInputElement).type !== 'checkbox') {
                        return;
                    }

                    state.active = (e.target as HTMLInputElement)?.checked;
                }}'
                ${omit(attributes, ['state'])}
            >
                ${content((attributes: A) => this(attributes, state))}
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