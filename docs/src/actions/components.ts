import { entries } from 'docs/examples';
import { groupVariants } from 'docs/examples/groups';
import { meta } from 'docs/meta';
import directory from 'docs/components/directory';
import type { Router } from 'docs/app';
import type { Item } from 'docs/components/directory';


const items: Item[] = entries.map((entry) => ({
    description: meta[entry.name]?.description ?? '',
    label: meta[entry.name]?.label ?? entry.name,
    name: entry.name,
    variants: () => groupVariants(entry.name, entry.variants)
}));


const page = (slug?: string) => directory({
    description: 'A reactive, themeable component library built on compile-time template transforms. Select a component to see every variant.',
    items,
    route: 'components',
    slug,
    title: 'Components'
});


export default (r: Router) => r
    .get({ name: 'components', path: '/components', responder: () => page() })
    .get({ name: 'components.detail', path: '/components/:slug', responder: (request) => page(request.data.parameters?.slug) });
