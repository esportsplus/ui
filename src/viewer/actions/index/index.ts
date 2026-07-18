import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { sidebar } from '@esportsplus/ui';
import { entries } from '~/viewer/components';
import category from './category';
import './scss/index.scss';


let observer: IntersectionObserver | null = null,
    state = reactive({ active: entries.length ? entries[0].name : '' });


function scroll(name: string) {
    document.getElementById('viewer-' + name)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function scrollspy(main: HTMLElement) {
    let container = main.closest('.scrollbar-container-content'),
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

        for (let i = 0, n = entries.length; i < n; i++) {
            if (intersecting.has(entries[i].name)) {
                state.active = entries[i].name;
                break;
            }
        }
    }, {
        root: container,
        rootMargin: '0px 0px -75% 0px'
    });

    for (let i = 0, n = sections.length; i < n; i++) {
        observer.observe(sections[i]);
    }
}


export default html`
    ${sidebar(
        { class: 'sidebar--floating sidebar--w --active' },
        entries.map((entry) => html`
            <div
                class='link ${() => state.active === entry.name && '--active'}'
                onclick='${() => scroll(entry.name)}'
            >
                ${entry.name}
            </div>
        `)
    )}
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
        ${category(entries)}
    </main>
`;
