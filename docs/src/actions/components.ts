import { uri } from '../app';
import { entries } from '../examples';
import { meta } from '../meta';
import { cardGrid, detailPage, layout, missing } from '../components/preview';
import type { Router } from '../app';
import type { Page } from '../types';


let index: Record<string, (typeof entries)[number]> = {};


for (let i = 0, n = entries.length; i < n; i++) {
    index[entries[i].name] = entries[i];
}


function page(slug: string = ''): Page {
    if (slug === '') {
        return cardGrid(
            'A reactive, themeable component library built on compile-time template transforms. Select a component to see every variant.',
            'Components',
            entries.map((entry) => ({
                description: meta[entry.name]?.description ?? '',
                href: uri('components.detail', { slug: entry.name }),
                name: entry.name
            }))
        );
    }

    let entry = index[slug];

    if (!entry) {
        return missing(`No component named "${slug}".`);
    }

    return detailPage({
        description: meta[slug]?.description ?? '',
        name: entry.name,
        variants: entry.variants
    });
}


export default (r: Router) => r
    .get({
        name: 'components',
        path: '/components',
        responder: () => layout(page())
    })
    .get({
        name: 'components.detail',
        path: '/components/:slug',
        responder: (request) => layout(page(request.data.parameters?.slug ?? ''))
    });
