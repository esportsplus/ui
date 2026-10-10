import { modifiers } from 'docs/data/modifiers';
import directory from 'docs/components/directory';
import type { Router } from 'docs/app';
import type { Item } from 'docs/components/directory';
import 'docs/actions/modifiers/scss/index.scss';


const items: Item[] = modifiers.map((modifier) => ({
    description: modifier.description,
    label: modifier.name,
    name: modifier.name,
    variants: () => modifier.variants
}));


const page = (slug?: string) => directory({
    description: 'Behavior added onto existing elements, each a script that sets up what its classes need.',
    items,
    route: 'modifiers',
    slug,
    title: 'Modifiers'
});


export default (r: Router) => r
    .get({ name: 'modifiers', path: '/modifiers', responder: () => page() })
    .get({ name: 'modifiers.detail', path: '/modifiers/:slug', responder: (request) => page(request.data.parameters?.slug) });
