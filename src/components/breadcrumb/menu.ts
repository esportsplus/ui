import { component, html, type Attribute } from '@esportsplus/template';
import icon from '~/components/icon';
import tooltip from '~/components/tooltip';
import caret from './svg/caret.svg';
import type { A } from '~/components/tooltip/menu';


export default component<A>(
    (attributes, content) => tooltip.menu(
        {
            ...attributes,
            class: (['breadcrumb-link', 'breadcrumb-menu'] as Attribute[]).concat(attributes.class ?? []),
            [tooltip.menu.tooltipContent]: { direction: 'sw', ...attributes[tooltip.menu.tooltipContent] }
        },
        html`
            ${content}
            ${icon({ class: 'breadcrumb-menu-caret' }, caret)}
        `
    )
);
