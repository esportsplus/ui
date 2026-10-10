import { button, nav } from '@esportsplus/ui/components';
import { effect, html, reactive, uri } from 'docs/app';
import { repository, version } from '@esportsplus/ui/package.json';
import { sections } from 'docs/data/nav';
import { trigger as searchTrigger } from 'docs/components/search';
import type { Request } from 'docs/app';
import 'docs/components/sidebar/scss/index.scss';


const release = version.split('.').slice(0, 2).join('.');

const state = reactive({ active: !matchMedia('(max-width: 1024px)').matches });


export default (request: Request) => {
    let navigation = sections(),
        routes = new Set(navigation.flatMap((section) => section.links.map(key)));

    function close() {
        if (document.getElementById('docs-navigation')?.contains(document.activeElement)) {
            document.querySelector<HTMLButtonElement>('.sidebar-toggle')?.focus({ preventScroll: true });
        }

        state.active = false;
    };

    // Links match by route, so any URL their route accepts marks them; a section title matches its own path.
    function current() {
        let route = `${request.data.route?.name}:${request.data.parameters?.slug ?? ''}`;

        return routes.has(route) ? route : request.path;
    }

    function key(link: { name: string; slug: string }) {
        return `${link.name}:${link.slug}`;
    }

    return html`
        ${button.sidebar({
            'aria-controls': 'docs-navigation',
            'aria-label': () => state.active ? 'Close documentation navigation' : 'Open documentation navigation',
            class: 'sidebar-toggle',
            onclick: () => state.active = !state.active,
            open: () => state.active,
            title: () => state.active ? 'Close documentation navigation' : 'Open documentation navigation'
        })}

        <aside
            aria-label='Documentation navigation'
            class='sidebar ${() => state.active && '--active'}'
            id='docs-navigation'
            ${{
                inert: () => !state.active,
                onconnect: () => {
                    effect(() => request.path, (path, previous) => {
                        if (previous !== undefined && path !== previous && matchMedia('(max-width: 1024px)').matches) {
                            close();
                        }
                    });
                },
                onkeydown: (event: KeyboardEvent) => {
                    if (event.key === 'Escape' && !event.defaultPrevented) {
                        event.preventDefault();
                        close();
                    }
                }
            }}
        >
            <div class='sidebar-header'>
                <a class='sidebar-brand' href='${uri('installation')}' aria-label='Esportsplus UI home'>
                    esportsplus<span class='sidebar-brand-ui'> / ui</span>
                </a>
                <a
                    class='sidebar-version button button--underline'
                    href='${repository.url}'
                    rel='noopener noreferrer'
                    target='_blank'
                    title='v${version}'
                >
                    v${release}
                </a>
            </div>

            <div class='sidebar-tools'>
                ${searchTrigger()}
            </div>

            <div class='sidebar-scrollport --scrollbar --scrollbar-fade --scrollbar-hidden'>
                <div class='sidebar-content'>
                    ${nav.tree({
                        active: current,
                        sections: navigation.map((section) => ({
                            label: section.label,
                            href: section.index ? section.href : undefined,
                            groups: [{
                                links: section.links.map((link) => ({
                                    label: link.label,
                                    href: link.href,
                                    key: key(link)
                                }))
                            }]
                        }))
                    })}
                </div>
            </div>
        </aside>
    `;
};


export { state };
