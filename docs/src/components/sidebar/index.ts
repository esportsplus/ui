import { nav, search } from '@esportsplus/ui/components';
import { effect, html, reactive, redirect, uri } from 'docs/app';
import scrollbar from '@esportsplus/ui/modifiers/scrollbar';
import type shell from '@esportsplus/ui/components/shell';
import { repository, version } from '@esportsplus/ui/package.json';
import { sections } from 'docs/data/nav';
import type { Request } from 'docs/app';
import type { On } from '@esportsplus/template';
import 'docs/components/sidebar/scss/index.scss';


const SEPARATOR = /[\s_-]+/g;


let release = version.split('.').slice(0, 2).join('.');


// Case, dashes and spaces fold away, so 'color picker' finds 'color-picker'.
function fold(text: string) {
    return text.toLowerCase().replace(SEPARATOR, ' ').trim();
}


// The documentation navigation, as the layout's static left sidebar. Its search filters the tree in place: a link shows
// when its label matches, every link of a section whose name matches shows, and a section left with none hides.
export default (request: Request, layout: ReturnType<typeof shell.state>) => {
    let field: HTMLInputElement | undefined,
        filter = reactive({ query: '' }),
        navigation = sections(),
        routes = new Set(navigation.flatMap((section) => section.links.map(key)));

    // Links match by route, so any URL their route accepts marks them; a section title matches its own path.
    function current() {
        let route = `${request.data.route?.name}:${request.data.parameters?.slug ?? ''}`;

        return routes.has(route) ? route : request.path;
    }

    function first() {
        for (let section of navigation) {
            for (let link of section.links) {
                if (shown(section.label, link.label)) {
                    return link;
                }
            }
        }
    }

    function key(link: { name: string; slug: string }) {
        return `${link.name}:${link.slug}`;
    }

    // Enter opens the first match; Escape clears the query, then leaves the field.
    function keydown(e: KeyboardEvent) {
        if (e.key === 'Enter') {
            let link = first();

            e.preventDefault();

            if (link) {
                redirect(link.name, { slug: link.slug });
            }

            return;
        }

        if (e.key !== 'Escape') {
            return;
        }

        // Kept from the layout, which would close the static sidebar on Escape.
        e.preventDefault();
        e.stopPropagation();

        if (filter.query) {
            filter.query = '';
        }
        else {
            field?.blur();
        }
    }

    // Mod+K reaches the field from anywhere, opening the sidebar first when it's closed.
    function shortcut(e: KeyboardEvent) {
        if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 'k') {
            return;
        }

        e.preventDefault();
        layout.toggle('left', true);
        field?.focus();
        field?.select();
    }

    function shown(section: string, label: string) {
        let query = fold(filter.query);

        return !query || fold(section).includes(query) || fold(label).includes(query);
    }

    return html`
        <div class='sidebar'>
            <div
                class='sidebar-header'
                ${{
                    onconnect: () => {
                        effect(() => request.path, (path, previous) => {
                            if (previous !== undefined && path !== previous && matchMedia('(max-width: 1024px)').matches) {
                                layout.toggle('left', false);
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
                ${search.input({
                    'aria-controls': 'docs-navigation-tree',
                    class: 'input--border',
                    kbd: ['Mod', 'K'],
                    onconnect: (element: HTMLInputElement, on: On) => {
                        field = element;
                        on(document, 'keydown', shortcut);
                    },
                    oninput: (e: Event) => {
                        filter.query = (e.currentTarget as HTMLInputElement).value;
                    },
                    onkeydown: keydown,
                    placeholder: 'Search documentation…',
                    value: () => filter.query
                })}
            </div>

            <div class='sidebar-scrollport' ${scrollbar({ fade: true, hidden: true })}>
                <div class='sidebar-content'>
                    ${nav.tree({
                        active: current,
                        id: 'docs-navigation-tree',
                        sections: navigation.map((section) => ({
                            label: section.label,
                            href: section.index ? section.href : undefined,
                            groups: [{
                                links: section.links.map((link) => ({
                                    label: link.label,
                                    href: link.href,
                                    key: key(link),
                                    visible: () => shown(section.label, link.label)
                                }))
                            }]
                        })),
                        [nav.tree.highlight]: true
                    })}

                    ${() => !first() && html`<p class='sidebar-empty'>No pages match “${filter.query}”.</p>`}
                </div>
            </div>
        </div>
    `;
};
