import { effect, signal, write } from '@esportsplus/reactivity';
import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import highlight, { type A as HighlightAttributes } from '~/components/highlight';


type A = Attributes & {
    // The highlight's attributes; left out, the links go unhighlighted. A 'border' lays the links along a rail on that
    // edge, the border marking the active link's part of it; without one the fill is a pill.
    [NAV_TREE_HIGHLIGHT]?: HighlightAttributes;
    // The key of the active link or section title; each matches through its own `key`, which defaults to its `href`.
    active?: () => string | undefined;
    // 'page' marks the active link as the current page and 'location' as the current spot within it; 'command' is for
    // 'command' results, which own focus and selection.
    current?: Current;
    sections: TreeSection[];
    // Cuts every link to one line, ending in an ellipsis.
    truncate?: boolean;
};

type Current = 'command' | 'location' | 'page';

type TreeGroup = {
    label?: string;
    links: TreeLink[];
};

type TreeLink = {
    // Marks the link active on its own in place of the tree's `active` key, so several can be active at once.
    active?: () => boolean;
    attributes?: Attributes;
    content?: Renderable<unknown>;
    // Left out for 'command' results that run rather than navigate.
    href?: string;
    key?: string;
    label: string;
    onclick?: (event: Event) => void;
    visible?: () => boolean;
};

type TreeSection = {
    active?: () => boolean;
    attributes?: Attributes;
    groups: TreeGroup[];
    // Turns the section title into a link.
    href?: string;
    key?: string;
    label: string;
    onclick?: (event: Event) => void;
};


const NAV_TREE_HIGHLIGHT = Symbol.for('@esportsplus/ui/nav.tree.highlight');


function keyOf(item: TreeLink | TreeSection) {
    return item.key ?? item.href;
}

function visible(link: TreeLink) {
    return link.visible?.() ?? true;
}


const tree = ({ [NAV_TREE_HIGHLIGHT]: highlighting, active, current = 'page', sections, truncate, ...attributes }: A) => {
    let border = highlighting?.border;

    // A private mirror of the active key that every link selects on, so a change restyles the two links it moves
    // between rather than every link.
    let selected = signal<string | undefined>(undefined);

    if (active) {
        effect(() => active(), (key) => {
            write(selected, key);
        });
    }

    function activeClass(item: TreeLink | TreeSection) {
        let own = item.active;

        if (own) {
            return () => own() && '--active';
        }

        return active && (() => signal.selector(selected, keyOf(item)) && '--active');
    }

    function ariaCurrent(item: TreeLink | TreeSection) {
        let own = item.active;

        if (current === 'command') {
            return 'false';
        }

        if (own) {
            return () => own() ? current : 'false';
        }

        return active
            ? () => signal.selector(selected, keyOf(item)) ? current : 'false'
            : 'false';
    }

    return html`
        <nav
            class='nav-tree ${border && 'nav-tree--rail'} ${truncate && 'nav-tree--truncate'}'
            ${current === 'command' && { role: 'presentation' }}
            ${attributes}
        >
            ${highlighting && highlight({
                target: '.nav-tree-link:not([hidden])',
                ...highlighting,
                class: ['nav-tree-highlight', border && 'highlight--rail', ...[highlighting.class ?? []].flat()]
            })}
            ${sections.map((section) => html`
                <div
                    class='nav-tree-group'
                    ${section.groups.some((group) => group.links.some((link) => link.visible)) && { hidden: () => !section.groups.some((group) => group.links.some(visible)) }}
                    ${current === 'command' && { 'aria-label': section.label, role: 'group' }}
                    ${section.attributes}
                >
                    ${section.href
                        ? html`
                            <a
                                aria-current='${ariaCurrent(section)}'
                                class='nav-tree-link nav-tree-title ${activeClass(section)}'
                                href='${section.href}'
                                onclick='${(event: Event) => section.onclick?.(event)}'
                            >${section.label}</a>
                        `
                        : html`<div class='nav-tree-title'>${section.label}</div>`}

                    ${section.groups.map((group) => {
                        return html`
                            <div
                                class='nav-tree-links ${border && `highlight-rail highlight-rail--${border}`}'
                                ${group.links.some((link) => link.visible) && { hidden: () => !group.links.some(visible) }}
                            >
                                ${group.label && html`
                                    <div class='nav-tree-title'>
                                        ${group.label}
                                    </div>
                                `}

                                ${group.links.map((link) => html`
                                    <a
                                        aria-current='${ariaCurrent(link)}'
                                        class='nav-tree-link ${activeClass(link)}'
                                        ${link.visible && { hidden: () => !visible(link) }}
                                        ${link.href !== undefined && { href: link.href }}
                                        ${{
                                            onclick: (event: Event) => link.onclick?.(event)
                                        }}
                                        ${current === 'command' && { tabindex: -1 }}
                                        ${link.attributes}
                                    >
                                        ${link.content ?? link.label}
                                    </a>
                                `)}
                            </div>
                        `;
                    })}
                </div>
            `)}
        </nav>
    `;
};


export default component(tree, { highlight: NAV_TREE_HIGHLIGHT });
export type { Current, TreeGroup, TreeLink, TreeSection };
