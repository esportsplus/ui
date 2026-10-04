import { html } from 'docs/app';
import { effect, flush, reactive, untrack } from '@esportsplus/reactivity';
import { select } from '@esportsplus/ui/components';
import { code } from 'docs/components/code';
import { exampleView, type View } from 'docs/components/example-view';
import type { Renderable } from 'docs/app';
import type { PreviewOption } from 'docs/types';
import 'docs/components/preview/scss/index.scss';


const preview = (title: string | null, node: Renderable<unknown>, id?: string, options: PreviewOption[] = [], source?: () => Promise<string>) => {
    let observer: IntersectionObserver | undefined,
        frame = 0,
        request = 0,
        cache = new Map<string, string>(),
        render = typeof node === 'function' ? node as () => Renderable<unknown> : () => node,
        target = () => options.find((option) => location.hash === `#${option.id}`),
        selection = reactive({ active: false, error: '', selected: target()?.id ?? options[0]?.id ?? '' }),
        state = reactive({
            code: '',
            error: '',
            loading: false,
            mounted: typeof node !== 'function' || (!!id && location.hash === `#${id}`) || !!target(),
            retry: 0,
            view: 'preview' as View
        });

    effect(() => {
        let selected = options.find((option) => option.id === selection.selected),
            key = selected?.id ?? id ?? '',
            provider = selected?.source ?? source,
            view = state.view;

        state.retry;
        let current = ++request;

        if (view !== 'code' || !provider) {
            return;
        }

        state.code = cache.get(key) ?? '';
        state.error = '';
        state.loading = !cache.has(key);

        if (cache.has(key)) {
            return;
        }

        provider().then((code) => {
            cache.set(key, code);

            if (current === request) {
                state.code = code;
            }
        }).catch(() => {
            if (current === request) {
                state.error = 'Unable to load this example. Select Code to try again.';
            }
        }).finally(() => {
            if (current === request) {
                state.loading = false;
            }
        });
    });

    function isTarget() {
        let option = target();

        if (option) {
            selection.selected = option.id;
        }

        return !!option || (!!id && location.hash === `#${id}`);
    }

    function mount() {
        observer?.disconnect();
        observer = undefined;
        state.mounted = true;
    }

    function reveal(element: HTMLElement) {
        state.view = 'preview';
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
            class='preview-example'
            id='${id ?? ''}'
            ${{
                onconnect: (element: HTMLElement) => {
                    if (isTarget()) {
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
                // TOC navigation focuses the example before scrolling. Mount first so its final box is the target.
                onfocusin: function(this: HTMLElement, event: FocusEvent) {
                    if (event.target === this) {
                        state.view = 'preview';
                    }

                    if (!state.mounted) {
                        mount();
                        flush();
                    }
                },
                onwindowhashchange: function(this: HTMLElement) {
                    if (isTarget()) {
                        reveal(this);
                    }
                }
            }}
        >
            ${source && exampleView(state, (view) => {
                state.view = view;

                if (view === 'code' && state.error) {
                    state.retry++;
                }
            }, `${title ?? 'Example'} view`)}

            <div class='preview card --border-default --border-border'>
                ${title !== null && html`
                    <div class='preview-title'>
                        <span>${title}</span>
                        ${options.length > 1 && select({
                            class: 'preview-select',
                            label: `${title} variant`,
                            options: options.map((option) => ({ label: option.label, value: option.id })),
                            state: selection
                        })}
                    </div>
                `}

                ${options.filter((option) => option.id !== id).map((option) => html`<span aria-hidden='true' class='preview-anchor' id='${option.id}'></span>`)}

                <div
                    class='preview-stage ${() => !state.mounted && 'preview-stage--pending'}'
                    aria-busy='${() => state.mounted ? 'false' : 'true'}'
                    hidden='${() => state.view !== 'preview'}'
                >${() => {
                    if (!state.mounted) {
                        return;
                    }

                    let selected = options.find((option) => option.id === selection.selected);

                    return untrack(selected?.render ?? render);
                }}</div>
                ${source && html`
                    <section class='preview-code' aria-label='${title ?? 'Example'} source code' hidden='${() => state.view !== 'code'}' aria-busy='${() => String(state.loading)}'>
                        ${() => state.loading && html`<p role='status'>Loading example source…</p>`}
                        ${() => state.error && html`<p role='alert'>${state.error}</p>`}
                        ${() => state.code && code(state.code)}
                    </section>
                `}
            </div>
        </div>
    `;
};


export { preview };
