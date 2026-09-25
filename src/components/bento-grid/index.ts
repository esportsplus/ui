import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import './scss/index.scss';


type Card = Attributes & {
    // Decorative art behind the text; it is hidden from assistive tech.
    background?: Renderable<unknown>;
    cta?: string;
    description: string;
    href?: string;
    icon?: Renderable<unknown>;
    name: string;
    // Columns the card spans once the grid is wide enough for three.
    span?: 1 | 2 | 3;
};


function arrow() {
    return html`
        <svg aria-hidden='true' class='bento-grid-arrow' fill='none' viewBox='0 0 15 15'>
            <path
                d='M8.15 3.15a.5.5 0 0 1 .7 0l4 4a.5.5 0 0 1 0 .7l-4 4a.5.5 0 0 1-.7-.7L11.29 8H2.5a.5.5 0 0 1 0-1h8.79L8.15 3.85a.5.5 0 0 1 0-.7Z'
                fill='currentColor'
            />
        </svg>
    `;
}

function card({ background, cta = 'Learn more', description, href = '#', icon, name, span = 3, ...attributes }: Card) {
    return html`
        <div class='bento-grid-card' style='${`--span: ${span}`}' ${attributes}>
            <div aria-hidden='true' class='bento-grid-background'>${background}</div>
            <div class='bento-grid-body'>
                <div class='bento-grid-content'>
                    ${icon && html`<span aria-hidden='true' class='bento-grid-icon'>${icon}</span>`}
                    <h3 class='bento-grid-name'>${name}</h3>
                    <p class='bento-grid-description'>${description}</p>
                </div>
            </div>
            <div class='bento-grid-cta'>
                <a class='bento-grid-link' href='${href}'>
                    ${cta}
                    ${arrow()}
                </a>
            </div>
            <div aria-hidden='true' class='bento-grid-overlay'></div>
        </div>
    `;
}


export default Object.assign(
    component<Attributes>(
        function(this, attributes, content) {
            return html`
                <div class='bento-grid' ${this?.attributes} ${attributes}>
                    ${content}
                </div>
            `;
        }
    ),
    { card }
);
