import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import chevron from '@esportsplus/ui/svg/chevron.svg';
import group from '~/components/group';
import icon from '~/components/icon';
import tooltip from '~/components/tooltip';
import type { A as MenuAttributes } from '~/components/tooltip/menu';


const SPLIT_ACTION = Symbol.for('@esportsplus/ui/button.split.action');

const SPLIT_ITEM = Symbol.for('@esportsplus/ui/button.split.item');

const SPLIT_PANEL = Symbol.for('@esportsplus/ui/button.split.panel');

const SPLIT_TRIGGER = Symbol.for('@esportsplus/ui/button.split.trigger');


type A = Attributes & Pick<MenuAttributes, 'animate' | 'controller' | 'expand' | 'highlight' | 'items' | 'onselect' | 'openOn' | 'state'> & {
    [SPLIT_ACTION]?: Attributes;
    [SPLIT_ITEM]?: Attributes;
    [SPLIT_PANEL]?: Attributes;
    [SPLIT_TRIGGER]?: Attributes & { onclick?: never };
    trigger?: Renderable<unknown>;
};


export default component(
    ({ animate, controller, expand, highlight, items, onselect, openOn, state, trigger, ...attributes }: A, content) => {
        return group(
            { role: 'group', ...attributes, class: ['group--row', attributes.class ?? []].flat() },
            html`
                <button class='button button--action' type='button' ${attributes[SPLIT_ACTION]}>
                    ${content}
                </button>

                ${tooltip.menu(
                    {
                        // Hangs from the trigger's end edge, so it stays under the whole group.
                        align: 'end',
                        animate,
                        controller,
                        expand,
                        highlight,
                        items,
                        onselect,
                        openOn,
                        state,
                        [tooltip.menu.item]: attributes[SPLIT_ITEM],
                        [tooltip.menu.panel]: attributes[SPLIT_PANEL],
                        [tooltip.menu.trigger]: {
                            'aria-label': 'More options',
                            ...attributes[SPLIT_TRIGGER],
                            class: ['button button--trigger', attributes[SPLIT_TRIGGER]?.class ?? []].flat()
                        }
                    },
                    trigger ?? icon({ 'aria-hidden': 'true', class: 'button-icon icon--down icon--rotate' }, chevron)
                )}
            `
        );
    },
    { action: SPLIT_ACTION, item: SPLIT_ITEM, panel: SPLIT_PANEL, trigger: SPLIT_TRIGGER }
);
