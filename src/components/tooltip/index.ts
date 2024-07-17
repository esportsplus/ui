import { reactive } from '@esportsplus/reactivity';
import root from '~/components/root';


let queue: (VoidFunction | (() => Promise<void>))[] = [],
    running = false,
    scheduled = false;


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


const onclick = (data: { active?: boolean, toggle?: boolean } = {}) => {
    let state = reactive({ active: data.active || false });

    return {
        attributes: {
            class: () => {
                return `tooltip ${state.active ? '--active' : ''}`;
            },
            onclick: function(this: HTMLElement, e: Event) {
                let active = true,
                    node = e.target as Node | null;

                if (data.toggle && ( this.contains(node) || this.isSameNode(node) )) {
                    active = !state.active;
                }

                frame();
                state.active = active;

                if (active) {
                    queue.push(() => state.active = false);
                }

                if (!scheduled) {
                    root.onclick.add(() => {
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

const onhover = (active: boolean = false) => {
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
        state
    };
};


export default { onclick, onhover };