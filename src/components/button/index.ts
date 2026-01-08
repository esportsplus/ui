import { reactive } from '@esportsplus/reactivity';
import { html, Renderable } from '@esportsplus/template';
import template from '../template';
import './scss/index.scss';


const hold = template.factory(
    function(attributes, content: (state: { holding: boolean, complete: boolean }) => Renderable<any>) {
        let end = () => {
                if (!state.complete) {
                    state.holding = false;
                }
            },
            state = reactive({
                complete: false,
                holding: false
            });

        return html`
            <div
                class='button ${() => state.holding && 'button--holding'} ${() => state.complete && '--active'}'
                onmousedown='${(e) => {
                    e.preventDefault();
                    state.holding = true;
                }}'
                ${attributes}
                ${{
                    onanimationend: (e: AnimationEvent) => {
                        if (e.animationName === 'buttonHolding') {
                            state.complete = true;
                        }
                    },
                    onclick: () => {},
                    onmousedown: (e) => {
                        e.preventDefault();
                        state.holding = true;
                    },
                    onmouseup: end,
                    ontouchend: end,
                    ontouchstart: (e) => {
                        e.preventDefault();
                        state.holding = true;
                    }
                }}
            >
                ${() => content(state)}
            </div>
        `;
    }
);


export default { hold };
export { hold };