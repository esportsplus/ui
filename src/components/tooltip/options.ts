import { html, type Attributes, type Renderable } from '@esportsplus/template';


type Option = Attributes & { content: Renderable<unknown> };


export default (options: Option[], attributes?: Attributes) => options.map(({ content, ...o }) => {
    if (o.href) {
        return html`
            <a
                class='link --width-full'
                target='_blank'
                ${o}
                ${attributes}
            >
                ${content}
            </a>
        `;
    }

    return html`
        <div
            class='link --width-full'
            ${o}
            ${attributes}
        >
            ${content}
        </div>
    `;
});


export type { Option };
