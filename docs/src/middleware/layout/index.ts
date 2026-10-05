import { nav } from '@esportsplus/ui/components';
import { html } from 'docs/app';
import type { Request, Responder, RouteName } from 'docs/app';
import type { Page } from 'docs/types';
import 'docs/middleware/layout/scss/index.scss';


const routes: readonly (RouteName | null)[] = [
    'home',
    'docs',
    'components',
    'components.detail',
    'css-utilities',
    'css-utilities.detail',
    'fonts',
    'themes',
    'tokens',
    null // The unmatched-route fallback also returns the installation page.
];


export default (request: Request, next: Responder) => {
    let response = next(request);

    if (!routes.some((name) => name === request.data.route?.name)) {
        return response;
    }

    let page = response as Page,
        disconnect = () => {},
        spy = nav.spy(page.toc.map((item) => item.id));

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
