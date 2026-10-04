import { uri } from 'docs/app';
import { utilities } from 'docs/data/utilities';
import { cardGrid, detailPage, missing } from 'docs/components/page';
import type { Router } from 'docs/app';
import type { Page } from 'docs/types';


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
    .get({ name: 'css-utilities', path: '/css-utilities', responder: () => page('') })
    .get({ name: 'css-utilities.detail', path: '/css-utilities/:slug', responder: (request) => page(request.data.parameters?.slug ?? '') });
