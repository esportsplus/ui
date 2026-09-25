import { readingProgress } from '@esportsplus/ui';
import { html } from '@esportsplus/template';


let paragraph = 'Progress runs from the top edge of the article to its last visible line, so headers and footers outside it never count as reading. The scroll is quantized into steps, which caps how many renders a full scroll can cost, and the fill springs between them.';


function pane(options: { steps?: number; words?: number }) {
    let article: HTMLElement | undefined,
        container: HTMLElement | undefined;

    return html`
        <div
            style='border: 1px solid var(--color-border-400); border-radius: var(--border-radius-400); height: 320px; overflow-y: auto; width: 100%;'
            ${{ onconnect: (element: HTMLElement) => { container = element; } }}
        >
            <div style='background: var(--color-white-400); border-bottom: 1px solid var(--color-border-400); padding: var(--size-300) var(--size-400); position: sticky; top: 0; z-index: 1;'>
                ${readingProgress({ ...options, scroller: () => container, target: () => article })}
            </div>
            <article
                class='text'
                style='display: flex; flex-direction: column; gap: var(--size-400); padding: var(--size-500) var(--size-400);'
                ${{ onconnect: (element: HTMLElement) => { article = element; } }}
            >
                ${Array.from({ length: 8 }, () => html`<p>${paragraph}</p>`)}
            </article>
        </div>
    `;
}


export default {
    name: 'reading-progress',
    variants: [
        {
            render: () => pane({ words: 1840 }),
            title: 'minutes remaining'
        },
        {
            render: () => pane({}),
            title: 'bar only'
        },
        {
            render: () => pane({ steps: 8, words: 1840 }),
            title: 'coarse steps'
        }
    ]
};
