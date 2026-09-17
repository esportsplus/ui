import { utilities } from './utilities';
import { entries } from '~/viewer/examples';


type Link = {
    label: string;
    section: string;
    slug: string;
};

type Group = {
    label: string;
    links: Link[];
};

type Section = {
    groups: Group[];
    index: boolean;
    label: string;
    section: string;
};


function links(names: string[], section: string): Link[] {
    return names
        .map((name) => ({ label: name, section, slug: name }))
        .sort((a, b) => a.label.localeCompare(b.label));
}


const sections: Section[] = [
    {
        groups: [
            {
                label: '',
                links: [
                    { label: 'Introduction', section: 'docs', slug: '' },
                    { label: 'Tokens', section: 'tokens', slug: '' },
                    { label: 'Themes', section: 'themes', slug: '' },
                    { label: 'Fonts', section: 'fonts', slug: '' }
                ]
            }
        ],
        index: false,
        label: 'Getting Started',
        section: 'docs'
    },
    {
        groups: [
            { label: '', links: links(entries.map((item) => item.name), 'components') }
        ],
        index: true,
        label: 'Components',
        section: 'components'
    },
    {
        groups: [
            { label: '', links: links(utilities.map((item) => item.name), 'css-utilities') }
        ],
        index: true,
        label: 'CSS Utilities',
        section: 'css-utilities'
    }
];


export { sections };
export type { Link, Group, Section };
