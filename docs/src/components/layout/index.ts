import { html } from '../../app';
import { navTree } from '../nav/tree';
import type { Page } from '../../types';
import './scss/index.scss';


const layout = (page: Page) => html`
    <main class='docs-main'>
        ${page.render()}
    </main>
    <aside class='docs-page-nav --scrollbar --scroll-fade'>
        ${navTree([{
            label: 'On This Page',
            groups: [{
                links: page.toc.map((item) => ({
                    label: item.label,
                    href: `#${item.id}`,
                    onclick: (event: Event) => {
                        event.preventDefault();
                        document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }))
            }]
        }])}
    </aside>
`;


export { layout };
