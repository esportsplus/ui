import { highlight } from '@esportsplus/ui/components';
import { effect, html } from 'docs/app';
import { scrollSpy } from 'docs/components/nav/tree/spy';
import type { Attributes, Renderable } from '@esportsplus/template';
import 'docs/components/nav/tree/scss/index.scss';


type TreeLink = {
    label: string;
    href: string;
    active?: () => boolean;
    visible?: () => boolean;
    onclick?: (event: Event) => void;
    attributes?: Attributes;
    content?: Renderable<unknown>;
};

type TreeSection = {
    label: string;
    href?: string;
    active?: () => boolean;
    onclick?: (event: Event) => void;
    groups: { label?: string; links: TreeLink[] }[];
};


function indicator(element: HTMLElement, links: TreeLink[]) {
    let bar = element.querySelector<HTMLElement>(':scope > .nav-tree-indicator'),
        frame = 0;

    if (!bar) {
        return () => {};
    }

    let dispose = effect(() => {
        let end = -1,
            start = -1;

        for (let i = 0, n = links.length; i < n; i++) {
            if (visible(links[i]) && links[i].active?.()) {
                if (start === -1) {
                    start = i;
                }

                end = i;
            }
        }

        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
            let anchors = element.querySelectorAll<HTMLElement>(':scope > .nav-tree-link'),
                first = anchors[start],
                last = anchors[end];

            if (!bar) {
                return;
            }

            if (!first || !last) {
                bar.classList.remove('--active');
                return;
            }

            bar.style.height = `${last.offsetTop + last.offsetHeight - first.offsetTop}px`;
            bar.style.transform = `translateY(${first.offsetTop}px)`;

            bar.classList.add('--active');
        });
    });

    return () => {
        cancelAnimationFrame(frame);
        dispose();
    };
}

function visible (link: TreeLink) {
    return link.visible?.() ?? true;
}


const navTree = (sections: TreeSection[], current: 'command' | 'location' | 'page' = 'page') => html`
    <nav
        class='nav-tree --flex-column ${current !== 'location' && 'nav-tree--highlight'} ${current === 'command' && '--command'}'
        ${current === 'command' && { role: 'presentation' }}
    >
        ${current !== 'location' && highlight({ class: 'nav-tree-highlight', hover: current !== 'command', target: '.nav-tree-link:not(.--hidden)' })}
        ${sections.map((section) => html`
            <div
                class='nav-tree-group --flex-column ${() => !section.groups.some((group) => group.links.some(visible)) && '--hidden'}'
                ${current === 'command' && { 'aria-label': section.label, role: 'group' }}
            >
                ${section.href
                    ? html`
                        <a
                            aria-current='${() => current !== 'command' && section.active?.() ? current : 'false'}'
                            class='nav-tree-link nav-tree-title link ${() => section.active?.() && '--active'}'
                            href='${section.href}'
                            onclick='${(event: Event) => section.onclick?.(event)}'
                        >${section.label}</a>
                    `
                    : html`<div class='nav-tree-title text'>${section.label}</div>`}

                ${section.groups.map((group) => {
                    let dispose = () => {};

                    return html`
                        <div
                            class='nav-tree-links --flex-column ${() => !group.links.some(visible) && '--hidden'}'
                            ${{
                                onconnect: (element: HTMLElement) => {
                                    if (current === 'location') {
                                        dispose = indicator(element, group.links);
                                    }
                                },
                                ondisconnect: () => dispose()
                            }}
                        >
                            ${group.label && html`
                                <div class='nav-tree-title text'>
                                    ${group.label}
                                </div>
                            `}

                            ${group.links.map((link) => html`
                                <a
                                    aria-current='${() => current !== 'command' && link.active?.() ? current : 'false'}'
                                    class='nav-tree-link link ${() => link.active?.() && '--active'} ${() => !visible(link) && '--hidden'}'
                                    href='${link.href}'
                                    ${{
                                        onclick: (event: Event) => link.onclick?.(event)
                                    }}
                                    ${current === 'command' && { tabindex: -1 }}
                                    ${link.attributes}
                                >${link.content ?? link.label}</a>
                            `)}

                            ${current === 'location' && html`<span aria-hidden='true' class='nav-tree-indicator'></span>`}
                        </div>
                    `;
                })}
            </div>
        `)}
    </nav>
`;


export { navTree, scrollSpy };
export type { TreeLink, TreeSection };
