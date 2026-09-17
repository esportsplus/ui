import { href, html } from '~/viewer/app';
import type { Renderable } from '~/viewer/app';
import type { Page, TocItem, Variant } from '~/viewer/types';
import './scss/index.scss';


type Card = {
    description: string;
    name: string;
    section: string;
};

type Detail = {
    description: string;
    name: string;
    variants: Variant[];
};


const cardGrid = (lede: string, title: string, cards: Card[]): Page => ({
    render: () => html`
        <div class='page'>
            <div class='page-head'>
                <h1 class='page-title'>${title}</h1>
                <p class='page-lede'>${lede}</p>
            </div>

            <div class='grid' style='--min-width: 220px;'>
                ${cards.map((card) => html`
                    <a class='doc-card card --border --border-default --border-border --border-radius-500 --padding-400' href='${href(card.section, card.name)}'>
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
                    <h1 class='page-title'>${detail.name}</h1>
                    <p class='page-lede'>${detail.description}</p>
                </div>

                ${detail.variants.length === 0
                    ? html`<p class='page-note'>No examples yet.</p>`
                    : detail.variants.map((variant, index) => html`
                        <div class='preview card --border --border-default --border-border --border-radius-600 --margin-bottom --margin-vertical-500' id='v-${index}'>
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
    <div class='preview card --border --border-default --border-border --border-radius-600 --margin-bottom --margin-vertical-500'>
        <div class='preview-bar'>
            <span class='preview-title'>${title}</span>
        </div>

        <div class='preview-stage'>${node}</div>
    </div>
`;


const scrollTo = (id: string) => (e: Event) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};


const layout = (page: Page): Renderable<unknown> => html`
    <main class='main'>
        ${page.render()}
    </main>

    <aside class='toc --scrollbar'>
        <div class='toc-inner ${page.toc.length === 0 ? '--hidden' : ''}'>
            <div class='toc-heading'>On This Page</div>

            ${page.toc.map((item) => html`
                <a class='toc-link' href='#' ${{ onclick: scrollTo(item.id) }}>${item.label}</a>
            `)}
        </div>
    </aside>
`;


export { cardGrid, detailPage, layout, missing, preview };
export type { Card, Detail };
