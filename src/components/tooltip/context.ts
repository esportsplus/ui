import { component, html, type Attributes } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import render, { type Option } from './options';


const CONTEXT_OPTION = Symbol.for('@esportsplus/ui/tooltip.context.option');

const CONTEXT_TOOLTIP_CONTENT = Symbol.for('@esportsplus/ui/tooltip.context.tooltip-content');


type A = Attributes & {
    [CONTEXT_OPTION]?: Attributes,
    [CONTEXT_TOOLTIP_CONTENT]?: Attributes,
    oncontextmenu?: never,
    ondocumentclick?: never,
    ondocumentcontextmenu?: never,
    ondocumentkeydown?: never,
    options: Option[],
    state?: { active: boolean }
};


export default Object.assign(component<A>(
    ({ options, state = reactive({ active: false }), ...attributes }, content) => {
        let menu: HTMLElement | undefined;

        return html`
            <div
                class='tooltip tooltip--context'
                ${attributes}
                ${{
                    class: () => state.active && '--active',
                    oncontextmenu: function(this: HTMLElement, event: MouseEvent) {
                        if (!menu) {
                            return;
                        }

                        event.preventDefault();

                        let bounds = this.getBoundingClientRect(),
                            x = event.clientX,
                            xflip = x + menu.offsetWidth > window.innerWidth,
                            y = event.clientY,
                            yflip = y + menu.offsetHeight > window.innerHeight;

                        // Flip toward the cursor when the menu would overflow the viewport
                        if (xflip) {
                            x -= menu.offsetWidth;
                        }

                        if (yflip) {
                            y -= menu.offsetHeight;
                        }

                        menu.style.left = `${x - bounds.left - this.clientLeft + this.scrollLeft}px`;
                        menu.style.top = `${y - bounds.top - this.clientTop + this.scrollTop}px`;
                        menu.style.transformOrigin = `${xflip ? 'right' : 'left'} ${yflip ? 'bottom' : 'top'}`;

                        state.active = true;
                    },
                    ondocumentclick: () => {
                        state.active = false;
                    },
                    ondocumentcontextmenu: function(this: HTMLElement, event: MouseEvent) {
                        if (!state.active || this.contains(event.target as Node | null)) {
                            return;
                        }

                        state.active = false;
                    },
                    ondocumentkeydown: (event: KeyboardEvent) => {
                        if (event.key === 'Escape') {
                            state.active = false;
                        }
                    }
                }}
            >
                ${content}

                <div
                    class='tooltip-content tooltip-content--context'
                    ${attributes[CONTEXT_TOOLTIP_CONTENT]}
                    ${{
                        inert: () => !state.active,
                        onrender: (element: HTMLElement) => {
                            menu = element;
                        }
                    }}
                >
                    ${render(options, attributes[CONTEXT_OPTION])}
                </div>
            </div>
        `;
    }
), { option: CONTEXT_OPTION, tooltipContent: CONTEXT_TOOLTIP_CONTENT } as const);
