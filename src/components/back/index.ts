import { component, html } from '@esportsplus/template';
import icon from '~/components/icon';
import arrow from './svg/arrow.svg';
import './scss/index.scss';


export default component(
    function (this, attributes, content) {
        return html`
            <a
                class='back link --padding-0px --flex-vertical'
                ${this?.attributes}
                ${attributes}
            >
                ${icon({ class: 'back-arrow --margin-right --margin-200' }, arrow)}
                ${content}
            </a>
        `;
    }
);