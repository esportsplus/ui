import { component, html } from '@esportsplus/template';
import icon from '~/components/icon';
import chevron from './svg/chevron.svg';


export default component(
    (attributes, content) => html`
        <li
            aria-hidden='true'
            class='breadcrumb-separator'
            role='presentation'
            ${attributes}
        >
            ${content ?? icon(chevron)}
        </li>
    `
);
