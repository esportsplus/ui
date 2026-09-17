import { href, html, state } from '~/viewer/app';
import { search } from './search';


const tabs = [
    { label: 'Docs', section: 'docs' },
    { label: 'Components', section: 'components' },
    { label: 'Utilities', section: 'css-utilities' },
    { label: 'Tokens', section: 'tokens' }
];


export default html`
    <header class='viewer-header'>
        <div class='viewer-header-inner'>
            <a class='viewer-brand' href='${href('docs')}'>
                <span class='viewer-brand-mark'>&lt;/&gt;</span>
                <span class='viewer-brand-name'>esportsplus<span class='viewer-brand-slash'>/</span>ui</span>
            </a>

            <nav class='viewer-header-nav'>
                ${tabs.map((tab) => html`
                    <a
                        class='viewer-header-link ${() => state.section === tab.section && '--active'}'
                        href='${href(tab.section)}'
                    >${tab.label}</a>
                `)}
            </nav>

            <div class='viewer-header-actions'>
                <label class='viewer-search'>
                    <svg aria-hidden='true' class='viewer-search-icon' fill='none' height='14' viewBox='0 0 24 24' width='14'>
                        <circle cx='11' cy='11' r='7' stroke='currentColor' stroke-width='2'></circle>
                        <path d='m20 20-3.5-3.5' stroke='currentColor' stroke-linecap='round' stroke-width='2'></path>
                    </svg>

                    <input
                        class='viewer-search-input'
                        placeholder='Search…'
                        type='search'
                        ${{ oninput: (e: Event) => { search.query = (e.target as HTMLInputElement).value; } }}
                    />
                </label>

                <a
                    aria-label='GitHub'
                    class='viewer-header-icon'
                    href='https://github.com/esportsplus/ui'
                    rel='noreferrer'
                    target='_blank'
                >
                    <svg aria-hidden='true' fill='currentColor' height='18' viewBox='0 0 16 16' width='18'>
                        <path d='M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z'></path>
                    </svg>
                </a>
            </div>
        </div>
    </header>
`;
