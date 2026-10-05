import { component, html, type Attributes, type Renderable } from '@esportsplus/template';


type A = Attributes & {
    label?: string;
    links: TocLink[];
};

type TocLink = {
    active?: () => boolean;
    attributes?: Attributes;
    content?: Renderable<unknown>;
    href: string;
    label: string;
    onclick?: (event: Event) => void;
    visible?: () => boolean;
};


// Renders nothing without links, so a layout can collapse the column the table of contents would sit in.
export default component<A>(
    ({ label = 'On This Page', links, ...attributes }) => links.length > 0 && html`
        <nav class='nav-tree nav-tree--toc' ${{ 'aria-label': label }} ${attributes}>
            <div class='nav-tree-group'>
                <div class='nav-tree-title'>${label}</div>

                <div class='nav-tree-links'>
                    ${links.map((link) => html`
                        <a
                            aria-current='${() => link.active?.() ? 'location' : 'false'}'
                            class='nav-tree-link nav-tree-link--truncate ${() => link.active?.() && '--active'} ${() => link.visible?.() === false && '--hidden'}'
                            href='${link.href}'
                            ${{
                                onclick: (event: Event) => link.onclick?.(event)
                            }}
                            ${link.attributes}
                        >
                            ${link.content ?? link.label}
                        </a>
                    `)}
                </div>
            </div>
        </nav>
    `
);


export type { TocLink };
