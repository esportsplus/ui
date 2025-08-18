import { reactive } from '@esportsplus/reactivity';
import { html, type Attributes } from '@esportsplus/template';
import { omit } from '@esportsplus/utilities';
import { root } from '@esportsplus/ui';
import template from '~/components/template';


const OMIT = ['state', 'toggle'];


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


export default template.factory<Attributes & { state?: { active: boolean }, toggle?: boolean }>(
    (attributes, content) => {
        let state = attributes.state || reactive({ active: false }),
            toggle = attributes.toggle || false;

        return html`
            <div
                class='tooltip'
                ${omit(attributes, OMIT)}
                ${{
                    class: () => state.active && '--active',
                    onclick: function(e) {
                        let active = true,
                            node = e.target as Node | null;

                        if (this === node || (toggle && this.contains(node))) {
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
                    }
                }}
            >
                ${content}
            </div>
        `;
    }
);
