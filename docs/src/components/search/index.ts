import { command } from '@esportsplus/ui/components';
import { mac } from '@esportsplus/ui/shared/platform';
import { html, reactive, redirect } from 'docs/app';
import { sections } from 'docs/data/nav';
import { navTree } from 'docs/components/nav/tree';
import type { Tab } from '@esportsplus/ui/components/command';
import icon from '@esportsplus/ui/components/icon';
import svg from '@esportsplus/ui/svg/search.svg';
import 'docs/components/search/scss/index.scss';


const search = reactive({ active: false, index: 0, query: '', tab: 'all' as Tab });


// The palette handles Cmd/Ctrl+K itself; the sidebar opens it through `searchTrigger` instead of its own button.
const modal = () => {
    let navigation = sections(),
        links = new Map(navigation.flatMap((section) => section.links.map((link) => [link.href, link] as const)));

    return command({
        [command.dialog]: { class: 'overlay--blur docs-search' },
        [command.trigger]: { hidden: true },
        commands: navigation.flatMap((section) => section.links.map(({ href, label }) => ({ group: section.label, id: href, label }))),
        onrun: (entry) => {
            let link = links.get(entry.id);

            if (link) {
                redirect(link.name, { slug: link.slug });
            }
        },
        placeholder: 'Search documentation…',
        render: (groups) => navTree(groups.map((group) => ({
            label: group.label,
            groups: [{
                links: group.items.map((item) => ({
                    attributes: item.attributes,
                    content: item.content,
                    href: item.id,
                    label: item.label
                }))
            }]
        })), 'command'),
        state: search
    });
};

const trigger = () => html`
    <button
        aria-keyshortcuts='${mac() ? 'Meta+K' : 'Control+K'}'
        aria-label='Search'
        aria-haspopup='dialog'
        class='button button--tactile command-trigger sidebar-search'
        title='Search (${mac() ? '⌘' : 'Ctrl+'}K)'
        type='button'
        ${{
            onclick: () => {
                search.active = true;
            }
        }}
    >
        ${icon({ 'aria-hidden': 'true' }, svg)}
        <span class='command-trigger-label'>Search</span>
        <span aria-hidden='true' class='command-keys'>
            <kbd class='button button--kbd'>${mac() ? '⌘' : 'Ctrl'}</kbd>
            <kbd class='button button--kbd'>K</kbd>
        </span>
    </button>
`;

export { modal, search, trigger };
