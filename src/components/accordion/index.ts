import { reactive } from '@esportsplus/reactivity';


let key = Symbol();


export default () => {
    let state = reactive({
            active: 0 as boolean | number
        });

    return {
        attributes: {
            class: () => {
                return state.active && '--active';
            },
            onrender: (element: HTMLElement & Record<PropertyKey, unknown>) => {
                element[key] = state;
            },
            style: (element: HTMLElement) => {
                if (state.active) {
                    let parent = element.closest('accordion') as (HTMLElement & { [k: typeof key]: typeof state }) | null;

                    if (parent && key in parent) {
                        parent[key].active = (+parent[key].active) + 1;
                    }
                }

                return state.active && `--max-height: ${element.scrollHeight}`;
            }
        },
        state
    };
}