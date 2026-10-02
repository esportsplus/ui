import { html, type Attributes } from '@esportsplus/template';
import { reactive, root } from '@esportsplus/reactivity';
import form from '~/components/form';
import filter from './filter';
import './scss/index.scss';


function plain(
    this: { attributes?: Attributes } | void,
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
            class='range --border-black'
            style='${() => `--thumb-position: ${((state.value - min) / (max - min)) * 100}%`}'
            type='range'
            ${this?.attributes}
            ${attributes}
            ${{
                class: () => state.active && '--active',
                onconnect: form.input.onconnect(state),
                onfocusin: () => {
                    state.active = true;
                },
                onfocusout: () => {
                    state.active = false;
                },
                oninput: (e) => {
                    state.value = Number((e.target as HTMLInputElement).value);
                },
                value: root(() => (attributes?.value as number) || state.value || 0)
            }}
        />
    `;
}


const range: typeof plain & { filter: typeof filter } = Object.assign(plain, { filter });


export default range;
export type { RangeFilterState } from './filter';
