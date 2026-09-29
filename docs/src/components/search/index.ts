import icon from '~/components/icon';
import searchSvg from '@esportsplus/ui/svg/search.svg';
import { command } from '@esportsplus/ui';
import { mac } from '~/lib/platform';
import { html, reactive, redirect } from '../../app';
import { sections } from '../../data/nav';
import type { Tab } from '~/components/command';
import './scss/index.scss';


const search = reactive({ active: false, index: 0, query: '', tab: 'all' as Tab });


// The palette keeps its query after closing, so the sidebar only filters while it is open.
const matches = (label: string) => {
    let query = search.query.trim().toLowerCase();

    return !search.active || query === '' || label.toLowerCase().includes(query);
};

// The palette handles Cmd/Ctrl+K itself; the sidebar and header open it through `searchTrigger` instead of its own button.
const modal = () => {
    let links = new Map(sections().flatMap((section) => section.groups.flatMap((group) => group.links.map((link) => [link.href, link] as const))));

    return command({
        [command.dialog]: { class: 'overlay--blur' },
        [command.trigger]: { hidden: true },
        commands: sections().flatMap((section) => section.groups.flatMap((group) => group.links.map(({ href, label }) => ({ group: section.label, id: href, label })))),
        onrun: (entry) => {
            let link = links.get(entry.id);

            if (link) {
                redirect(link.name, { slug: link.slug });
            }
        },
        placeholder: 'Search documentation…',
        state: search
    });
};

const searchTrigger = (placeholder = 'Search documentation…') => html`
    <button
        aria-keyshortcuts='${mac() ? 'Meta+K' : 'Control+K'}'
        aria-label='Search documentation'
        class='button command-trigger search'
        type='button'
        ${{
            onclick: () => {
                search.active = true;
            }
        }}
    >
        ${icon({ 'aria-hidden': 'true' }, searchSvg)}
        <span class='command-trigger-label'>${placeholder}</span>
        <span aria-hidden='true' class='command-keys'>
            <kbd class='button button--kbd'>${mac() ? '⌘' : 'Ctrl'}</kbd>
            <kbd class='button button--kbd'>K</kbd>
        </span>
    </button>
`;

export { matches, modal, search, searchTrigger };
