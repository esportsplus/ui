import { component, html, type Attributes } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import form from '~/components/form';
import './scss/index.scss';


type Autoresize = { height: { max: `${number}px`, min: `${number}px` } };


function autoresize({ height }: Autoresize) {
    let attributes = {
            class: 'textarea--autoresize',
            style: `
                --max-height: ${height.max};
                --min-height: ${height.min};
            `
        };

    if (CSS.supports('field-sizing', 'content')) {
        return attributes;
    }

    return {
        ...attributes,
        class: `${attributes.class} textarea--autoresize-fallback`,
        oninput: (e: InputEvent) => {
            let element = e.target as HTMLTextAreaElement;

            element.style.setProperty('--content-height', '0px');
            element.style.setProperty('--content-height', `${element.scrollHeight}px`);
        }
    };
}


export default component(function(
    this: { attributes?: Attributes },
    {
        autoresize: resize,
        state = reactive({
            active: false,
            error: ''
        }),
        ...attributes
    }: Attributes & {
        autoresize?: Autoresize,
        state?: { active: boolean, error: string }
    }
) {
    attributes.value ??= '';

    return html`
        <textarea
            class='textarea'
            ${this?.attributes}
            ${attributes}
            ${resize && autoresize(resize)}
            ${{
                class: () => state.active && '--active',
                onfocusin: () => {
                    state.active = true;
                },
                onfocusout: () => {
                    state.active = false;
                },
                onrender: form.input.onrender(state)
            }}
        ></textarea>
    `;
});
