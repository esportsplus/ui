import { pageHead } from 'docs/components/page/head';
import { html } from 'docs/app';
import { preview } from 'docs/components/preview';
import type { Head } from 'docs/components/page/head';
import type { Page, TocItem, Variant } from 'docs/types';
import 'docs/components/page/scss/index.scss';
import 'docs/components/page/scss/card.scss';


type Card = {
    description: string;
    href: string;
    name: string;
};


type Detail = {
    breadcrumb?: Head['breadcrumb'];
    description: string;
    name: string;
    variants: Variant[];
};


const cardGrid = (subtitle: string, title: string, cards: Card[]): Page => ({
    render: () => html`
        <div class='page'>
            ${pageHead({ title, description: subtitle })}

            <div class='grid page-grid'>
                ${cards.map((card) => html`
                    <a
                        class='doc-card card --border-default --border-border'
                        href='${card.href}'
                    >
                        <div class='doc-card-name'>${card.name}</div>
                        <p class='doc-card-description'>${card.description}</p>
                    </a>
                `)}
            </div>
        </div>
    `,
    toc: []
});

const detailPage = (detail: Detail): Page => {
    let toc: TocItem[] = detail.variants.map((variant, index) => ({ id: variant.id ?? `v-${index}`, label: variant.title }));

    return {
        render: () => html`
            <div class='page'>
                ${pageHead({ title: detail.name, description: detail.description, breadcrumb: detail.breadcrumb })}

                ${detail.variants.length === 0
                    ? html`<p class='page-note'>No examples yet.</p>`
                    : detail.variants.map((variant, index) => preview(variant.title, variant.render, variant.id ?? `v-${index}`, variant.options, variant.source))}
            </div>
        `,
        toc
    };
};

const missing = (title: string): Page => ({
    render: () => html`
        <div class='page'>
            ${pageHead({ title: 'Not found', description: title })}
        </div>
    `,
    toc: []
});


export { cardGrid, detailPage, missing };
export type { Card, Detail };
