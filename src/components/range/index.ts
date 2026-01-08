import { html, reactive, root, type Attributes } from '@esportsplus/template';
import form from '~/components/form';
import './scss/index.scss';


export default function(
    this: { attributes?: Attributes } | any,
    attributes: Attributes & { max: number, min: number, state?: { active: boolean, error: string, value: number } }
) {
    let { max, min } = attributes,
        state = attributes.state || reactive({
            active: false,
            error: '',
            value: 0
        });

    if (attributes?.value) {
        state.value = Number( attributes.value );
    }

    return html`
        <input
            class='range --border-state --border-black'
            style='${() => `--thumb-position: ${((state.value - min) / (max - min)) * 100}%`}'
            type='range'
            ${this?.attributes}
            ${attributes}
            ${{
                class: () => state.active && '--active',
                onfocusin: () => {
                    state.active = true;
                },
                onfocusout: () => {
                    state.active = false;
                },
                oninput: (e) => {
                    state.value = Number((e.target as HTMLInputElement).value);
                },
                onrender: form.input.onrender(state),
                value: root(() => (attributes?.value as number) || state.value || 0)
            }}
        />
    `;
};