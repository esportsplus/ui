import { component, html, type Attributes } from '@esportsplus/template';
import bind from './bind';
import './scss/index.scss';


type A = Attributes & {
    disabled?: boolean;
    duration?: number;
    onlongpress: VoidFunction;
    onlongpresscancel?: VoidFunction;
    steps?: number;
};


let uid = 0;


export default component<A, string>(
    ({ disabled = false, duration = 550, onlongpress, onlongpresscancel, steps = 12, ...attributes }, label) => {
        let id = `long-press-${++uid}`,
            press = bind({ disabled, duration, onlongpress, onlongpresscancel, steps });

        // The fill layer duplicates the label, so the accessible name points at the base layer only.
        return html`
            <button
                aria-describedby='${id}-hint'
                aria-disabled='${disabled}'
                aria-labelledby='${id}-label'
                class='button long-press'
                data-state='${() => press.state.fired ? 'fired' : press.state.holding ? 'holding' : 'idle'}'
                style='${() => `--progress: ${press.state.step / press.steps}`}'
                type='button'
                ${attributes}
                ${press.attributes}
            >
                <span class='long-press-label'>
                    <span class='long-press-label-base' id='${id}-label'>${label}</span>
                    <span aria-hidden='true' class='long-press-label-fill'>${label}</span>
                </span>
                <span class='long-press-hint' id='${id}-hint'>
                    Press and hold for ${Math.round(duration / 100) / 10} seconds to confirm
                </span>
            </button>
        `;
    }
);
