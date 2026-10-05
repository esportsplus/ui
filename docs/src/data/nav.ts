import { uri } from 'docs/app';
import { utilities } from 'docs/data/utilities';
import { entries } from 'docs/examples';
import { meta } from 'docs/meta';
import type { RouteName } from 'docs/app';


type Link = {
    href: string;
    label: string;
    name: RouteName;
    slug: string;
};

type Section = {
    href: string;
    index: boolean;
    label: string;
    links: Link[];
};


let cache: Section[] | undefined;


function links(names: string[], name: 'components.detail' | 'css-utilities.detail', label = (slug: string) => slug): Link[] {
    return names
        .map((slug) => ({ href: uri(name, { slug }), label: label(slug), name, slug }))
        .sort((a, b) => a.label.localeCompare(b.label));
}


const sections = (): Section[] => cache ??= [
    {
        href: uri('docs'),
        index: false,
        label: 'Getting Started',
        links: [
            { href: uri('docs'), label: 'Installation', name: 'docs', slug: '' },
            { href: uri('tokens'), label: 'Tokens', name: 'tokens', slug: '' },
            { href: uri('themes'), label: 'Themes', name: 'themes', slug: '' },
            { href: uri('fonts'), label: 'Fonts', name: 'fonts', slug: '' }
        ]
    },
    {
        href: uri('components'),
        index: true,
        label: 'Components',
        links: links(entries.map((item) => item.name), 'components.detail', (slug) => meta[slug]?.label ?? slug)
    },
    {
        href: uri('css-utilities'),
        index: true,
        label: 'CSS Utilities',
        links: links(utilities.map((item) => item.name), 'css-utilities.detail')
    }
];


export { sections };
