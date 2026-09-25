import { component, html, type Attributes } from '@esportsplus/template';
import './scss/index.scss';


type A = Attributes & {
    color?: string;
};


export default component<A, string>(
    function(this, { color, ...attributes }, content) {
        return html`
            <span
                class='line-shadow-text'
                data-text='${content}'
                style='${color ? `--shadow-color: ${color}` : ''}'
                ${this?.attributes}
                ${attributes}
            >
                ${content}
            </span>
        `;
    }
);
