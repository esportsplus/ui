import { effect, html } from '../../../app';
import { scrollSpy } from './spy';
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

            if (!bar.classList.contains('--active')) {
                bar.classList.add('--active');
                requestAnimationFrame(() => bar?.classList.add('--animate'));
            }
        });
    });

    return () => {
        cancelAnimationFrame(frame);
        dispose();
    };
}


const visible = (link: TreeLink) => link.visible?.() ?? true;

const navTree = (sections: TreeSection[], current: 'location' | 'page' = 'page') => html`
    <nav class='nav-tree --flex-column' style='--gap-horizontal: var(--size-600);--gap-vertical: var(--size-600);'>
        ${sections.map((section) => html`
            <div
                class='nav-tree-group --flex-column ${() => section.groups.some((group) => group.links.some(visible)) ? '' : '--hidden'}'
                style='--gap-horizontal: var(--size-200);--gap-vertical: var(--size-200);'
            >
                ${section.href
                    ? html`<a class='nav-tree-title text' href='${section.href}' style='--font-size: var(--font-size-200); --font-weight: var(--font-weight-500); text-transform: uppercase;'>${section.label}</a>`
                    : html`<div class='nav-tree-title text' style='--font-size: var(--font-size-200); --font-weight: var(--font-weight-500); text-transform: uppercase;'>${section.label}</div>`}

                ${section.groups.map((group) => {
                    let dispose = () => {};

                    return html`
                        <div
                            class='nav-tree-links --flex-column ${() => group.links.some(visible) ? '' : '--hidden'}'
                            ${{
                                onconnect: (element: HTMLElement) => {
                                    dispose = indicator(element, group.links);
                                },
                                ondisconnect: () => dispose()
                            }}
                        >
                            ${group.label && html`<div class='nav-tree-title text' style='--font-size: var(--font-size-200); --font-weight: var(--font-weight-300); padding-left: var(--size-300); padding-right: var(--size-300); text-transform: uppercase;'>${group.label}</div>`}

                            ${group.links.map((link) => html`
                                <a
                                    aria-current='${() => link.active?.() ? current : 'false'}'
                                    class='nav-tree-link link ${() => [link.active?.() ? '--active' : '', visible(link) ? '' : '--hidden'].join(' ')}'
                                    href='${link.href}'
                                    style='--border-width: var(--border-width-400); --font-size: var(--font-size-300); --padding-horizontal: var(--size-300); --padding-vertical: var(--size-100); border-left: var(--border-width) solid var(--border-color); ${() => `--font-weight: var(--font-weight-${link.active?.() ? 500 : 300});`}'
                                    ${{ onclick: (event: Event) => link.onclick?.(event) }}
                                >${link.label}</a>
                            `)}

                            <span aria-hidden='true' class='nav-tree-indicator'></span>
                        </div>
                    `;
                })}
            </div>
        `)}
    </nav>
`;


export { navTree, scrollSpy };
export type { TreeLink, TreeSection };
