import { reactive } from '@esportsplus/reactivity';
import { html, Renderable } from '@esportsplus/template';
import template from '../template';
import './scss/index.scss';


const hold = template.factory(
    function(attributes, content: (state: { holding: boolean, complete: boolean }) => Renderable<any>) {
        let state = reactive({
                complete: false,
                holding: false
            });

        return html`
            <div
                class='button button--hold ${() => state.complete && '--active'}'
                onanimationend='${(e: AnimationEvent) => {
                    if (e.animationName === 'buttonHold') {
                        state.complete = true;
                    }
                }}'
                onclick='${() => {}}'
                onmousedown='${(e: MouseEvent) => {
                    e.preventDefault();
                    state.holding = true;
                }}'
                onmouseup='${() => {
                    if (!state.complete) {
                        state.holding = false;
                    }
                }}'
                ${attributes}
            >
                ${() => content(state)}
            </div>
        `;
    }
);


export default { hold };
export { hold };