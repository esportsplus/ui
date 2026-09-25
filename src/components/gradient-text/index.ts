import { component, html, type Attributes } from '@esportsplus/template';
import './scss/index.scss';


type A = Attributes & {
    from?: string;
    // Multiplies how far the gradient travels per loop; 2 sweeps twice the distance in the same time.
    speed?: number;
    to?: string;
};


export default component<A>(
    function(this, { from, speed = 1, to, ...attributes }, content) {
        return html`
            <span
                class='gradient-text'
                style='${`--background-size: ${speed * 300}%;${from ? ` --color-from: ${from};` : ''}${to ? ` --color-to: ${to};` : ''}`}'
                ${this?.attributes}
                ${attributes}
            >
                ${content}
            </span>
        `;
    }
);
