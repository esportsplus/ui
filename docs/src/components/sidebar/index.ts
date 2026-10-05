import { nav } from '@esportsplus/ui/components';
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
        <button
            aria-controls='docs-navigation'
            aria-expanded='${() => state.active ? 'true' : 'false'}'
            aria-label='${() => state.active ? 'Close documentation navigation' : 'Open documentation navigation'}'
            class='sidebar-toggle button'
            title='${() => state.active ? 'Close documentation navigation' : 'Open documentation navigation'}'
            type='button'
            onclick='${() => state.active = !state.active}'
        >
            <span aria-hidden='true' class='icon sidebar-toggle-icon'>
                <svg class='sidebar-toggle-graphic' fill='none' focusable='false' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 16 16'>
                    <g class='sidebar-toggle-shadow'>
                        <path fill='currentColor' stroke='none' d='M3.75 2.75h2.5v10.5h-2.5a1.5 1.5 0 0 1-1.5-1.5v-7a1.5 1.5 0 0 1 1.5-1.5Z' />
                        <path d='M6.25 2.75v10.5' />
                    </g>
                    <g class='sidebar-toggle-divider'>
                        <path fill='currentColor' stroke='none' d='M3.75 2.75h2.5v10.5h-2.5a1.5 1.5 0 0 1-1.5-1.5v-7a1.5 1.5 0 0 1 1.5-1.5Z' />
                        <path d='M6.25 2.75v10.5' />
                    </g>
                    <rect x='2.25' y='2.75' width='11.5' height='10.5' rx='1.5' />
                </svg>
            </span>
        </button>

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
