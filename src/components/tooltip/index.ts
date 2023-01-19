import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { root } from '~/components';
import menu from './menu';


const onclick = (data: { active?: boolean, menu?: Parameters<typeof menu>[0], toggle?: boolean } = {}) => {
    let content,
        state = reactive({
            active: data.active || false,
            render: undefined as boolean | undefined
        });

    if (data.menu) {
        content = menu(data.menu, state);
    }

    return {
        attributes: html({
            class: () => {
                return `tooltip ${state.active ? '--active' : ''}`;
            },
            onclick: function(this: HTMLElement, e: Event) {
                let active = true;

                if (data.toggle && e.target && this.isSameNode(e.target as Node)) {
                    active = !state.active;
                }

                state.active = active;

                if (active) {
                    root.queue.onclick(() => state.active = false);
                }
            }
        }),
        content,
        state
    };
};

const onhover = (active: boolean = false) => {
    let state = reactive({
            active,
            render: undefined as boolean | undefined
        });

    return {
        attributes: html({
            class: () => {
                return `tooltip ${state.active ? '--active' : ''}`;
            },
            onmouseover: () => {
                state.active = true;
            },
            onmouseout: () => {
                state.active = false;
            }
        }),
        state
    };
};


export default { onclick, onhover };