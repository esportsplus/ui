import { html } from '../../app';
import { navTree, scrollSpy } from '../nav/tree';
import type { Page } from '../../types';
import './scss/index.scss';


const layout = (page: Page) => {
    let disconnect = () => {},
        spy = scrollSpy(page.toc.map((item) => item.id), 'visible');

    return html`
        <main class='docs-main'>
            ${page.render()}
        </main>
        <aside
            class='docs-page-nav --scrollbar --scroll-fade'
            ${{
                onconnect: () => {
                    disconnect = spy.connect();
                },
                ondisconnect: () => disconnect()
            }}
        >
            ${navTree([{
                label: 'On This Page',
                groups: [{
                    links: page.toc.map((item, index) => ({
                        label: item.label,
                        href: `#${item.id}`,
                        active: () => spy.active(index),
                        onclick: (event: Event) => {
                            event.preventDefault();
                            spy.navigate(index);
                        }
                    }))
                }]
            }], 'location')}
        </aside>
    `;
};


export { layout };
