import { href, html, reactive } from '~/viewer/app';
import { overlay } from '@esportsplus/ui';
import { sections } from '~/viewer/data/nav';
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

const modal = () => overlay(
    {
        class: '--glass',
        onclick: close,
        style: 'background: color-mix(in oklab, var(--background) 45%, transparent); z-index: 50;'
    },
    html`
        <div class='modal --active command' ${{ onclick: (e: MouseEvent) => e.stopPropagation() }}>
            <label class='command-search'>
                <svg aria-hidden='true' class='command-icon' fill='none' height='16' viewBox='0 0 24 24' width='16'>
                    <circle cx='11' cy='11' r='7' stroke='currentColor' stroke-width='2'></circle>
                    <path d='m20 20-3.5-3.5' stroke='currentColor' stroke-linecap='round' stroke-width='2'></path>
                </svg>

                <input
                    autofocus
                    class='command-input'
                    placeholder='Search documentation…'
                    type='search'
                    ${{ oninput: (e: Event) => { search.query = (e.target as HTMLInputElement).value; }, onkeydown: (e: KeyboardEvent) => { if (e.key === 'Escape') { close(); } } }}
                />
            </label>

            <div class='command-results --scrollbar'>
                <div class='command-heading'>Pages</div>

                ${() => {
                    let results = links.filter((link) => matches(link.label));

                    if (results.length === 0) {
                        return html`<div class='command-empty'>No results found</div>`;
                    }

                    return results.map((link) => html`
                        <a
                            class='command-item'
                            href='${href(link.section, link.slug)}'
                            ${{ onclick: close }}
                        >
                            <span class='command-item-arrow'>&rarr;</span>
                            <span class='command-item-label'>${link.label}</span>
                        </a>
                    `);
                }}
            </div>

            <div class='command-footer'>Go to Page</div>
        </div>
    `
);


export { close, matches, modal, search };
