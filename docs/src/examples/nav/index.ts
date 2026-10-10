import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { nav } from '@esportsplus/ui/components';
import type { Current, Indicator } from '@esportsplus/ui/components/nav';
import type { Entry } from 'docs/types';
import 'docs/examples/nav/scss/index.scss';


const SECTIONS = [
    { label: 'Getting started', links: ['Installation', 'Tokens', 'Themes'] },
    { label: 'Components', links: ['Button', 'Input', 'Select', 'Tooltip'] }
];

const TOPICS = ['Overview', 'Install', 'Usage', 'Theming', 'Accessibility', 'API'];


let uid = 0;


// The demo scrolls its own box; 'spy.navigate' brings the section into view with 'scrollIntoView', which would also
// scroll the docs page around it.
function spied(mode?: 'current' | 'visible') {
    let id = `nav-demo-${++uid}`,
        ids = TOPICS.map((_, index) => `${id}-${index}`),
        disconnect = () => {},
        scroller: HTMLElement | undefined,
        spy = nav.spy(ids, mode);

    function go(index: number) {
        let section = document.getElementById(ids[index]);

        if (!scroller || !section) {
            return;
        }

        scroller.scrollTo({
            behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
            top: section.offsetTop - scroller.offsetTop
        });
    }

    return html`
        <div
            class='nav-demo-spy'
            ${{
                onconnect: () => {
                    disconnect = spy.connect();
                },
                ondisconnect: () => disconnect()
            }}
        >
            <div class='nav-demo-scroller --scrollbar' ${{ onconnect: (element: HTMLElement) => { scroller = element; } }}>
                ${TOPICS.map((topic, index) => html`
                    <section class='nav-demo-section' id='${ids[index]}'>
                        <h3 class='nav-demo-heading'>${topic}</h3>
                        <p class='nav-demo-copy'>Scroll this panel and the table of contents follows the section in view.</p>
                    </section>
                `)}
            </div>
            ${nav.toc({
                links: TOPICS.map((label, index) => ({
                    active: () => spy.active(index),
                    href: `#${ids[index]}`,
                    label,
                    onclick: (event: Event) => {
                        event.preventDefault();
                        go(index);
                    }
                }))
            })}
        </div>
    `;
}

function tree(current: Current, indicator?: Indicator) {
    let state = reactive({ active: 'Button' });

    return html`
        <div class='nav-demo-tree'>
            ${nav.tree({
                active: () => state.active,
                current,
                indicator,
                sections: SECTIONS.map((section) => ({
                    groups: [{
                        links: section.links.map((label) => ({
                            href: '#',
                            key: label,
                            label,
                            onclick: (event: Event) => {
                                event.preventDefault();
                                state.active = label;
                            }
                        }))
                    }],
                    label: section.label
                }))
            })}
        </div>
    `;
}


export default {
    name: 'nav',
    variants: [
        {
            render: () => tree('page'),
            title: 'tree'
        },
        {
            render: () => tree('page', 'border'),
            title: 'tree · border'
        },
        {
            render: () => tree('page', 'both'),
            title: 'tree · border + background'
        },
        {
            render: () => tree('location', 'background'),
            title: 'tree: location · background'
        },
        {
            render: () => tree('location'),
            title: 'tree: location'
        },
        {
            render: () => tree('location', 'both'),
            title: 'tree: location · border + background'
        },
        {
            render: () => spied(),
            title: 'toc with spy'
        },
        {
            render: () => spied('visible'),
            title: 'toc with spy: every visible section'
        }
    ]
} satisfies Entry;
