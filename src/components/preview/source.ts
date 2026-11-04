import { effect, reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes } from '@esportsplus/template';
import code from './code';
import type { CodeViewerAttributes } from '~/components/editor/viewer';
import type { State } from './index';


type A = Attributes & {
    // What the copy button announces, e.g. 'Copy colors source'.
    label?: string;
    language?: CodeViewerAttributes['language'];
    state: State;
};

type Provider = () => Promise<string>;


// Loaded sources by provider, so a source panel rebuilt for another variant and back doesn't load it again.
const CACHE = new WeakMap<Provider, string>();


// An example's source, loaded the first time its view switches to code. A failed load retries when the view is chosen
// again.
export default component(
    function({ label, language = 'typescript', state, ...attributes }: A, provider: Provider) {
        let request = 0,
            ui = reactive({ code: CACHE.get(provider) ?? '', error: '', loading: false });

        effect(() => {
            state.retry;

            if (state.view !== 'code' || CACHE.has(provider)) {
                return;
            }

            let current = ++request;

            ui.error = '';
            ui.loading = true;

            provider().then((value) => {
                CACHE.set(provider, value);

                if (current === request) {
                    ui.code = value;
                }
            }).catch(() => {
                if (current === request) {
                    ui.error = 'Unable to load this example. Select Code to try again.';
                }
            }).finally(() => {
                if (current === request) {
                    ui.loading = false;
                }
            });
        });

        return html`
            <section
                class='preview-source'
                ${attributes}
                ${{
                    'aria-busy': () => String(ui.loading),
                    hidden: () => state.view !== 'code'
                }}
            >
                ${() => ui.loading && html`<p class='preview-source-message' role='status'>Loading example source…</p>`}
                ${() => ui.error && html`<p class='preview-source-message' role='alert'>${ui.error}</p>`}
                ${() => ui.code && code({ label, language, value: ui.code })}
            </section>
        `;
    }
);
