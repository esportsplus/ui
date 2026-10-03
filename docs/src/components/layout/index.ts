import { html } from '~/app';
import { navTree, scrollSpy } from '~/docs-components/nav/tree';
import type { Page } from '~/types';
import '~/docs-components/layout/scss/index.scss';


const layout = (page: Page) => {
    let disconnect = () => {},
        spy = scrollSpy(page.toc.map((item) => item.id), 'visible');

    return html`
        <main class='main'>
            ${page.render()}
        </main>
        <aside
            class='page-nav --scrollbar --scroll-fade'
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
