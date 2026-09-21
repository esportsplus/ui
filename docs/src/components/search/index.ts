import icon from '~/components/icon';
import searchSvg from '~/storage/svg/search.svg';
import { html, reactive } from '../../app';
import { command } from '../command';
import { sections } from '../../data/nav';
import './scss/index.scss';


const search = reactive({ open: false, query: '' });

const links = () => sections().flatMap((section) => section.groups.flatMap((group) => group.links));


const close = () => {
    search.open = false;
    search.query = '';
};

const matches = (label: string) => {
    let query = search.query.trim().toLowerCase();

    return query === '' || label.toLowerCase().includes(query);
};

document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (search.open) close();
        else search.open = true;
    }
    else if (event.key === 'Escape' && search.open) {
        close();
    }
});

const modal = () => command({ search, close, links: links() });

const searchTrigger = (placeholder = 'Search documentation…') => html`
    <button
        class='button search --border --border-border --gap-100'
        type='button'
        aria-label='Search documentation'
        aria-keyshortcuts='Control+K Meta+K' ${{ onclick: () => { search.open = true; } }}
    >
        ${icon({ class: 'icon', 'aria-hidden': 'true' }, searchSvg)}
        <span class='search-placeholder --text-truncate'>
            ${placeholder}
        </span>
        <kbd aria-hidden='true'>Ctrl K</kbd>
    </button>
`;

export { close, matches, modal, search, searchTrigger };
