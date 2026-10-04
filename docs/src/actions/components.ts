import { uri } from 'docs/app';
import { entries } from 'docs/examples';
import { groupVariants } from 'docs/examples/groups';
import { meta } from 'docs/meta';
import { cardGrid, detailPage, missing } from 'docs/components/page';
import { layout } from 'docs/components/layout';
import type { Router } from 'docs/app';
import type { Page } from 'docs/types';


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
                name: meta[entry.name]?.label ?? entry.name
            }))
        );
    }

    let entry = index[slug];

    if (!entry) {
        return missing(`No component named "${slug}".`);
    }

    return detailPage({
        breadcrumb: [
            { href: uri('components'), label: 'Components' },
            { href: uri('components.detail', { slug }), label: meta[slug]?.label ?? entry.name }
        ],
        description: meta[slug]?.description ?? '',
        name: meta[slug]?.label ?? entry.name,
        variants: groupVariants(slug, entry.variants)
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
