import { component, html, type Attributes } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import onclick from './onclick';
import render, { type Option } from './options';


const MENU_OPTION = Symbol.for('@esportsplus/ui/tooltip.menu.option');

const MENU_TOOLTIP_CONTENT = Symbol.for('@esportsplus/ui/tooltip.menu.tooltip-content');


type A = Attributes & {
    [MENU_OPTION]?: Attributes,
    [MENU_TOOLTIP_CONTENT]?: Attributes & { direction?: string },
    onanimationcancel?: never,
    onanimationend?: never,
    onanimationstart?: never,
    onclick?: never,
    ondocumentclick?: never,
    ontransitioncancel?: never,
    ontransitionend?: never,
    ontransitionrun?: never,
    options: Option[],
    state?: { active: boolean },
    toggle?: boolean
};


export default component(
    ({ options, state = reactive({ active: false }), ...attributes }: A, content) => {
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
                    ${render(options, attributes[MENU_OPTION])}
                </div>
            `
        );
    },
    { option: MENU_OPTION, tooltipContent: MENU_TOOLTIP_CONTENT }
);


export type { A };
