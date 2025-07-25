import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { isArray, omit } from '@esportsplus/utilities';
import { root } from '@esportsplus/ui';
import './scss/index.scss';


let parent: HTMLElement | null | undefined = null,
    queue: { fn: VoidFunction, tooltip: HTMLElement }[] = [],
    running = false,
    scheduled = false;


function frame() {
    if (running) {
        return;
    }

    running = true;

    let item,
        keep;

    while (item = queue.pop()) {
        if (parent === item.tooltip) {
            keep = item;
            continue;
        }

        item.fn();
    }

    if (keep) {
        queue.push(keep);
    }

    running = false;
}


const onclick = (
    data: Record<string, unknown> & { toggle?: boolean }, content: unknown,
    state: { active: boolean } = reactive({ active: false })
) => {
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

                if (this === node || (data.toggle && this.contains(node))) {
                    active = !state.active;
                }

                if (parent !== this && !parent?.contains(this)) {
                    parent = this.parentElement?.closest('.tooltip');
                }

                frame();

                if (parent === this) {
                    parent = null;
                    return;
                }

                state.active = active;

                if (active) {
                    queue.push({
                        fn: () => state.active = false,
                        tooltip: this
                    });
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

const onhover = (
    data: Record<string, unknown>,
    content: unknown,
    state: { active: boolean } = reactive({ active: false })
) => {
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