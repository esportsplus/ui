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
    <nav class='nav-tree --flex-column --gap-600'>
        ${sections.map((section) => html`
            <div class='nav-tree-group --flex-column --gap-200 ${() => section.groups.some((group) => group.links.some(visible)) ? '' : '--hidden'}'>
                ${section.href
                    ? html`<a class='nav-tree-title text --text-uppercase --font-size-200 --font-weight-500' href='${section.href}'>${section.label}</a>`
                    : html`<div class='nav-tree-title text --text-uppercase --font-size-200 --font-weight-500'>${section.label}</div>`}

                ${section.groups.map((group) => html`
                    <div class='nav-tree-links --flex-column --gap-0px ${() => group.links.some(visible) ? '' : '--hidden'}'>
                        ${group.label && html`<div class='nav-tree-title text --text-uppercase --font-size-200 --font-weight-300 --padding-horizontal --padding-horizontal-300'>${group.label}</div>`}

                        ${group.links.map((link) => html`
                            <a
                                class='nav-tree-link link --border-left --padding --padding-horizontal-300 --padding-vertical-100 --font-size-300 ${() => [link.active?.() ? '--active --font-weight-500' : '--font-weight-300', visible(link) ? '' : '--hidden'].join(' ')}'
                                href='${link.href}'
                                ${{ onclick: link.onclick }}
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
