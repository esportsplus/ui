import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { isArray, omit } from '@esportsplus/utilities';
import root from '~/components/root';
import './scss/index.scss';


let queue: VoidFunction[] = [],
    running = false,
    scheduled = false;


function frame() {
    if (running) {
        return;
    }

    running = true;

    let item;

    while (item = queue.pop()) {
        item();
    }

    running = false;
}


const onclick = (data: Record<string, unknown> & { active?: boolean, toggle?: boolean }, content: unknown) => {
    let state = reactive({
            active: data.active || false
        });

    if (!isArray(data.class)) {
        data.class = data.class ? [data.class] : [];
    }

    (data.class as unknown[]).push(() => {
        return state.active && '--active';
    });

    return html`
        <div
            class='tooltip'
            onclick='${function(this: HTMLElement, e: Event) {
                let active = true,
                    node = e.target as Node | null;

                if (data.toggle && ( this.contains(node) || this.isSameNode(node) )) {
                    active = !state.active;
                }

                if (this.parentElement?.closest('.tooltip')) {}
                else {
                    frame();
                }

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
            }}}'
            ${omit(data, ['active', 'toggle'])}
        >
            ${content}
        </div>
    `;
};

const onhover = (data: Record<string, unknown> & { active?: boolean }, content: unknown) => {
    let state = reactive({ active: data.active || false });

    if (!isArray(data.class)) {
        data.class = data.class ? [data.class] : [];
    }

    (data.class as unknown[]).push(() => {
        return state.active && '--active';
    });

    return html`
        <div
            class='tooltip'
            onmouseover='${() => {
                state.active = true;
            }}}'
            onmouseout='${() => {
                state.active = false;
            }}'
            ${omit(data, ['active', 'toggle'])}
        >
            ${content}
        </div>
    `;
};


export default { onclick, onhover };