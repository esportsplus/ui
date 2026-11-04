import { reactive } from '@esportsplus/reactivity';
import { html, type Attributes } from '@esportsplus/template';
import form from '~/components/form';
import filter from './filter';
import './scss/index.scss';


function plain(
    this: { attributes?: Attributes } | void,
    {
        max,
        min,
        orientation = 'horizontal',
        state = reactive({ active: false, error: '', value: 0 }),
        value,
        ...attributes
    }: Attributes & { max: number, min: number, orientation?: 'horizontal' | 'vertical', state?: { active: boolean, error: string, value: number } }
) {
    if (value) {
        state.value = Number(value);
    }

    return html`
        <input
            aria-orientation='${orientation}'
            class='range ${orientation === 'vertical' && 'range--vertical'}'
            style='${() => `--thumb-position: ${((state.value - min) / (max - min)) * 100}%`}'
            type='range'
            ${this?.attributes}
            max='${max}'
            min='${min}'
            ${attributes}
            ${form.input.attributes(state)}
            ${{
                oninput: (e) => {
                    state.value = Number((e.target as HTMLInputElement).value);
                },
                value: () => state.value
            }}
        />
    `;
}


const range: typeof plain & { filter: typeof filter } = Object.assign(plain, { filter });


export default range;
export type { RangeFilterState } from './filter';
