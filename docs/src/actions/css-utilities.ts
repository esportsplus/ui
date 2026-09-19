import { uri } from '../app';
import { utilities } from '../data/utilities';
import { cardGrid, detailPage, missing } from '../components/page';
import { layout } from '../components/layout';
import type { Router } from '../app';
import type { Page } from '../types';


const index: Record<string, (typeof utilities)[number]> = {};


for (let i = 0, n = utilities.length; i < n; i++) {
    index[utilities[i].name] = utilities[i];
}


const page = (slug: string): Page => {
    if (slug === '') {
        return cardGrid(
            'Composable, token-aware class utilities you can drop onto any element to reuse the same CSS without writing it twice.',
            'CSS Utilities',
            utilities.map((utility) => ({
                description: utility.description,
                href: uri('css-utilities.detail', { slug: utility.name }),
                name: utility.name
            }))
        );
    }

    let utility = index[slug];

    if (!utility) {
        return missing(`No utility named "${slug}".`);
    }

    return detailPage({
        description: utility.description,
        name: utility.name,
        variants: utility.variants
    });
};


export default (r: Router) => r
    .get({ name: 'css-utilities', path: '/css-utilities', responder: () => layout(page('')) })
    .get({ name: 'css-utilities.detail', path: '/css-utilities/:slug', responder: (request) => layout(page(request.data.parameters?.slug ?? '')) });
