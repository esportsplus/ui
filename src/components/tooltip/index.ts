import { reactive } from '@esportsplus/reactivity';
import { html, type Attributes } from '@esportsplus/template';
import { omit, toArray } from '@esportsplus/utilities';
import { root } from '@esportsplus/ui';
import template from '~/components/template';
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


const menu = template.factory<
    Attributes & {
        options: (Attributes & { content: unknown })[],
        option?: Attributes,
        state?: { active: boolean },
        toggle?: boolean,
        'tooltip-content': Attributes & { direction?: string }
    }
>(
    (attributes, content) => onclick(
        omit(attributes, ['options', 'option', 'tooltip-content']),
        html`
            ${content}

            <div
                class='tooltip-content ${`tooltip-content--${attributes['tooltip-content']?.direction || 'nw'}`}'
                ${omit(attributes['tooltip-content'], ['direction'])}
            >
                ${attributes.options.map((option) => html`
                    <div
                        class='link --width-full'
                        ${omit(option, ['content'])}
                        ${attributes.option}
                    >
                        ${option.content}
                    </div>
                `)}
            </div>
        `
    )
);

const onclick = template.factory<Attributes & { state?: { active: boolean }, toggle?: boolean }>(
    (attributes, content) => {
        let state = attributes.state || reactive({ active: false });

        attributes.class = toArray(attributes.class);
        attributes.class.push(() => {
            return state.active && '--active';
        });

        attributes.onclick = function(this: HTMLElement, e) {
            let active = true,
                node = e.target as Node | null;

            if (this === node || (attributes.toggle && this.contains(node))) {
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
        };

        return html`
            <div
                class='tooltip'
                ${omit(attributes, ['state', 'toggle'])}
            >
                ${content}
            </div>
        `;
    }
);

const onhover = template.factory<Attributes & { state?: { active: boolean } }>(
    (attributes, content) => {
        let state = attributes.state || reactive({ active: false });

        attributes.class = toArray(attributes.class);
        attributes.class.push(() => {
            return state.active && '--active';
        });

        attributes.onmouseover = () => {
            state.active = true;
        };
        attributes.onmouseout = () => {
            state.active = false;
        };

        return html`
            <div
                class='tooltip'
                ${omit(attributes, ['active', 'state', 'toggle'])}
            >
                ${content}
            </div>
        `;
    }
);


export default { menu, onclick, onhover };