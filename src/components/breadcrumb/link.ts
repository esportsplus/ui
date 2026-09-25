import { component, html, type Attribute, type Attributes, type Renderable } from '@esportsplus/template';


type A = Attributes & {
    render?: (attributes: Attributes, content: Renderable<unknown>) => Renderable<unknown>;
};


export default component<A>(
    ({ render, ...attributes }, content) => {
        if (render) {
            return render({ ...attributes, class: (['breadcrumb-link'] as Attribute[]).concat(attributes.class ?? []) }, content);
        }

        return html`
            <a class='breadcrumb-link' ${attributes}>
                ${content}
            </a>
        `;
    }
);
