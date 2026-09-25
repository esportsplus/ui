import { breadcrumb, tooltip } from '@esportsplus/ui';
import { component, html, type Attributes } from '@esportsplus/template';


let content = 'padding: var(--size-300) 0; --background: var(--color-black-400); color: var(--color-white-400);',
    option = 'padding: var(--size-200) var(--size-500); --color-default: var(--color-white-400); white-space: nowrap;';

let routerLink = component<Attributes & { to: string }>(
    ({ to, ...attributes }, content) => html`<a href='${to}' ${attributes}>${content}</a>`
);


export default {
    name: 'breadcrumb',
    variants: [
        {
            render: () => breadcrumb(
                breadcrumb.list(html`
                    ${breadcrumb.item(breadcrumb.link({ href: '/docs' }, 'Home'))}
                    ${breadcrumb.separator()}
                    ${breadcrumb.item(breadcrumb.link({ href: '/components' }, 'Components'))}
                    ${breadcrumb.separator()}
                    ${breadcrumb.item(breadcrumb.page('Breadcrumb'))}
                `)
            ),
            title: 'basic'
        },
        {
            render: () => breadcrumb(
                breadcrumb.list(html`
                    ${breadcrumb.item(breadcrumb.link({ href: '/docs' }, 'Home'))}
                    ${breadcrumb.separator('/')}
                    ${breadcrumb.item(breadcrumb.link({ href: '/components' }, 'Components'))}
                    ${breadcrumb.separator('/')}
                    ${breadcrumb.item(breadcrumb.page('Breadcrumb'))}
                `)
            ),
            title: 'custom separator'
        },
        {
            render: () => breadcrumb(
                breadcrumb.list(html`
                    ${breadcrumb.item(breadcrumb.link({ href: '/docs' }, 'Home'))}
                    ${breadcrumb.separator()}
                    ${breadcrumb.item(breadcrumb.ellipsis())}
                    ${breadcrumb.separator()}
                    ${breadcrumb.item(breadcrumb.link({ href: '/components' }, 'Components'))}
                    ${breadcrumb.separator()}
                    ${breadcrumb.item(breadcrumb.page('Breadcrumb'))}
                `)
            ),
            title: 'collapsed'
        },
        {
            render: () => breadcrumb(
                breadcrumb.list(html`
                    ${breadcrumb.item(breadcrumb.link({ href: '/docs' }, 'Home'))}
                    ${breadcrumb.separator('/')}
                    ${breadcrumb.item(
                        breadcrumb.menu(
                            {
                                [tooltip.menu.option]: { style: option },
                                options: [
                                    { content: 'Documentation' },
                                    { content: 'Themes' },
                                    { content: 'GitHub' }
                                ],
                                [tooltip.menu.tooltipContent]: { style: content }
                            },
                            'Components'
                        )
                    )}
                    ${breadcrumb.separator('/')}
                    ${breadcrumb.item(breadcrumb.page('Breadcrumb'))}
                `)
            ),
            title: 'dropdown'
        },
        {
            render: () => breadcrumb(
                breadcrumb.list(html`
                    ${breadcrumb.item(breadcrumb.link({ render: routerLink, to: '/docs' }, 'Home'))}
                    ${breadcrumb.separator()}
                    ${breadcrumb.item(breadcrumb.link({ render: routerLink, to: '/components' }, 'Components'))}
                    ${breadcrumb.separator()}
                    ${breadcrumb.item(breadcrumb.page('Breadcrumb'))}
                `)
            ),
            title: 'link component'
        }
    ]
};
