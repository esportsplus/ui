import { reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes, type Renderable } from '@esportsplus/template';


const GROUP_ITEM = Symbol.for('@esportsplus/ui/tooltip.group.item');

const GROUP_TOOLTIP_CONTENT = Symbol.for('@esportsplus/ui/tooltip.group.tooltip-content');


type A = Attributes & {
    [GROUP_ITEM]?: Attributes,
    [GROUP_TOOLTIP_CONTENT]?: Attributes & { direction?: 'e' | 'n' | 's' | 'w' },
    items: (Attributes & { content: Renderable<unknown>, tooltip: Renderable<unknown> })[],
    onfocusin?: never,
    onfocusout?: never,
    onkeydown?: never,
    onpointerleave?: never,
    onpointerover?: never,
    state?: { active: boolean, gliding: boolean, index: number }
};


function item(container: HTMLElement, target: EventTarget | null) {
    let element = (target as Element | null)?.closest?.<HTMLElement>('.tooltip-group-item');

    if (!element || element.closest('.tooltip-group') !== container) {
        return;
    }

    return element;
}

// The layers are 'max-content', so a layer's box is the size the bubble should take.
function measure(container: HTMLElement, element: HTMLElement, index: number) {
    let content = container.querySelector<HTMLElement>('.tooltip-group-content'),
        layer = content?.querySelectorAll<HTMLElement>('.tooltip-group-layer')[index];

    if (!content || !layer) {
        return;
    }

    let style = content.style;

    style.setProperty('--group-height', `${layer.offsetHeight}px`);
    style.setProperty('--group-width', `${layer.offsetWidth}px`);
    style.setProperty('--group-x', `${element.offsetLeft + element.offsetWidth / 2}px`);
    style.setProperty('--group-y', `${element.offsetTop + element.offsetHeight / 2}px`);

    return true;
}


export default Object.assign(component<A>(
    ({ items, state = reactive({ active: false, gliding: false, index: -1 }), ...attributes }) => {
        let { direction = 'n', ...tooltipContent } = attributes[GROUP_TOOLTIP_CONTENT] ?? {},
            frame = 0;

        let close = () => {
            cancelAnimationFrame(frame);
            state.active = false;
            state.gliding = false;
        };

        let open = (container: HTMLElement, element: HTMLElement) => {
            let index = Number(element.dataset.index);

            if (state.active && state.index === index) {
                return;
            }

            if (!measure(container, element, index)) {
                return;
            }

            state.index = index;

            if (state.active) {
                return;
            }

            state.active = true;

            // The template applies classes in its own frame; one frame is not enough to paint the pop without glide.
            frame = requestAnimationFrame(() => {
                frame = requestAnimationFrame(() => {
                    state.gliding = true;
                });
            });
        };

        return html`
            <div
                class='tooltip-group'
                ${attributes}
                ${{
                    class: () => `${state.active ? '--active' : ''} ${state.gliding ? '--gliding' : ''}`,
                    ondisconnect: () => {
                        cancelAnimationFrame(frame);
                    },
                    onfocusin: (e: FocusEvent) => {
                        let container = e.currentTarget as HTMLElement,
                            element = item(container, e.target);

                        if (element && (e.target as Element).matches(':focus-visible')) {
                            open(container, element);
                        }
                    },
                    onfocusout: (e: FocusEvent) => {
                        if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) {
                            close();
                        }
                    },
                    onkeydown: (e: KeyboardEvent) => {
                        if (e.key === 'Escape') {
                            close();
                        }
                    },
                    onpointerleave: close,
                    onpointerover: (e: PointerEvent) => {
                        let container = e.currentTarget as HTMLElement,
                            element = item(container, e.target);

                        if (element) {
                            open(container, element);
                        }
                    }
                }}
            >
                ${items.map(({ content, tooltip, ...o }, i) => html`
                    <div
                        class='tooltip-group-item'
                        data-index='${i}'
                        ${o}
                        ${attributes[GROUP_ITEM]}
                    >
                        ${content}
                    </div>
                `)}

                <div
                    class='tooltip-group-content ${`tooltip-group-content--${direction}`}'
                    role='tooltip'
                    ${tooltipContent}
                >
                    <div class='tooltip-group-box'>
                        ${items.map(({ tooltip }, i) => html`
                            <div
                                class='tooltip-group-layer'
                                ${{
                                    class: () => state.index === i ? '--active' : state.index > i ? '--before' : '--after'
                                }}
                            >
                                ${tooltip}
                            </div>
                        `)}
                    </div>
                </div>
            </div>
        `;
    }
), { item: GROUP_ITEM, tooltipContent: GROUP_TOOLTIP_CONTENT } as const);
