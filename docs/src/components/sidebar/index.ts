import { nav } from '@esportsplus/ui/components';
import { effect, html, reactive, uri } from 'docs/app';
import scrollbar from '@esportsplus/ui/modifiers/scrollbar';
import shell from '@esportsplus/ui/components/shell';
import { repository, version } from '@esportsplus/ui/package.json';
import { sections } from 'docs/data/nav';
import { trigger as searchTrigger } from 'docs/components/search';
import type { Request } from 'docs/app';
import 'docs/components/sidebar/scss/index.scss';


let release = version.split('.').slice(0, 2).join('.'),
    side = {
        class: 'sidebar',
        id: 'docs-navigation',
        label: 'Documentation navigation',
        state: reactive({ active: !matchMedia('(max-width: 1024px)').matches })
    };


// The documentation navigation, as the shell's left sidebar.
export default (request: Request) => {
    let navigation = sections(),
        routes = new Set(navigation.flatMap((section) => section.links.map(key)));

    // Links match by route, so any URL their route accepts marks them; a section title matches its own path.
    function current() {
        let route = `${request.data.route?.name}:${request.data.parameters?.slug ?? ''}`;

        return routes.has(route) ? route : request.path;
    }

    function key(link: { name: string; slug: string }) {
        return `${link.name}:${link.slug}`;
    }

    return {
        ...side,
        content: html`
            <div
                class='sidebar-header'
                ${{
                    onconnect: () => {
                        effect(() => request.path, (path, previous) => {
                            if (previous !== undefined && path !== previous && matchMedia('(max-width: 1024px)').matches) {
                                shell.close(side);
                            }
                        });
                    }
                }}
            >
                <a class='sidebar-brand' href='${uri('installation')}' aria-label='Esportsplus UI home'>
                    esportsplus<span class='sidebar-brand-ui'> / ui</span>
                </a>
                <a
                    class='sidebar-version button'
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

            <div class='sidebar-scrollport' ${scrollbar({ fade: true, hidden: true })}>
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
                        })),
                        [nav.tree.highlight]: {}
                    })}
                </div>
            </div>
        `
    };
};
