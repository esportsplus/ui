import { flush, reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes } from '@esportsplus/template';
import { observeIntersection } from '~/shared/visible';
import buttons from './buttons';
import code from './code';
import header from './header';
import source from './source';
import stage from './stage';
import './scss/index.scss';


type A = Attributes & {
    // Variant ids the example answers to besides its own; a hash naming one selects it.
    anchors?: string[];
    id?: string;
    onconnect?: never;
    ondisconnect?: never;
    onfocusin?: never;
    onwindowhashchange?: never;
    selection?: { selected: string };
    // Shared with the parts that read it; without one the example renders at once and only answers its hash.
    state?: State;
};

type State = {
    mounted: boolean;
    // Bumped to ask a failed source load to try again.
    retry: number;
    view: 'code' | 'preview';
};


// A state for an example's parts, unmounted until the example nears the viewport.
const state = (): State => reactive({ mounted: false, retry: 0, view: 'preview' as State['view'] });


// The example's card. Mounts its content once near the viewport and keeps it mounted. A hash naming the example, or
// one of its anchors, reveals it: back to the preview, mounted, then scrolled to once its final box has painted.
const preview = component(
    function({ anchors = [], id, selection, state, ...attributes }: A, content) {
        let frame = 0,
            release: VoidFunction | undefined;

        function mount() {
            release?.();
            release = undefined;

            if (state) {
                state.mounted = true;
            }
        }

        function reveal(element: HTMLElement) {
            if (state) {
                state.view = 'preview';
            }

            mount();
            flush();
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                frame = 0;
                element.scrollIntoView({ behavior: 'instant', block: 'start' });
            });
        }

        function targeted() {
            let anchor = anchors.find((anchor) => location.hash === `#${anchor}`);

            if (anchor && selection) {
                selection.selected = anchor;
            }

            return !!anchor || (!!id && location.hash === `#${id}`);
        }

        return html`
            <div
                class='card preview'
                id='${id ?? ''}'
                ${attributes}
                ${{
                    onconnect: (element: HTMLElement) => {
                        if (targeted()) {
                            reveal(element);
                        }

                        if (!state || state.mounted) {
                            return;
                        }

                        if (typeof IntersectionObserver === 'undefined') {
                            mount();
                            return;
                        }

                        release = observeIntersection(element, (entries) => {
                            if (entries.some((entry) => entry.isIntersecting)) {
                                mount();
                            }
                        }, { rootMargin: '400px 0px' });
                    },
                    ondisconnect: () => {
                        cancelAnimationFrame(frame);
                        frame = 0;
                        release?.();
                        release = undefined;
                    },
                    // TOC navigation focuses the example before scrolling. Mount first so its final box is the target.
                    onfocusin: function(this: HTMLElement, event: FocusEvent) {
                        if (!state) {
                            return;
                        }

                        if (event.target === this) {
                            state.view = 'preview';
                        }

                        if (!state.mounted) {
                            mount();
                            flush();
                        }
                    },
                    onwindowhashchange: function(this: HTMLElement) {
                        if (targeted()) {
                            reveal(this);
                        }
                    }
                }}
            >
                ${anchors.filter((anchor) => anchor !== id).map((anchor) => html`
                    <span aria-hidden='true' class='preview-anchor' id='${anchor}'></span>
                `)}
                ${content}
            </div>
        `;
    }
);


// Its parts compose inside the card ('header', then 'stage', 'source' or 'code'), all sharing one 'state'. 'buttons'
// sits just outside, above the card.
export default Object.assign(preview, { buttons, code, header, source, stage, state });
export type { State };
