import { html } from '~/viewer/app';
import { sections } from '~/viewer/data/nav';
import { matches } from '../search';
import type { Request } from '~/viewer/app';
import './scss/index.scss';


const active = (request: Request, name: string, slug: string) =>
    request.data.route?.name === name && (request.data.parameters?.slug ?? '') === slug;


export default (request: Request) => html`
    <aside class='sidebar --scrollbar --scroll-fade'>
        ${sections.map((section) => html`
                <div class='sidebar-section ${() => section.groups.some((group) => group.links.some((link) => matches(link.label))) ? '' : '--hidden'}'>
                    ${section.index
                        ? html`<a class='sidebar-title' href='${section.href}'>${section.label}</a>`
                        : html`<div class='sidebar-title'>${section.label}</div>`}

                    ${section.groups.map((group) => html`
                        <div class='sidebar-group ${() => group.links.some((link) => matches(link.label)) ? '' : '--hidden'}'>
                            ${group.label && html`<div class='sidebar-heading'>${group.label}</div>`}

                            ${group.links.map((link) => html`
                                <a
                                    class='sidebar-link ${() => [active(request, link.name, link.slug) ? '--active' : '', matches(link.label) ? '' : '--hidden'].join(' ')}'
                                    href='${link.href}'
                                >${link.label}</a>
                            `)}
                        </div>
                    `)}
                </div>
            `)}
    </aside>
`;
