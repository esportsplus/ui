import { html } from '../../app';
import icon from '~/components/icon';
import arrowLeft from '~/storage/svg/arrow-left.svg';
import arrowRight from '~/storage/svg/arrow-right.svg';
import { sections } from '../../data/nav';
import './index.scss';


const pageNavigation = () => {
    const pages = sections().flatMap((section) => [
        ...(section.index ? [{ href: section.href, label: section.label }] : []),
        ...section.groups.flatMap((group) => group.links)
    ]);
    const path = location.pathname.replace(/\/$/, '') || '/docs';
    const index = pages.findIndex((page) => page.href === path);
    const directions = [
        { name: 'Previous', page: index > 0 ? pages[index - 1] : undefined, svg: arrowLeft, style: 'margin-left: -4px;' },
        { name: 'Next', page: index >= 0 ? pages[index + 1] : undefined, svg: arrowRight, style: 'margin-right: -4px;' }
    ];

    return html`
        <nav class='page-navigation' aria-label='Page navigation'>
            ${directions.map(({ name, page, svg, style }) => {
                const graphic = icon({ 'aria-hidden': 'true', style: `--size: var(--size-400);${style}` }, svg);

                return page
                    ? html`
                        <a
                            aria-label='${name} page: ${page.label}'
                            class='page-arrow'
                            href='${page.href}'
                            title='${name}: ${page.label}'
                        >
                            ${graphic}
                        </a>`
                    : html`
                        <button class='page-arrow --disabled' type='button' disabled aria-disabled='true' aria-label='${name} page' title='No ${name.toLowerCase()} page'>
                            ${graphic}
                        </button>
                    `;
            })}
        </nav>
    `;
};

export { pageNavigation };
