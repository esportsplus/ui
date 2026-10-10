import { uri } from 'docs/app';
import { modifiers } from 'docs/data/modifiers';
import { entries } from 'docs/examples';
import { meta } from 'docs/meta';
import type { PaginationLink } from '@esportsplus/ui/components/pagination';
import type { RouteName } from 'docs/app';


type Link = {
    // The one-line pitch the previous and next cards show for the page.
    description: string;
    // The small line above the page's name on those cards.
    eyebrow: string;
    href: string;
    label: string;
    name: RouteName;
    slug: string;
};

type Page = Pick<Link, 'description' | 'eyebrow' | 'href' | 'label'>;

type Section = {
    description: string;
    eyebrow: string;
    href: string;
    index: boolean;
    label: string;
    links: Link[];
};


const TRAILING_SLASH = /\/$/;


let cache: Section[] | undefined,
    pages: Page[] | undefined;


function card(link: Page | undefined): PaginationLink | undefined {
    return link && { description: link.description, href: link.href, label: link.eyebrow, title: link.label };
}

function links(
    names: { description: string, name: string }[],
    name: 'components.detail' | 'modifiers.detail',
    eyebrow: string,
    label = (slug: string) => slug
): Link[] {
    return names
        .map((item) => ({ description: item.description, eyebrow, href: uri(name, { slug: item.name }), label: label(item.name), name, slug: item.name }))
        .sort((a, b) => a.label.localeCompare(b.label));
}

// Every page in sidebar order, section index pages included, for stepping to the one before or after.
function sequence() {
    let out: Page[] = [];

    for (let section of sections()) {
        if (section.index) {
            out.push(section);
        }

        out.push(...section.links);
    }

    return out;
}


// The pages either side of the current one, as pagination links; the installation page stands in for the bare root
// and for any unmatched path, since the fallback route renders it there too.
const adjacent = () => {
    let all = pages ??= sequence(),
        path = location.pathname.replace(TRAILING_SLASH, ''),
        index = all.findIndex((page) => page.href === path);

    if (index === -1) {
        index = all.findIndex((page) => page.href === uri('installation'));
    }

    return { next: card(all[index + 1]), previous: card(all[index - 1]) };
};

const sections = (): Section[] => cache ??= [
    {
        description: '',
        eyebrow: '',
        href: uri('installation'),
        index: false,
        label: 'Getting Started',
        links: [
            { description: 'Add the library and build your first component.', eyebrow: 'Start here', href: uri('installation'), label: 'Installation', name: 'installation', slug: '' },
            { description: 'The design tokens every component is built from.', eyebrow: 'Learn the system', href: uri('tokens'), label: 'Tokens', name: 'tokens', slug: '' },
            { description: 'Make the library fit your design.', eyebrow: 'Customize your project', href: uri('themes'), label: 'Themes', name: 'themes', slug: '' },
            { description: 'How layers count their level and stay distinct at any depth.', eyebrow: 'Layer the interface', href: uri('surfaces'), label: 'Surfaces', name: 'surfaces', slug: '' },
            { description: 'The typefaces bundled with the library.', eyebrow: 'Set the type', href: uri('fonts'), label: 'Fonts', name: 'fonts', slug: '' }
        ]
    },
    {
        description: 'Every component, each with its live variants.',
        eyebrow: 'Browse the library',
        href: uri('components'),
        index: true,
        label: 'Components',
        links: links(
            entries.map((item) => ({ description: meta[item.name]?.description ?? '', name: item.name })),
            'components.detail',
            'Components',
            (slug) => meta[slug]?.label ?? slug
        )
    },
    {
        description: 'Class helpers for layout, color, type and scrolling.',
        eyebrow: 'Style without components',
        href: uri('modifiers'),
        index: true,
        label: 'Modifiers',
        links: links(modifiers, 'modifiers.detail', 'Modifiers')
    }
];


export { adjacent, sections };
