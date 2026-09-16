import { utilities } from '~/viewer/data/utilities';
import { cardGrid, detailPage, missing } from './preview';
import type { Page } from '~/viewer/types';


const index: Record<string, (typeof utilities)[number]> = {};


for (let i = 0, n = utilities.length; i < n; i++) {
    index[utilities[i].name] = utilities[i];
}


const page = (slug: string): Page => {
    if (slug === '') {
        return cardGrid(
            'Styling',
            'Composable, token-aware class utilities you can drop onto any element to reuse the same CSS without writing it twice.',
            'CSS Utilities',
            utilities.map((utility) => ({
                description: utility.description,
                name: utility.name,
                section: 'css-utilities'
            }))
        );
    }

    let utility = index[slug];

    if (!utility) {
        return missing(`No utility named "${slug}".`);
    }

    return detailPage({
        description: utility.description,
        eyebrow: utility.category,
        name: utility.name,
        variants: utility.variants
    });
};


export default page;
