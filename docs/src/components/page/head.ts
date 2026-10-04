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
            ...section.links
        ]),
        path = location.pathname.replace(TRAILING_SLASH, '') || '/docs',
        index = pages.findIndex((page) => page.href === path),
        directions = [
            { name: 'Previous', page: index > 0 ? pages[index - 1] : undefined },
            { name: 'Next', page: index >= 0 ? pages[index + 1] : undefined }
        ];

    return html`
        <div class='page-head'>
            ${trail && trail.length > 0 && breadcrumb({ class: 'page-head-breadcrumb', items: trail })}
            <h1 class='page-title page-head-title --text-crop'>${title}</h1>
            <nav class='page-head-navigation' aria-label='Page navigation'>
                ${directions.map(({ name, page }) => {
                    let graphic = icon({ 'aria-hidden': 'true', class: `page-head-arrow-icon page-head-arrow-icon--${name.toLowerCase()}` }, arrow);

                    return page
                        ? html`
                            <a
                                aria-label='${name} page: ${page.label}'
                                class='page-head-arrow'
                                href='${page.href}'
                                title='${name}: ${page.label}'
                            >${graphic}</a>
                        `
                        : html`
                            <button
                                aria-disabled='true'
                                aria-label='${name} page'
                                class='page-head-arrow --disabled'
                                disabled
                                title='No ${name.toLowerCase()} page'
                                type='button'
                            >${graphic}</button>
                        `;
                })}
            </nav>
            <p class='page-subtitle page-head-subtitle'>${description}</p>
        </div>
    `;
};


export { pageHead };
export type { Head };
