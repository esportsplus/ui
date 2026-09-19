import { html, reactive } from '../../app';
import { command } from '../command';
import { sections } from '../../data/nav';
import './scss/index.scss';


const search = reactive({ open: false, query: '' });

const links = sections.flatMap((section) => section.groups.flatMap((group) => group.links));


const close = () => {
    search.open = false;
    search.query = '';
};

const matches = (label: string) => {
    let query = search.query.trim().toLowerCase();

    return query === '' || label.toLowerCase().includes(query);
};

const modal = () => command({ search, close, links });

const searchTrigger = () => html`
    <button class='button search' type='button' ${{ onclick: () => { search.open = true; } }}>
        <svg aria-hidden='true' class='search-icon' fill='none' height='14' viewBox='0 0 24 24' width='14'>
            <circle cx='11' cy='11' r='7' stroke='currentColor' stroke-width='2'></circle>
            <path d='m20 20-3.5-3.5' stroke='currentColor' stroke-linecap='round' stroke-width='2'></path>
        </svg>
        <span class='search-placeholder'>Search…</span>
    </button>
`;

export { close, matches, modal, search, searchTrigger };
