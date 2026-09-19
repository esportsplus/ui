import { pageHead } from './head';
import { html } from '../../app';
import { docCard } from '../doc-card';
import { preview } from '../preview';
import type { Card } from '../doc-card';
import type { Page, TocItem, Variant } from '../../types';
import './scss/index.scss';


type Detail = {
    description: string;
    name: string;
    variants: Variant[];
};


const cardGrid = (lede: string, title: string, cards: Card[]): Page => ({
    render: () => html`
        <div class='page docs-page'>
            ${pageHead(title, lede)}

            <div class='grid' style='--min-width: 220px;'>
                ${cards.map(docCard)}
            </div>
        </div>
    `,
    toc: []
});

const detailPage = (detail: Detail): Page => {
    let toc: TocItem[] = detail.variants.map((variant, index) => ({ id: `v-${index}`, label: variant.title }));

    return {
        render: () => html`
            <div class='page docs-page'>
                ${pageHead(detail.name, detail.description)}

                ${detail.variants.length === 0
                    ? html`<p class='docs-page-note'>No examples yet.</p>`
                    : detail.variants.map((variant, index) => preview(variant.title, variant.render(), `v-${index}`))}
            </div>
        `,
        toc
    };
};

const missing = (title: string): Page => ({
    render: () => html`
        <div class='page docs-page'>
            ${pageHead('Not found', title)}
        </div>
    `,
    toc: []
});


export { cardGrid, detailPage, missing };
export type { Card, Detail };
