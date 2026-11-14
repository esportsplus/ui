import { component, html, type Attributes, type Renderable } from '@esportsplus/template';


type A = Attributes & {
    index?: number;
    title?: Renderable<unknown>;
};


// The card's header strip ('card-header'): its numbered title, then whatever controls the content brings, such as a variant select.
export default component(
    function({ index, title, ...attributes }: A, content) {
        return html`
            <div class='card-header preview-header' ${attributes}>
                <span class='preview-title'>
                    ${index !== undefined && html`<span class='preview-index'>${String(index).padStart(2, '0')}</span>`}
                    ${title}
                </span>
                ${content}
            </div>
        `;
    }
);
