import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import events from '@esportsplus/delegated-events';
import menu from './menu';


let initialized = false,
    root: { active: boolean }[] = [];


const onclick = ({ active, toggle }: { active?: boolean, toggle?: boolean }) => {
    if (!initialized) {
        events.register(document.body, 'click', () => {
            if (!root.length) {
                return;
            }

            let deactivate = root.splice(0);

            for (let i = 0, n = deactivate.length; i < n; i++) {
                deactivate[i].active = false;
            }
        });
        initialized = true;
    }

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
                root.push(state);
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