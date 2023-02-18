import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { root } from '~/components';
import menu from './menu';


let queue: VoidFunction[] = [],
    running = false,
    scheduled = false;


async function frame() {
    if (running) {
        return;
    }

    running = true;

    let items = queue.splice(0);

    for (let i = 0, n = items.length; i < n; i++) {
        await items[i]();
    }

    running = false;
}


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
                    scheduled = true;
                    root.queue.onclick(() => {
                        frame();
                        scheduled = false;
                    });
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