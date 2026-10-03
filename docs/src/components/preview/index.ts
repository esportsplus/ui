import { html } from '~/app';
import { flush, reactive, untrack } from '@esportsplus/reactivity';
import type { Renderable } from '~/app';
import '~/docs-components/preview/scss/index.scss';


const preview = (title: string | null, node: Renderable<unknown>, id?: string) => {
    let observer: IntersectionObserver | undefined,
        frame = 0,
        render = typeof node === 'function' ? node as () => Renderable<unknown> : () => node,
        state = reactive({ mounted: typeof node !== 'function' || (!!id && location.hash === `#${id}`) });

    function mount() {
        observer?.disconnect();
        observer = undefined;
        state.mounted = true;
    }

    function reveal(element: HTMLElement) {
        mount();
        flush();
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
            frame = 0;
            element.scrollIntoView({ behavior: 'instant', block: 'start' });
        });
    }

    return html`
        <div
            class='preview card --border-default --border-border'
            id='${id ?? ''}'
            ${{
                onconnect: (element: HTMLElement) => {
                    if (id && location.hash === `#${id}`) {
                        reveal(element);
                    }

                    if (state.mounted) {
                        return;
                    }

                    if (typeof IntersectionObserver === 'undefined') {
                        mount();
                        return;
                    }

                    observer = new IntersectionObserver((entries) => {
                        if (entries.some((entry) => entry.isIntersecting)) {
                            mount();
                        }
                    }, { rootMargin: '400px 0px' });
                    observer.observe(element);
                },
                ondisconnect: () => {
                    cancelAnimationFrame(frame);
                    frame = 0;
                    observer?.disconnect();
                    observer = undefined;
                },
                // TOC navigation focuses the card before scrolling. Mount first so its final box is the target.
                onfocusin: () => {
                    if (!state.mounted) {
                        mount();
                        flush();
                    }
                },
                onwindowhashchange: function(this: HTMLElement) {
                    if (id && location.hash === `#${id}`) {
                        reveal(this);
                    }
                }
            }}
        >
            ${title !== null && html`
                <div class='preview-title'>${title}</div>
            `}

            <div
                class='preview-stage ${() => !state.mounted && 'preview-stage--pending'}'
                aria-busy='${() => state.mounted ? 'false' : 'true'}'
            >${() => state.mounted && untrack(render)}</div>
        </div>
    `;
};


export { preview };
