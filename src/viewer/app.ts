import { effect } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import header from './header';
import components from './pages/components';
import cssUtilities from './pages/css-utilities';
import docs from './pages/docs';
import fonts from './pages/fonts';
import themes from './pages/themes';
import tokens from './pages/tokens';
import { state } from './router';
import sidebar from './sidebar';
import './scss/index.scss';
import type { Page } from './types';


const routes: Record<string, (slug: string) => Page> = {
    components,
    'css-utilities': cssUtilities,
    docs,
    fonts,
    themes,
    tokens
};


const resolve = (): Page => (routes[state.section] ?? docs)(state.slug);

const scrollTo = (id: string) => (e: Event) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};


effect(() => {
    state.section;
    state.slug;

    requestAnimationFrame(() => {
        let element = document.querySelector('.site');

        if (element) {
            element.scrollTop = 0;
        }
    });
});


export default html`
    ${header}

    <div class='viewer-body'>
        ${sidebar}

        <main class='viewer-main'>
            ${() => resolve().render()}
        </main>

        <aside class='viewer-toc --scrollbar'>
            <div class='viewer-toc-inner ${() => resolve().toc.length === 0 ? '--hidden' : ''}'>
                <div class='viewer-toc-heading'>On This Page</div>

                ${() => resolve().toc.map((item) => html`
                    <a class='viewer-toc-link' href='#' ${{ onclick: scrollTo(item.id) }}>${item.label}</a>
                `)}
            </div>
        </aside>
    </div>
`;
