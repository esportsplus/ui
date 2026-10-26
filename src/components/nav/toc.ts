import { component, type Attributes } from '@esportsplus/template';
import tree, { type TreeLink } from './tree';


type A = Attributes & {
    label?: string;
    links: TocLink[];
};

type TocLink = TreeLink & {
    href: string;
};


// Renders nothing without links, so a layout can collapse the column the table of contents would sit in.
export default component<A>(
    ({ label = 'On This Page', links, ...attributes }) => links.length > 0 && tree({
        'aria-label': label,
        ...attributes,
        current: 'location',
        sections: [{ groups: [{ links }], label }],
        truncate: true,
        [tree.highlight]: { border: 'left', fill: false }
    })
);


export type { TocLink };
