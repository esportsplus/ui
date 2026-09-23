import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import onclick from './onclick';


type A = Attributes & {
    options: (Attributes & { content: Renderable<unknown> })[],
    option?: Attributes,
    state?: { active: boolean },
    toggle?: boolean,
    'tooltip-content': Attributes & { direction?: string }
};


export default component<A>(
    ({ options, option, state = reactive({ active: false }), 'tooltip-content': tooltipContent, ...attributes }, content) => {
        let { direction = 'nw', ...tooltipContentAttributes } = tooltipContent ?? {};

        return onclick(
            { ...attributes, state },
            html`
                ${content}

                <div
                    class='tooltip-content ${`tooltip-content--${direction}`}'
                    ${tooltipContentAttributes}
                    ${{
                        inert: () => !state.active
                    }}
                >
                    ${options.map(({ content, ...o }) => {
                        if (o.href) {
                            return html`
                                <a
                                    class='link --width-full'
                                    target='_blank'
                                    ${o}
                                    ${option}
                                >
                                    ${content}
                                </a>
                            `;
                        }

                        return html`
                            <div
                                class='link --width-full'
                                ${o}
                                ${option}
                            >
                                ${content}
                            </div>
                        `;
                    })}
                </div>
            `
        );
    }
);
