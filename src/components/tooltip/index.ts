import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import menu from './menu';


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


export default { onfocus, onhover, menu };