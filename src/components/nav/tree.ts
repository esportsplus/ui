import { effect, signal, write } from '@esportsplus/reactivity';
import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import highlight from '~/components/highlight';


type A = Attributes & {
    // The key of the active link or section title; each matches through its own `key`, which defaults to its `href`.
    active?: () => string | undefined;
    // 'page' marks the active link as the current page; 'command' is for 'command' results, which own focus and selection.
    current?: Current;
    // How the active link is marked: 'highlight' glides a solid pill between links; the rest glide a 'highlight--rule'
    // along a rule down the links' edge, where 'background' fills the active link, 'border' marks its part of the rule,
    // and 'both' does both.
    indicator?: Indicator;
    sections: TreeSection[];
};

type Current = 'command' | 'page';

type Indicator = 'background' | 'border' | 'both' | 'highlight';

type TreeGroup = {
    label?: string;
    links: TreeLink[];
};

type TreeLink = {
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
    attributes?: Attributes;
    groups: TreeGroup[];
    // Turns the section title into a link.
    href?: string;
    key?: string;
    label: string;
    onclick?: (event: Event) => void;
};


function keyOf(item: TreeLink | TreeSection) {
    return item.key ?? item.href;
}

function visible(link: TreeLink) {
    return link.visible?.() ?? true;
}


export default component<A>(({ active, current = 'page', indicator = 'highlight', sections, ...attributes }) => {
    // A private mirror of the active key that every link selects on, so a change restyles the two links it moves
    // between rather than every link.
    let selected = signal<string | undefined>(undefined);

    if (active) {
        effect(() => active(), (key) => {
            write(selected, key);
        });
    }

    function activeClass(item: TreeLink | TreeSection) {
        return active && (() => signal.selector(selected, keyOf(item)) && '--active');
    }

    function ariaCurrent(item: TreeLink | TreeSection) {
        return active && current !== 'command'
            ? () => signal.selector(selected, keyOf(item)) ? current : 'false'
            : 'false';
    }

    return html`
        <nav
            class='nav-tree ${current === 'command' && 'nav-tree--command'} ${indicator === 'highlight' ? 'nav-tree--highlight' : 'nav-tree--rule'} ${indicator === 'border' && 'nav-tree--border'}'
            ${current === 'command' && { role: 'presentation' }}
            ${attributes}
        >
            ${highlight({
                class: ['nav-tree-highlight', indicator !== 'highlight' && 'highlight--rule'],
                line: indicator === 'border' || indicator === 'both' ? 'left' : undefined,
                target: '.nav-tree-link:not([hidden])'
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
                                class='nav-tree-links ${indicator !== 'highlight' && 'highlight-rule highlight-rule--vertical'}'
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
});

export type { Current, Indicator, TreeGroup, TreeLink, TreeSection };
