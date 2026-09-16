import { html } from '@esportsplus/template';
import { sections } from './nav';
import { href, state } from './router';
import { matches } from './search';


const active = (section: string, slug: string) => state.section === section && state.slug === slug;


export default html`
    <aside class='viewer-nav --scrollbar'>
        <div class='viewer-nav-inner'>
            ${sections.map((section) => html`
                <div class='viewer-nav-section ${() => section.groups.some((group) => group.links.some((link) => matches(link.label))) ? '' : '--hidden'}'>
                    ${section.index
                        ? html`<a class='viewer-nav-title' href='${href(section.section)}'>${section.label}</a>`
                        : html`<div class='viewer-nav-title'>${section.label}</div>`}

                    ${section.groups.map((group) => html`
                        <div class='viewer-nav-group ${() => group.links.some((link) => matches(link.label)) ? '' : '--hidden'}'>
                            ${group.label && html`<div class='viewer-nav-heading'>${group.label}</div>`}

                            ${group.links.map((link) => html`
                                <a
                                    class='viewer-nav-link ${() => [active(link.section, link.slug) ? '--active' : '', matches(link.label) ? '' : '--hidden'].join(' ')}'
                                    href='${href(link.section, link.slug)}'
                                >${link.label}</a>
                            `)}
                        </div>
                    `)}
                </div>
            `)}
        </div>
    </aside>
`;
