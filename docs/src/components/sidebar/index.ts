import { effect, html, reactive } from 'docs/app';
import { sections } from 'docs/data/nav';
import { navTree } from 'docs/components/nav/tree';
import type { Request } from 'docs/app';
import 'docs/components/sidebar/scss/index.scss';


const state = reactive({ active: !matchMedia('(max-width: 1024px)').matches });


export default (request: Request) => {
    let disconnect = () => {};

    function close() {
        if (document.getElementById('docs-navigation')?.contains(document.activeElement)) {
            document.querySelector<HTMLButtonElement>('.header-sidebar')?.focus({ preventScroll: true });
        }

        state.active = false;
    };

    return html`
        <aside
            aria-label='Documentation navigation'
            class='sidebar --scrollbar --scrollbar-blur --scrollbar-no-arrows'
            id='docs-navigation'
            ${{
                inert: () => !state.active,
                onconnect: () => {
                    disconnect = effect(() => request.path, (path, previous) => {
                        if (previous !== undefined && path !== previous && matchMedia('(max-width: 1024px)').matches) {
                            close();
                        }
                    });
                },
                ondisconnect: () => disconnect(),
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
                        groups: section.groups.map((group) => ({
                            label: group.label,
                            links: group.links.map((link) => ({
                                label: link.label,
                                href: link.href,
                                active: () => request.data.route?.name === link.name && (request.data.parameters?.slug ?? '') === link.slug
                            }))
                        }))
                    }))
                )}
            </div>
        </aside>
    `;
};


export { state };
