import icon from '~/components/icon';
import searchSvg from '~/storage/svg/search.svg';
import { html } from '../../app';
import { input, overlay } from '@esportsplus/ui';
import './scss/index.scss';


type Options = {
    search: { query: string };
    close: () => void;
    links: { label: string; href: string }[];
};
const field = input.bind({});


const command = ({ search, close, links }: Options) => overlay(
    {
        class: '--glass',
        onclick: close,
        style: 'background: color-mix(in oklab, var(--background) 45%, transparent); z-index: 50;'
    },
    html`
        <div class='modal card --active command' ${{ onclick: (e: MouseEvent) => e.stopPropagation() }}>
            <label class='command-search'>
                ${icon({ class: 'command-icon', 'aria-hidden': 'true', style: '--size: var(--size-400);' }, searchSvg)}

                ${field({
                    autofocus: true,
                    'aria-label': 'Search documentation',
                    class: 'command-input',
                    placeholder: 'Search documentation…',
                    type: 'search',
                    oninput: (event: Event) => { search.query = (event.target as HTMLInputElement).value; },
                    onkeydown: (event: KeyboardEvent) => { if (event.key === 'Escape') close(); }
                })}
            </label>

            <div class='command-results --scrollbar'>
                <div class='command-heading'>Pages</div>

                ${() => {
                    let results = links.filter((link) => link.label.toLowerCase().includes(search.query.trim().toLowerCase()));

                    if (results.length === 0) {
                        return html`<div class='command-empty'>No results found</div>`;
                    }

                    return results.map((link) => html`
                        <a
                            class='button command-item'
                            href='${link.href}'
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


export { command };
