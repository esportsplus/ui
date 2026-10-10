import { reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import scrollbar from '~/modifiers/scrollbar';
import '~/components/card/scss/index.scss';
import './scss/index.scss';


// Past the midpoint the sides swap which one is inert, so the faded one can't be focused, clicked or read twice.
const SWAP = 0.5;


let uid = 0;


// Engines without scroll-driven animations get the progress and the swap from scroll events instead of the timeline.
function fallback(fade: ReturnType<typeof scrollbar.fade>) {
    let range = 0,
        state = reactive({ progress: 0 });

    return {
        after: { inert: () => state.progress < SWAP },
        before: { inert: () => state.progress >= SWAP },
        root: {
            onconnect: (element: HTMLElement) => {
                range = parseFloat(getComputedStyle(element).getPropertyValue('--sticky-header-range'));
            },
            style: () => `--sticky-header-progress: ${state.progress}`
        },
        scroll: {
            ...fade,
            onscroll: function(this: HTMLElement) {
                fade.onscroll?.call(this);
                state.progress = Math.min(1, this.scrollTop / range);
            }
        }
    };
}


export default component<Attributes & {
    after: Renderable<unknown>;
    before: Renderable<unknown>;
}>(
    function({ after, before, ...attributes }, content) {
        let fade = scrollbar.fade(),
            id = `sticky-header-${++uid}`,
            legacy = typeof CSS === 'undefined' || CSS.supports('timeline-scope: none') ? null : fallback(fade);

        return html`
            <div class='card sticky-header' ${attributes} ${legacy?.root}>
                <div
                    aria-labelledby='${id}'
                    class='sticky-header-scroll --scrollbar'
                    role='region'
                    tabindex='0'
                    ${legacy?.scroll ?? fade}
                >
                    <div aria-hidden='true' class='sticky-header-spacer'></div>
                    ${content}
                </div>

                <header class='sticky-header-bar'>
                    <div aria-hidden='true' class='sticky-header-plate'></div>
                    <div aria-hidden='true' class='sticky-header-edge sticky-header-edge--shadow'></div>
                    <div aria-hidden='true' class='sticky-header-edge sticky-header-edge--fade'></div>
                    <div aria-hidden='true' class='sticky-header-edge sticky-header-edge--line'></div>

                    <div class='sticky-header-before' id='${id}' ${legacy?.before}>
                        ${before}
                    </div>
                    <div class='sticky-header-after' ${legacy?.after}>
                        ${after}
                    </div>
                </header>
            </div>
        `;
    }
);
