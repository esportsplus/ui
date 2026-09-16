import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { meta, order } from '~/viewer/meta';
import { entries } from './components';
import entry from './entry';
import palette from './palette';
import './scss/index.scss';


let observer: IntersectionObserver | null = null,
    state = reactive({ active: entries.length ? entries[0].name : '', query: '' });


const groups = order
    .map((name) => ({
        entries: entries.filter((item) => meta[item.name]?.category === name),
        name
    }))
    .filter((group) => group.entries.length > 0);


function matches(item: { name: string }) {
    let query = state.query.trim().toLowerCase();

    if (!query) {
        return true;
    }

    let description = meta[item.name]?.description.toLowerCase() ?? '';

    return item.name.includes(query) || description.includes(query);
}

function linkClasses(active: boolean, visible: boolean) {
    let classes: string[] = [];

    if (active) {
        classes.push('--active');
    }

    if (!visible) {
        classes.push('--hidden');
    }

    return classes.join(' ');
}

function scrollspy(main: HTMLElement) {
    let container = main.closest('.--scrollbar'),
        intersecting = new Set<string>(),
        sections = main.querySelectorAll<HTMLElement>('.viewer-entry');

    observer?.disconnect();

    observer = new IntersectionObserver((records) => {
        for (let i = 0, n = records.length; i < n; i++) {
            let name = (records[i].target as HTMLElement).dataset.name;

            if (name === undefined) {
                continue;
            }

            if (records[i].isIntersecting) {
                intersecting.add(name);
            }
            else {
                intersecting.delete(name);
            }
        }

        let active = '';

        for (let i = 0, n = entries.length; i < n; i++) {
            if (intersecting.has(entries[i].name)) {
                active = entries[i].name;
                break;
            }
        }

        state.active = active;
    }, {
        root: container,
        rootMargin: '0px 0px -75% 0px'
    });

    for (let i = 0, n = sections.length; i < n; i++) {
        observer.observe(sections[i]);
    }
}


const header = html`
    <header class='viewer-header'>
        <div class='viewer-header-inner'>
            <a class='viewer-brand' href='#viewer-top'>
                <span class='viewer-brand-mark'>&lt;/&gt;</span>
                <span class='viewer-brand-name'>esportsplus<span class='viewer-brand-slash'>/</span>ui</span>
            </a>

            <nav class='viewer-header-nav'>
                <a class='viewer-header-link --active' href='#viewer-top'>Components</a>
                <a class='viewer-header-link' href='https://github.com/esportsplus/ui#readme' rel='noreferrer' target='_blank'>Docs</a>
            </nav>

            <div class='viewer-header-actions'>
                <label class='viewer-search'>
                    <svg aria-hidden='true' class='viewer-search-icon' fill='none' height='14' viewBox='0 0 24 24' width='14'>
                        <circle cx='11' cy='11' r='7' stroke='currentColor' stroke-width='2'></circle>
                        <path d='m20 20-3.5-3.5' stroke='currentColor' stroke-linecap='round' stroke-width='2'></path>
                    </svg>

                    <input
                        class='viewer-search-input'
                        placeholder='Search components…'
                        type='search'
                        ${{ oninput: (e) => { state.query = (e.target as HTMLInputElement).value; } }}
                    />
                </label>

                ${palette}

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

const nav = html`
    <aside class='viewer-nav'>
        <div class='viewer-nav-inner'>
            <a class='viewer-nav-link ${() => state.active === '' && '--active'}' href='#viewer-top'>Overview</a>

            ${groups.map((group) => html`
                <div class='viewer-nav-group ${() => group.entries.some((item) => matches(item)) ? '' : '--hidden'}'>
                    <div class='viewer-nav-heading'>${group.name}</div>

                    ${group.entries.map((item) => html`
                        <a
                            class='viewer-nav-link ${() => linkClasses(state.active === item.name, matches(item))}'
                            href='#viewer-${item.name}'
                        >${item.name}</a>
                    `)}
                </div>
            `)}
        </div>
    </aside>
`;

const toc = html`
    <aside class='viewer-toc'>
        <div class='viewer-toc-inner'>
            <div class='viewer-toc-heading'>On This Page</div>

            ${groups.map((group) => html`
                <div class='viewer-toc-group ${() => group.entries.some((item) => matches(item)) ? '' : '--hidden'}'>
                    <div class='viewer-toc-category'>${group.name}</div>

                    ${group.entries.map((item) => html`
                        <a
                            class='viewer-toc-link ${() => linkClasses(state.active === item.name, matches(item))}'
                            href='#viewer-${item.name}'
                        >${item.name}</a>
                    `)}
                </div>
            `)}
        </div>
    </aside>
`;

const main = html`
    <main
        class='viewer-main'
        ${{
            onconnect: (element: HTMLElement) => scrollspy(element),
            ondisconnect: () => {
                observer?.disconnect();
                observer = null;
            }
        }}
    >
        <div class='viewer-hero' id='viewer-top'>
            <div class='viewer-eyebrow'>Component Library</div>
            <h1 class='viewer-title'>Components</h1>
            <p class='viewer-lede'>A reactive, themeable component library built on compile-time template transforms. Browse each component and its variants below.</p>
        </div>

        ${groups.map((group) => html`
            <section class='viewer-group ${() => group.entries.some((item) => matches(item)) ? '' : '--hidden'}'>
                <div class='viewer-group-header'>
                    <span class='viewer-group-eyebrow'>${group.name}</span>
                </div>

                ${group.entries.map((item) => entry(item))}
            </section>
        `)}

        <div class='viewer-empty ${() => entries.some((item) => matches(item)) ? '--hidden' : ''}'>
            <div class='viewer-empty-title'>No components found</div>
            <div class='viewer-empty-text'>Try a different search term.</div>
        </div>
    </main>
`;


export default html`
    ${header}
    <div class='viewer-body'>
        ${nav}
        ${main}
        ${toc}
    </div>
`;
