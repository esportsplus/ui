import { html } from '~/app';
import { pageNavTree } from '~/components/nav/page';
import { scrollSpy } from '~/components/nav/tree/spy';
import type { Page } from '~/types';
import '~/components/layout/scss/index.scss';


const layout = (page: Page) => {
    let disconnect = () => {},
        spy = scrollSpy(page.toc.map((item) => item.id));

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
            ${pageNavTree(page.toc.map((item, index) => ({
                label: item.label,
                href: `#${item.id}`,
                active: () => spy.active(index),
                onclick: (event: Event) => {
                    event.preventDefault();
                    spy.navigate(index);
                }
            })))}
        </aside>
    `;
};


export { layout };
