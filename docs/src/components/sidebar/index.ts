import { html } from '../../app';
import { sections } from '../../data/nav';
import { navTree } from '../nav/tree';
import { matches, searchTrigger } from '../search';
import type { Request } from '../../app';
import './scss/index.scss';


export default (request: Request) => html`
    <aside class='docs-sidebar --flex-column --gap-600 --scrollbar --scroll-fade'>
        ${searchTrigger('Quick search')}
        ${navTree(sections().map((section) => ({
            label: section.label,
            href: section.index ? section.href : undefined,
            groups: section.groups.map((group) => ({
                label: group.label,
                links: group.links.map((link) => ({
                    label: link.label,
                    href: link.href,
                    active: () => request.data.route?.name === link.name && (request.data.parameters?.slug ?? '') === link.slug,
                    visible: () => matches(link.label)
                }))
            }))
        })))}
    </aside>
`;
