import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { root } from '~/components';
import menu from './menu';


const onclick = ({ active, toggle }: { active?: boolean, toggle?: boolean }) => {
    let state = reactive({
            active: active || false
        });

    return html({
        class: () => {
            return `tooltip ${state.active ? '--active' : ''}`;
        },
        onclick: function(this: HTMLElement, e: Event) {
            let active = true;

            if (toggle && e.target && this.isSameNode(e.target as Node)) {
                active = !state.active;
            }

            state.active = active;

            if (active) {
                root.queue.onclick(() => state.active = false);
            }
        }
    });
};

const onfocus = (active: boolean = false) => {
    let state = reactive({ active });

    return html({
        class: () => {
            return `tooltip ${state.active ? '--active' : ''}`;
        },
        onfocusin: () => {
            state.active = true;
        },
        onfocusout: () => {
            state.active = false;
        }
    });
};

const onhover = (active: boolean = false) => {
    let state = reactive({ active });

    return html({
        class: () => {
            return `tooltip ${state.active ? '--active' : ''}`;
        },
        onmouseover: () => {
            state.active = true;
        },
        onmouseout: () => {
            state.active = false;
        }
    });
};


export default { onclick, onfocus, onhover, menu };