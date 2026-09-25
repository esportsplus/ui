import icon from '~/components/icon';
import searchSvg from '~/storage/svg/search.svg';
import { command } from '@esportsplus/ui';
import { html, reactive } from '../../app';
import { sections } from '../../data/nav';
import './scss/index.scss';


const search = reactive({ active: false, query: '' });


const matches = (label: string) => {
    let query = search.query.trim().toLowerCase();

    return query === '' || label.toLowerCase().includes(query);
};

document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        search.active = !search.active;
        search.query = '';
    }
});

const modal = () => command({
    class: 'modal--scale modal--blur',
    groups: sections().map((section) => ({
        items: section.groups.flatMap((group) => group.links.map(({ href, label }) => ({ href, label }))),
        label: section.label
    })),
    placeholder: 'Search documentation…',
    state: search
});

const searchTrigger = (placeholder = 'Search documentation…') => html`
    <button
        class='button search --border-border'
        type='button'
        style='--border-width: var(--border-width-400); border: var(--border-width) solid var(--border-color); gap: var(--size-100);'
        aria-label='Search documentation'
        aria-keyshortcuts='Control+K Meta+K'
        ${{
            onclick: () => { search.active = true; }
        }}
    >
        ${icon({ class: 'icon', 'aria-hidden': 'true' }, searchSvg)}
        <span class='search-placeholder --text-truncate'>
            ${placeholder}
        </span>
        <kbd aria-hidden='true'>Ctrl K</kbd>
    </button>
`;

export { matches, modal, search, searchTrigger };
