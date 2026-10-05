import { html } from 'docs/app';
import { effect, flush, reactive, untrack } from '@esportsplus/reactivity';
import { highlight, icon, select } from '@esportsplus/ui/components';
import { observeIntersection } from '@esportsplus/ui/shared/visible';
import codeSvg from '@esportsplus/ui/svg/code.svg';
import eye from '@esportsplus/ui/svg/eye.svg';
import { code } from 'docs/components/code';
import type { Renderable } from 'docs/app';
import type { PreviewOption } from 'docs/types';
import 'docs/components/preview/scss/index.scss';


type View = 'preview' | 'code';


const preview = (title: string | null, node: Renderable<unknown>, id?: string, options: PreviewOption[] = [], source?: () => Promise<string>) => {
    let frame = 0,
        release: VoidFunction | undefined,
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
        release?.();
        release = undefined;
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
            ${source && html`
                <div class='preview-view' role='group' aria-label='${title ?? 'Example'} view'>
                    ${highlight({ class: 'preview-view-highlight', target: '.preview-view-button' })}
                    ${(['preview', 'code'] as const).map((view) => html`
                        <button
                            class='preview-view-button ${() => state.view === view && '--active'}'
                            type='button'
                            ${{
                                'aria-pressed': () => String(state.view === view),
                                onclick: () => {
                                    state.view = view;

                                    if (view === 'code' && state.error) {
                                        state.retry++;
                                    }
                                }
                            }}
                        >
                            ${icon({ 'aria-hidden': 'true', class: 'preview-view-icon' }, view === 'preview' ? eye : codeSvg)}
                            ${view === 'preview' ? 'Preview' : 'Code'}
                        </button>
                    `)}
                </div>
            `}

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
                        ${() => state.loading && html`<p class='preview-code-message' role='status'>Loading example source…</p>`}
                        ${() => state.error && html`<p class='preview-code-message' role='alert'>${state.error}</p>`}
                        ${() => state.code && code(state.code, true)}
                    </section>
                `}
            </div>
        </div>
    `;
};


export { preview };
