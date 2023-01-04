import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';


const onfocus = (active: boolean = false) => {
    let state = reactive({ active });

    return html({
        class: () => {
            return state.active ? '--active' : '';
        },
        onfocusin: () => {
            state.active = true;
        },
        onfocusout: () => {
            state.active = false;
        }
    });
};


export default { onfocus };