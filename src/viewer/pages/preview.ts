import { html, type Renderable } from '@esportsplus/template';
import { href } from '~/viewer/router';
import type { Page, TocItem, Variant } from '~/viewer/types';


type Card = {
    description: string;
    name: string;
    section: string;
};

type Detail = {
    description: string;
    eyebrow: string;
    name: string;
    variants: Variant[];
};


const cardGrid = (eyebrow: string, lede: string, title: string, cards: Card[]): Page => ({
    render: () => html`
        <div class='page'>
            <div class='page-head'>
                <div class='page-eyebrow'>${eyebrow}</div>
                <h1 class='page-title'>${title}</h1>
                <p class='page-lede'>${lede}</p>
            </div>

            <div class='card-grid'>
                ${cards.map((card) => html`
                    <a class='doc-card' href='${href(card.section, card.name)}'>
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
    let toc: TocItem[] = detail.variants.map((variant, index) => ({ id: `v-${index}`, label: variant.title }));

    return {
        render: () => html`
            <div class='page'>
                <div class='page-head'>
                    <div class='page-eyebrow'>${detail.eyebrow}</div>
                    <h1 class='page-title'>${detail.name}</h1>
                    <p class='page-lede'>${detail.description}</p>
                </div>

                ${detail.variants.length === 0
                    ? html`<p class='page-note'>No examples yet.</p>`
                    : detail.variants.map((variant, index) => html`
                        <div class='preview' id='v-${index}'>
                            <div class='preview-bar'>
                                <span class='preview-title'>${variant.title}</span>
                            </div>

                            <div class='preview-stage'>
                                ${variant.render()}
                            </div>
                        </div>
                    `)}
            </div>
        `,
        toc
    };
};

const missing = (title: string): Page => ({
    render: () => html`
        <div class='page'>
            <div class='page-head'>
                <h1 class='page-title'>Not found</h1>
                <p class='page-lede'>${title}</p>
            </div>
        </div>
    `,
    toc: []
});


const preview = (title: string, node: Renderable<unknown>) => html`
    <div class='preview'>
        <div class='preview-bar'>
            <span class='preview-title'>${title}</span>
        </div>

        <div class='preview-stage'>${node}</div>
    </div>
`;


export { cardGrid, detailPage, missing, preview };
export type { Card, Detail };
