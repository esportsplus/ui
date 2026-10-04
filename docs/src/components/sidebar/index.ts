import icon from '@esportsplus/ui/components/icon';
import sidebarSvg from '@esportsplus/ui/svg/sidebar.svg';
import sidebarFilledSvg from '@esportsplus/ui/svg/sidebar-filled.svg';
import { effect, html, reactive, uri } from 'docs/app';
import { repository, version } from '@esportsplus/ui/package.json';
import { sections } from 'docs/data/nav';
import { navTree } from 'docs/components/nav/tree';
import { trigger as searchTrigger } from 'docs/components/search';
import type { Request } from 'docs/app';
import 'docs/components/sidebar/scss/index.scss';


const release = version.split('.').slice(0, 2).join('.');
const state = reactive({ active: !matchMedia('(max-width: 1024px)').matches });


export default (request: Request) => {
    let disconnect = () => {};

    function close() {
        if (document.getElementById('docs-navigation')?.contains(document.activeElement)) {
            document.querySelector<HTMLButtonElement>('.sidebar-toggle')?.focus({ preventScroll: true });
        }

        state.active = false;
    };

    return html`
        <button
            aria-controls='docs-navigation'
            aria-expanded='${() => state.active ? 'true' : 'false'}'
            aria-label='${() => state.active ? 'Close documentation navigation' : 'Open documentation navigation'}'
            class='sidebar-toggle button'
            title='${() => state.active ? 'Close documentation navigation' : 'Open documentation navigation'}'
            type='button'
            onclick='${() => state.active = !state.active}'
        >
            ${() => icon({ 'aria-hidden': 'true' }, state.active ? sidebarFilledSvg : sidebarSvg)}
        </button>

        <aside
            aria-label='Documentation navigation'
            class='sidebar'
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
            <div class='sidebar-header'>
                <a class='sidebar-brand' href='${uri('docs')}' aria-label='Esportsplus UI home'>
                    esportsplus<span class='sidebar-brand-ui'> / ui</span>
                </a>
                <a
                    class='sidebar-version button button--flat button--underline'
                    href='${repository.url}'
                    rel='noopener noreferrer'
                    target='_blank'
                    title='v${version}'
                >v${release}</a>
                ${searchTrigger()}
            </div>
            <div class='sidebar-scrollport --scrollbar --scrollbar-blur --scrollbar-hidden'>
                <div class='sidebar-content'>
                    ${navTree(
                        sections().map((section) => ({
                            label: section.label,
                            href: section.index ? section.href : undefined,
                            active: () => request.path === section.href,
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
            </div>
        </aside>
    `;
};


export { state };
