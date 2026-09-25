import { component, html } from '@esportsplus/template';
import icon from '~/components/icon';
import more from './svg/more.svg';


export default component(
    (attributes) => html`
        <span
            aria-hidden='true'
            class='breadcrumb-ellipsis'
            role='presentation'
            ${attributes}
        >
            ${icon(more)}
        </span>
    `
);
