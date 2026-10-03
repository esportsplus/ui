import { html, reactive } from '~/app';
import { sections } from '~/data/nav';
import { navTree } from '~/docs-components/nav/tree';
import { matches } from '~/docs-components/search';
import type { Request } from '~/app';
import '~/docs-components/sidebar/scss/index.scss';


// Start docked on wide screens; resizing preserves the user's toggle.
const state = reactive({ active: matchMedia('(min-width: 1025px)').matches });


export default (request: Request) => {
    const close = () => {
        if (document.getElementById('docs-navigation')?.contains(document.activeElement)) {
            document.querySelector<HTMLButtonElement>('.header-sidebar')?.focus({ preventScroll: true });
        }

        state.active = false;
    };

    const navigate = (event: Event) => {
        let click = event as MouseEvent;

        if (matchMedia('(max-width: 1024px)').matches && click.button === 0 && !click.ctrlKey && !click.metaKey && !click.shiftKey && !click.altKey) {
            close();
        }
    };

    return html`
        <aside
            aria-label='Documentation navigation'
            class='sidebar --scrollbar --scrollbar-blur --scrollbar-no-arrows'
            id='docs-navigation'
            ${{
                inert: () => !state.active,
                onkeydown: (event: KeyboardEvent) => {
                    if (event.key === 'Escape' && !event.defaultPrevented) {
                        event.preventDefault();
                        close();
                    }
                }
            }}
        >
            <div class='sidebar-content'>
                ${navTree(
                    sections().map((section) => ({
                        label: section.label,
                        href: section.index ? section.href : undefined,
                        onclick: navigate,
                        groups: section.groups.map((group) => ({
                            label: group.label,
                            links: group.links.map((link) => ({
                                label: link.label,
                                href: link.href,
                                active: () => request.data.route?.name === link.name && (request.data.parameters?.slug ?? '') === link.slug,
                                onclick: navigate,
                                visible: () => matches(link.label)
                            }))
                        }))
                    }))
                )}
            </div>
        </aside>
    `;
};


export { state };
