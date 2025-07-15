import { reactive } from '@esportsplus/reactivity';
import './scss/index.scss';
let key = Symbol();
export default () => {
    let state = reactive({
        active: 0
    });
    return {
        attributes: {
            class: () => {
                return state.active && '--active';
            },
            onrender: (element) => {
                element[key] = state;
            },
            style: (element) => {
                let parent = element.closest('accordion');
                if (parent && key in parent) {
                    parent[key].active = (+parent[key].active) + 1;
                }
                return state.active && `--max-height: ${element.scrollHeight}`;
            }
        },
        state: state
    };
};
