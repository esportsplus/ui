import { reactive } from '@esportsplus/reactivity';
import root from '../../components/root/index.js';
import './scss/index.scss';
let queue = [], running = false, scheduled = false;
async function frame() {
    if (running) {
        return;
    }
    running = true;
    let item;
    while (item = queue.pop()) {
        await item();
    }
    running = false;
}
const onclick = (data = {}) => {
    let state = reactive({
        active: data.active || false
    });
    return {
        attributes: {
            class: () => {
                return `tooltip ${state.active ? '--active' : ''}`;
            },
            onclick: function (e) {
                let active = true, node = e.target;
                if (data.toggle && (this.contains(node) || this.isSameNode(node))) {
                    active = !state.active;
                }
                frame();
                state.active = active;
                if (active) {
                    queue.push(() => state.active = false);
                }
                if (!scheduled) {
                    root.onclick.push(() => {
                        frame();
                        scheduled = false;
                    });
                    scheduled = true;
                }
            }
        },
        state
    };
};
const onhover = (active = false) => {
    let state = reactive({ active });
    return {
        attributes: {
            class: () => `tooltip ${state.active ? '--active' : ''}`,
            onmouseover: () => {
                state.active = true;
            },
            onmouseout: () => {
                state.active = false;
            }
        },
        toggle: () => {
            state.active = !state.active;
        }
    };
};
export default { onclick, onhover };
