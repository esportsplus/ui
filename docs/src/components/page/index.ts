import { pageHead } from '~/docs-components/page/head';
import { html } from '~/app';
import { breadcrumb } from '@esportsplus/ui';
import { docCard } from '~/docs-components/doc-card';
import { preview } from '~/docs-components/preview';
import type { Card } from '~/docs-components/doc-card';
import type { Page, TocItem, Variant } from '~/types';
import '~/docs-components/page/scss/index.scss';


type Detail = {
    breadcrumb?: { href: string; label: string }[];
    description: string;
    name: string;
    variants: Variant[];
};


const cardGrid = (lede: string, title: string, cards: Card[]): Page => ({
    render: () => html`
        <div class='page'>
            ${pageHead(title, lede)}

            <div class='grid page-grid'>
                ${cards.map(docCard)}
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
                ${detail.breadcrumb && breadcrumb({ class: 'page-breadcrumb', items: detail.breadcrumb })}
                ${pageHead(detail.name, detail.description)}

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
            ${pageHead('Not found', title)}
        </div>
    `,
    toc: []
});


export { cardGrid, detailPage, missing };
export type { Card, Detail };
