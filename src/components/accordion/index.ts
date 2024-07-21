import { reactive } from '@esportsplus/reactivity';


type Accordion = HTMLElement & { [key: symbol]: { active: boolean | number } };


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
            onrender: (element: Accordion) => {
                element[key] = state;
            },
            style: (element: Accordion) => {
                let parent = element.closest('accordion') as Accordion | null;

                if (parent && key in parent) {
                    parent[key].active = (+parent[key].active) + 1;
                }

                return state.active && `--max-height: ${element.scrollHeight}`;
            }
        },
        state: state as ReturnType<typeof reactive<{ active: boolean }>>
    };
}