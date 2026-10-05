import { effect, onCleanup, read, signal, write, type Signal } from '@esportsplus/reactivity';
import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import highlight from '~/components/highlight';


type A = Attributes & {
    // The key of the active link or section title; each matches through its own `key`, which defaults to its `href`.
    active?: () => string | undefined;
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


// Called on connect, whose root owns the effect and the pending frame.
function indicator(element: HTMLElement, links: TreeLink[], selected: Signal<string | undefined>) {
    let bar = element.querySelector<HTMLElement>(':scope > .nav-tree-indicator'),
        frame = 0;

    if (!bar) {
        return;
    }

    effect(() => {
        let index = -1,
            key = read(selected);

        for (let i = 0, n = links.length; i < n; i++) {
            if (visible(links[i]) && keyOf(links[i]) === key) {
                index = i;
                break;
            }
        }

        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
            let anchor = element.querySelectorAll<HTMLElement>(':scope > .nav-tree-link')[index];

            if (!bar) {
                return;
            }

            if (!anchor) {
                bar.classList.remove('--active');
                return;
            }

            bar.style.height = `${anchor.offsetHeight}px`;
            bar.style.transform = `translateY(${anchor.offsetTop}px)`;

            bar.classList.add('--active');
        });
    });

    onCleanup(() => cancelAnimationFrame(frame));
}

function keyOf(item: TreeLink | TreeSection) {
    return item.key ?? item.href;
}

function visible(link: TreeLink) {
    return link.visible?.() ?? true;
}


export default component<A>(({ active, current = 'page', sections, ...attributes }) => {
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
            class='nav-tree ${current !== 'location' && 'nav-tree--highlight'} ${current === 'command' && 'nav-tree--command'}'
            ${current === 'command' && { role: 'presentation' }}
            ${attributes}
        >
            ${current !== 'location' && highlight({ class: 'nav-tree-highlight', hover: current !== 'command', target: '.nav-tree-link:not(.--hidden)' })}
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
                            <div
                                class='nav-tree-links ${group.links.some((link) => link.visible) && (() => !group.links.some(visible) && '--hidden')}'
                                ${{
                                    onconnect: (element: HTMLElement) => {
                                        if (active && current === 'location') {
                                            indicator(element, group.links, selected);
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

                                ${current === 'location' && html`<span aria-hidden='true' class='nav-tree-indicator'></span>`}
                            </div>
                        `;
                    })}
                </div>
            `)}
        </nav>
    `;
});

export type { Current, TreeGroup, TreeLink, TreeSection };
