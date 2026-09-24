import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import { MENU_OPTION, MENU_TOOLTIP_CONTENT } from './constants';
import onclick from './onclick';


type A = Attributes & {
    [MENU_OPTION]?: Attributes,
    [MENU_TOOLTIP_CONTENT]?: Attributes & { direction?: string },
    options: (Attributes & { content: Renderable<unknown> })[],
    state?: { active: boolean },
    toggle?: boolean
};


export default Object.assign(component<A>(
    ({ options, state = reactive({ active: false }), ...attributes }, content) => {
        let { direction = 'nw', ...tooltipContent } = attributes[MENU_TOOLTIP_CONTENT] ?? {};

        return onclick(
            { ...attributes, state },
            html`
                ${content}

                <div
                    class='tooltip-content ${`tooltip-content--${direction}`}'
                    ${tooltipContent}
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
                                    ${attributes[MENU_OPTION]}
                                >
                                    ${content}
                                </a>
                            `;
                        }

                        return html`
                            <div
                                class='link --width-full'
                                ${o}
                                ${attributes[MENU_OPTION]}
                            >
                                ${content}
                            </div>
                        `;
                    })}
                </div>
            `
        );
    }
), { option: MENU_OPTION, tooltipContent: MENU_TOOLTIP_CONTENT } as const);
