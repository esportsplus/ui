import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import tooltip from '~/components/tooltip';
import type { A as MenuAttributes } from '~/components/tooltip/menu';
import chevronSvg from '@esportsplus/ui/svg/chevron-down.svg';


const SPLIT_ACTION = Symbol.for('@esportsplus/ui/button.split.action');

const SPLIT_ITEM = Symbol.for('@esportsplus/ui/button.split.item');

const SPLIT_PANEL = Symbol.for('@esportsplus/ui/button.split.panel');

const SPLIT_TRIGGER = Symbol.for('@esportsplus/ui/button.split.trigger');


type A = Attributes & Pick<MenuAttributes, 'animate' | 'controller' | 'expand' | 'items' | 'onselect' | 'openOn' | 'state'> & {
    [SPLIT_ACTION]?: Attributes,
    [SPLIT_ITEM]?: Attributes,
    [SPLIT_PANEL]?: Attributes,
    [SPLIT_TRIGGER]?: Attributes & { onclick?: never },
    trigger?: Renderable<unknown>
};


const chevron = () => html`<svg aria-hidden='true' class='button-icon button-split-chevron'><use href='#${chevronSvg}' /></svg>`;


export default component(
    ({ animate, controller, expand, items, onselect, openOn, state, trigger, ...attributes }: A, content) => {
        return html`
            <div class='button-split' role='group' ${attributes}>
                <button class='button button-split-action' type='button' ${attributes[SPLIT_ACTION]}>
                    ${content}
                </button>

                ${tooltip.menu(
                    {
                        animate,
                        class: 'button-split-menu',
                        controller,
                        expand,
                        items,
                        onselect,
                        openOn,
                        state,
                        [tooltip.menu.item]: attributes[SPLIT_ITEM],
                        [tooltip.menu.panel]: attributes[SPLIT_PANEL],
                        [tooltip.menu.trigger]: {
                            'aria-label': 'More options',
                            ...attributes[SPLIT_TRIGGER],
                            class: ['button button-split-trigger', attributes[SPLIT_TRIGGER]?.class ?? []].flat()
                        }
                    },
                    trigger ?? chevron()
                )}
            </div>
        `;
    },
    { action: SPLIT_ACTION, item: SPLIT_ITEM, panel: SPLIT_PANEL, trigger: SPLIT_TRIGGER }
);
