import { entries } from '~/viewer/examples';
import { meta } from '~/viewer/meta';
import { cardGrid, detailPage, missing } from './preview';
import type { Page } from '~/viewer/types';


const index: Record<string, (typeof entries)[number]> = {};


for (let i = 0, n = entries.length; i < n; i++) {
    index[entries[i].name] = entries[i];
}


const page = (slug: string): Page => {
    if (slug === '') {
        return cardGrid(
            'Component Library',
            'A reactive, themeable component library built on compile-time template transforms. Select a component to see every variant.',
            'Components',
            entries.map((entry) => ({
                description: meta[entry.name]?.description ?? '',
                name: entry.name,
                section: 'components'
            }))
        );
    }

    let entry = index[slug];

    if (!entry) {
        return missing(`No component named "${slug}".`);
    }

    return detailPage({
        description: meta[slug]?.description ?? '',
        eyebrow: meta[slug]?.category ?? 'Component',
        name: entry.name,
        variants: entry.variants
    });
};


export default page;
