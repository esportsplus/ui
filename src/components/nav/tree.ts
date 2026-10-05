import { effect, onCleanup } from '@esportsplus/reactivity';
import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import highlight from '~/components/highlight';


type A = Attributes & {
    // 'page' glides a highlight between links, 'command' does too for 'command' results (which own focus and
    // selection), and 'location' slides an indicator bar along the active links instead.
    current?: Current;
    sections: TreeSection[];
};

type Current = 'command' | 'location' | 'page';

type TreeGroup = {
    label?: string;
    links: TreeLink[];
};

type TreeLink = {
    active?: () => boolean;
    attributes?: Attributes;
    content?: Renderable<unknown>;
    href: string;
    label: string;
    onclick?: (event: Event) => void;
    visible?: () => boolean;
};

type TreeSection = {
    active?: () => boolean;
    groups: TreeGroup[];
    // Turns the section title into a link.
    href?: string;
    label: string;
    onclick?: (event: Event) => void;
};


// One bar spans the run of active links, so a 'visible' scroll spy marking several sections reads as one range. Called
// on connect, whose root owns the effect and the pending frame.
function indicator(element: HTMLElement, links: TreeLink[]) {
    let bar = element.querySelector<HTMLElement>(':scope > .nav-tree-indicator'),
        frame = 0;

    if (!bar) {
        return;
    }

    effect(() => {
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

    onCleanup(() => cancelAnimationFrame(frame));
}

function visible(link: TreeLink) {
    return link.visible?.() ?? true;
}


export default component<A>(
    ({ current = 'page', sections, ...attributes }) => html`
        <nav
            class='nav-tree ${current !== 'location' && 'nav-tree--highlight'} ${current === 'command' && 'nav-tree--command'}'
            ${current === 'command' && { role: 'presentation' }}
            ${attributes}
        >
            ${current !== 'location' && highlight({ class: 'nav-tree-highlight', hover: current !== 'command', target: '.nav-tree-link:not(.--hidden)' })}
            ${sections.map((section) => html`
                <div
                    class='nav-tree-group ${() => !section.groups.some((group) => group.links.some(visible)) && '--hidden'}'
                    ${current === 'command' && { 'aria-label': section.label, role: 'group' }}
                >
                    ${section.href
                        ? html`
                            <a
                                aria-current='${() => current !== 'command' && section.active?.() ? current : 'false'}'
                                class='nav-tree-link nav-tree-title ${() => section.active?.() && '--active'}'
                                href='${section.href}'
                                onclick='${(event: Event) => section.onclick?.(event)}'
                            >${section.label}</a>
                        `
                        : html`<div class='nav-tree-title'>${section.label}</div>`}

                    ${section.groups.map((group) => {
                        return html`
                            <div
                                class='nav-tree-links ${() => !group.links.some(visible) && '--hidden'}'
                                ${{
                                    onconnect: (element: HTMLElement) => {
                                        if (current === 'location') {
                                            indicator(element, group.links);
                                        }
                                    }
                                }}
                            >
                                ${group.label && html`
                                    <div class='nav-tree-title'>
                                        ${group.label}
                                    </div>
                                `}

                                ${group.links.map((link) => html`
                                    <a
                                        aria-current='${() => current !== 'command' && link.active?.() ? current : 'false'}'
                                        class='nav-tree-link ${() => link.active?.() && '--active'} ${() => !visible(link) && '--hidden'}'
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

                                ${current === 'location' && html`<span aria-hidden='true' class='nav-tree-indicator'></span>`}
                            </div>
                        `;
                    })}
                </div>
            `)}
        </nav>
    `
);


export type { Current, TreeGroup, TreeLink, TreeSection };
