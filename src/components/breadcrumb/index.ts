import { component, html } from '@esportsplus/template';
import ellipsis from './ellipsis';
import item from './item';
import link from './link';
import list from './list';
import menu from './menu';
import page from './page';
import separator from './separator';
import './scss/index.scss';


let root = component(
    (attributes, content) => html`
        <nav aria-label='breadcrumb' class='breadcrumb' ${attributes}>
            ${content}
        </nav>
    `
);


const breadcrumb: typeof root & {
    ellipsis: typeof ellipsis,
    item: typeof item,
    link: typeof link,
    list: typeof list,
    menu: typeof menu,
    page: typeof page,
    separator: typeof separator
} = Object.assign(root, { ellipsis, item, link, list, menu, page, separator });


export default breadcrumb;
