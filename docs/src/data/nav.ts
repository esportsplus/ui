import { uri } from '~/app';
import { utilities } from '~/data/utilities';
import { entries } from '~/examples';
import { meta } from '~/meta';
import type { RouteName } from '~/app';


type Link = {
    href: string;
    label: string;
    name: RouteName;
    slug: string;
};

type Group = {
    label: string;
    links: Link[];
};

type Section = {
    groups: Group[];
    href: string;
    index: boolean;
    label: string;
};


function links(names: string[], name: 'components.detail' | 'css-utilities.detail', label = (slug: string) => slug): Link[] {
    return names
        .map((slug) => ({ href: uri(name, { slug }), label: label(slug), name, slug }))
        .sort((a, b) => a.label.localeCompare(b.label));
}


const sections = (): Section[] => [
    {
        groups: [
            {
                label: '',
                links: [
                    { href: uri('docs'), label: 'Installation', name: 'docs', slug: '' },
                    { href: uri('tokens'), label: 'Tokens', name: 'tokens', slug: '' },
                    { href: uri('themes'), label: 'Themes', name: 'themes', slug: '' },
                    { href: uri('fonts'), label: 'Fonts', name: 'fonts', slug: '' },
                ]
            }
        ],
        href: uri('docs'),
        index: false,
        label: 'Getting Started'
    },
    {
        groups: [
            {
                label: '',
                links: links(entries.map((item) => item.name), 'components.detail', (slug) => meta[slug]?.label ?? slug)
            }
        ],
        href: uri('components'),
        index: true,
        label: 'Components'
    },
    {
        groups: [
            {
                label: '',
                links: links(utilities.map((item) => item.name), 'css-utilities.detail')
            }
        ],
        href: uri('css-utilities'),
        index: true,
        label: 'CSS Utilities'
    }
];


export { sections };
