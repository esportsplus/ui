import { effect } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import header from './header';
import { resolve, state } from './router';
import sidebar from './sidebar';
import './scss/index.scss';


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
            ${() => resolve().page.render()}
        </main>

        <aside class='viewer-toc --scrollbar'>
            <div class='viewer-toc-inner ${() => resolve().page.toc.length === 0 ? '--hidden' : ''}'>
                <div class='viewer-toc-heading'>On This Page</div>

                ${() => resolve().page.toc.map((item) => html`
                    <a class='viewer-toc-link' href='#' ${{ onclick: scrollTo(item.id) }}>${item.label}</a>
                `)}
            </div>
        </aside>
    </div>
`;
