import { html } from 'docs/app';
import type { TreeLink } from 'docs/components/nav/tree';
import 'docs/components/nav/tree/scss/index.scss';
import 'docs/components/nav/page/scss/index.scss';


const pageNavTree = (links: TreeLink[]) => links.length > 0 && html`
    <nav aria-label='On this page' class='nav-tree nav-page-tree --flex-column'>
        <div class='nav-tree-group --flex-column'>
            <div class='nav-tree-title text'>On This Page</div>

            <div class='nav-tree-links --flex-column'>
                ${links.map((link) => html`
                    <a
                        aria-current='${() => link.active?.() ? 'location' : 'false'}'
                        class='nav-tree-link link --text-truncate ${() => link.active?.() && '--active'}'
                        href='${link.href}'
                        ${{
                            onclick: (event: Event) => link.onclick?.(event)
                        }}
                    >${link.label}</a>
                `)}
            </div>
        </div>
    </nav>
`;


export { pageNavTree };
