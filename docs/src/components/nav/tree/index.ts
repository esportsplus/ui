import { html } from '../../../app';
import './scss/index.scss';


type TreeLink = {
    label: string;
    href: string;
    active?: () => boolean;
    visible?: () => boolean;
    onclick?: (event: Event) => void;
};

type TreeSection = {
    label: string;
    href?: string;
    groups: { label?: string; links: TreeLink[] }[];
};


const visible = (link: TreeLink) => link.visible?.() ?? true;

const navTree = (sections: TreeSection[]) => html`
    <nav class='nav-tree --flex-column' style='--gap-horizontal: var(--size-600);--gap-vertical: var(--size-600);'>
        ${sections.map((section) => html`
            <div
                class='nav-tree-group --flex-column ${() => section.groups.some((group) => group.links.some(visible)) ? '' : '--hidden'}'
                style='--gap-horizontal: var(--size-200);--gap-vertical: var(--size-200);'
            >
                ${section.href
                    ? html`<a class='nav-tree-title text' href='${section.href}' style='--font-size: var(--font-size-200); --font-weight: var(--font-weight-500); text-transform: uppercase;'>${section.label}</a>`
                    : html`<div class='nav-tree-title text' style='--font-size: var(--font-size-200); --font-weight: var(--font-weight-500); text-transform: uppercase;'>${section.label}</div>`}

                ${section.groups.map((group) => html`
                    <div class='nav-tree-links --flex-column ${() => group.links.some(visible) ? '' : '--hidden'}'>
                        ${group.label && html`<div class='nav-tree-title text' style='--font-size: var(--font-size-200); --font-weight: var(--font-weight-300); padding-left: var(--size-300); padding-right: var(--size-300); text-transform: uppercase;'>${group.label}</div>`}

                        ${group.links.map((link) => html`
                            <a
                                class='nav-tree-link link ${() => [link.active?.() ? '--active' : '', visible(link) ? '' : '--hidden'].join(' ')}'
                                href='${link.href}'
                                style='--border-width: var(--border-width-400); --font-size: var(--font-size-300); --padding-horizontal: var(--size-300); --padding-vertical: var(--size-100); border-left: var(--border-width) solid var(--border-color); ${() => `--font-weight: var(--font-weight-${link.active?.() ? 500 : 300});`}'
                            >${link.label}</a>
                        `)}
                    </div>
                `)}
            </div>
        `)}
    </nav>
`;


export { navTree };
export type { TreeLink, TreeSection };
