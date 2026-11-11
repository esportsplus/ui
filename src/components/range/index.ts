import { reactive } from '@esportsplus/reactivity';
import { html, type Attributes } from '@esportsplus/template';
import form from '~/components/form';
import filter from './filter';
import surface from './surface';
import './scss/index.scss';


type A = Attributes & {
    max: number;
    min: number;
    orientation?: 'horizontal' | 'vertical';
    state?: State;
};

type State = { active: boolean; error: string; value: number };


// The track paints its own fill up to the thumb from '--thumb-position', so the native input needs no extra parts.
function plain(
    this: { attributes?: Attributes } | void,
    {
        max,
        min,
        orientation = 'horizontal',
        state = reactive({ active: false, error: '', value: min }),
        value,
        ...attributes
    }: A
) {
    if (value !== undefined) {
        state.value = Number(value);
    }

    let span = max - min || 1;

    return html`
        <input
            aria-orientation='${orientation}'
            class='range ${orientation === 'vertical' && 'range--vertical'}'
            style='${() => `--thumb-position: ${((state.value - min) / span) * 100}%`}'
            type='range'
            ${this?.attributes}
            max='${max}'
            min='${min}'
            ${attributes}
            ${form.input.attributes(state)}
            ${{
                oninput: (event: Event) => {
                    state.value = Number((event.target as HTMLInputElement).value);
                },
                value: () => state.value
            }}
        />
    `;
}


const range: typeof plain & { filter: typeof filter, surface: typeof surface } = Object.assign(plain, { filter, surface });


export default range;
export type { RangeFilterState } from './filter';
export type { RangeSurfaceState } from './surface';
