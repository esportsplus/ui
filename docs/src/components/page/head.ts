import { html } from 'docs/app';
import breadcrumb from '@esportsplus/ui/components/breadcrumb';
import icon from '@esportsplus/ui/components/icon';
import arrow from '@esportsplus/ui/svg/arrow-right.svg';
import { sections } from 'docs/data/nav';
import type { Crumb } from '@esportsplus/ui/components/breadcrumb';
import '@esportsplus/ui/components/page/scss/index.scss';
import 'docs/components/page/scss/head.scss';


type Head = {
    breadcrumb?: Crumb[];
    description: string;
    title: string;
};


const TRAILING_SLASH = /\/$/;


const pageHead = ({ breadcrumb: trail, description, title }: Head) => {
    let pages = sections().flatMap((section) => [
            ...(section.index ? [{ href: section.href, label: section.label }] : []),
            ...section.groups.flatMap((group) => group.links)
        ]),
        path = location.pathname.replace(TRAILING_SLASH, '') || '/docs',
        index = pages.findIndex((page) => page.href === path),
        directions = [
            { name: 'Previous', page: index > 0 ? pages[index - 1] : undefined },
            { name: 'Next', page: index >= 0 ? pages[index + 1] : undefined }
        ];

    return html`
        <div class='page-head'>
            ${trail && trail.length > 0 && breadcrumb({ class: 'page-breadcrumb', items: trail })}
            <h1 class='page-title --text-crop'>${title}</h1>
            <nav class='page-navigation' aria-label='Page navigation'>
                ${directions.map(({ name, page }) => {
                    let graphic = icon({ 'aria-hidden': 'true' }, arrow);

                    return page
                        ? html`
                            <a
                                aria-label='${name} page: ${page.label}'
                                class='page-arrow'
                                href='${page.href}'
                                title='${name}: ${page.label}'
                            >${graphic}</a>
                        `
                        : html`
                            <button
                                aria-disabled='true'
                                aria-label='${name} page'
                                class='page-arrow --disabled'
                                disabled
                                title='No ${name.toLowerCase()} page'
                                type='button'
                            >${graphic}</button>
                        `;
                })}
            </nav>
            <p class='page-subtitle'>${description}</p>
        </div>
    `;
};


export { pageHead };
export type { Head };
