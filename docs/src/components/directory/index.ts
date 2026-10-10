import { html, uri } from 'docs/app';
import { preview } from 'docs/components/preview';
import type { Page, TocItem, Variant } from 'docs/types';
import header from 'docs/components/page/header';
import 'docs/components/directory/scss/index.scss';
import 'docs/components/page/scss/index.scss';


type Directory = {
    // The index page's subtitle.
    description: string;
    items: Item[];
    route: 'components' | 'modifiers';
    // Empty for the index; otherwise names an item, which the missing middleware has already confirmed exists.
    slug?: string;
    title: string;
};

type Item = {
    description: string;
    label: string;
    name: string;
    variants: () => Variant[];
};


function detail({ items, route, slug, title }: Directory): Page {
    let item = items.find((item) => item.name === slug)!,
        variants = item.variants(),
        toc: TocItem[] = variants.map((variant, index) => ({ id: variant.id ?? `v-${index}`, label: variant.title }));

    return {
        render: () => html`
            <div class='page'>
                ${header({
                    breadcrumb: [
                        { href: uri(route), label: title },
                        { href: uri(`${route}.detail`, { slug: item.name }), label: item.label }
                    ],
                    description: item.description,
                    title: item.label
                })}

                ${variants.length === 0
                    ? html`<p class='page-note'>No examples yet.</p>`
                    : variants.map((variant, index) => preview({
                        id: toc[index].id,
                        index: index + 1,
                        node: variant.render,
                        options: variant.options,
                        source: variant.source,
                        title: variant.title
                    }))}
            </div>
        `,
        toc
    };
}

function grid({ description, items, route, title }: Directory): Page {
    return {
        render: () => html`
            <div class='page'>
                ${header({ description, title })}

                <div class='grid page-grid'>
                    ${items.map((item) => html`
                        <a class='card directory-card' href='${uri(`${route}.detail`, { slug: item.name })}'>
                            <div class='directory-card-name'>${item.label}</div>
                            <p class='directory-card-description'>${item.description}</p>
                        </a>
                    `)}
                </div>
            </div>
        `,
        toc: []
    };
}


export default (options: Directory): Page => options.slug ? detail(options) : grid(options);
export type { Directory, Item };
