import { html, Attributes } from '@esportsplus/frontend';
import icon from '~/components/icon';
import template from '~/components/template';
import arrow from './svg/arrow.svg';
import './scss/index.scss';


export default template.factory(
    function (this: { attributes?: Attributes }, attributes, content) {
        return html`
            <a
                class='back link --padding-0px --flex-vertical'
                ${this.attributes}
                ${attributes}
            >
                ${icon({ class: 'back-arrow --margin-right --margin-200' }, arrow)}
                ${content}
            </a>
        `;
    }
);