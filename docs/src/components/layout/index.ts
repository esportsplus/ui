import { nav, pagination } from '@esportsplus/ui/components';
import scrollbar from '@esportsplus/ui/modifiers/scrollbar';
import { html } from 'docs/app';
import { adjacent } from 'docs/data/nav';
import type { Page } from 'docs/types';
import 'docs/components/layout/scss/index.scss';


export default (page: Page) => {
    let disconnect = () => {},
        spy = nav.spy(page.toc.map((item) => item.id));

    return html`
        <main class='main'>
            ${page.render()}
            ${pagination.cards({
                ...adjacent(),
                [pagination.cards.card]: {
                    class: 'card--surface card--surface-border',
                },
                'aria-label': 'Page navigation',
                class: 'main-pagination',
                ring: true
            })}
        </main>
        <aside
            class='page-nav'
            ${scrollbar({ fade: true })}
            ${{
                onconnect: () => {
                    disconnect = spy.connect();
                },
                ondisconnect: () => disconnect()
            }}
        >
            ${nav.toc({
                links: page.toc.map((item, index) => ({
                    label: item.label,
                    href: `#${item.id}`,
                    active: () => spy.active(index),
                    onclick: (event: Event) => {
                        event.preventDefault();
                        spy.navigate(index);
                    }
                }))
            })}
        </aside>
    `;
};
