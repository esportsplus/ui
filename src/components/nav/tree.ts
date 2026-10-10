import { effect, signal, write } from '@esportsplus/reactivity';
import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import highlight from '~/components/highlight';


type A = Attributes & {
    // The key of the active link or section title; each matches through its own `key`, which defaults to its `href`.
    active?: () => string | undefined;
    // 'page' marks the active link in a solid highlight, 'command' does too for 'command' results (which own focus and
    // selection), and 'location' marks it softly over a rule down the links' edge. All three glide between links.
    current?: Current;
    // How the active link is marked: 'background' fills it, 'border' draws a bar down its left edge, 'both' does both.
    // 'background' by default, 'border' for 'location'.
    indicator?: Indicator;
    sections: TreeSection[];
};

type Current = 'command' | 'location' | 'page';

type Indicator = 'background' | 'border' | 'both';

type TreeGroup = {
    label?: string;
    links: TreeLink[];
};

type TreeLink = {
    attributes?: Attributes;
    content?: Renderable<unknown>;
    href: string;
    key?: string;
    label: string;
    onclick?: (event: Event) => void;
    visible?: () => boolean;
};

type TreeSection = {
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


export default component<A>(({ active, current = 'page', indicator = current === 'location' ? 'border' : 'background', sections, ...attributes }) => {
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
            class='nav-tree nav-tree--${current === 'location' ? 'location' : 'highlight'} ${current === 'command' && 'nav-tree--command'} ${indicator === 'border' && 'nav-tree--border'}'
            ${current === 'command' && { role: 'presentation' }}
            ${attributes}
        >
            ${highlight({
                class: 'nav-tree-highlight',
                fill: indicator !== 'border',
                hover: current !== 'command',
                line: indicator === 'background' ? undefined : 'left',
                target: '.nav-tree-link:not(.--hidden)'
            })}
            ${sections.map((section) => html`
                <div
                    class='nav-tree-group ${section.groups.some((group) => group.links.some((link) => link.visible)) && (() => !section.groups.some((group) => group.links.some(visible)) && '--hidden')}'
                    ${current === 'command' && { 'aria-label': section.label, role: 'group' }}
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
                            <div class='nav-tree-links ${group.links.some((link) => link.visible) && (() => !group.links.some(visible) && '--hidden')}'>
                                ${group.label && html`
                                    <div class='nav-tree-title'>
                                        ${group.label}
                                    </div>
                                `}

                                ${group.links.map((link) => html`
                                    <a
                                        aria-current='${ariaCurrent(link)}'
                                        class='nav-tree-link ${activeClass(link)} ${link.visible && (() => !visible(link) && '--hidden')}'
                                        href='${link.href}'
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
