import { html } from '../../app';
import type { TocItem } from '../../types';
import '../navigation/scss/index.scss';
import './scss/index.scss';


const scrollTo = (id: string) => (e: Event) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};


const toc = (items: TocItem[]) => html`
    <aside class='toc --scrollbar --scroll-fade'>
        <div class='toc-inner ${items.length === 0 ? '--hidden' : ''}'>
            <div class='toc-heading'>On This Page</div>

            ${items.map((item) => html`
                <a class='docs-nav-link' href='#${item.id}' ${{ onclick: scrollTo(item.id) }}>${item.label}</a>
            `)}
        </div>
    </aside>
`;


export { toc };
