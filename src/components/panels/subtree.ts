import { effect, onCleanup, root, untrack } from '@esportsplus/reactivity';
import { html, render, type Renderable } from '@esportsplus/template';


const UNSET = Symbol();


// A host whose content renders again only when 'key' returns something new, so bindings inside it that read other
// values update in place instead of rebuilding it and everything mounted within.
const subtree = (key: () => unknown, content: () => Renderable<unknown>, attributes?: Record<string, unknown>) => {
    let disposed = false,
        release: VoidFunction | undefined,
        stop: VoidFunction | undefined;

    function dispose() {
        if (disposed) {
            return;
        }

        disposed = true;
        release?.();
        stop?.();
    }

    onCleanup(dispose);

    return html`
        <div
            class='panels-subtree'
            ${attributes}
            ${{
                onconnect: (host: HTMLElement) => {
                    if (disposed || stop) {
                        return;
                    }

                    let last: unknown = UNSET;

                    stop = root((dispose) => {
                        effect(() => {
                            let next = key();

                            if (release && Object.is(next, last)) {
                                return;
                            }

                            last = next;
                            release?.();
                            // A root of its own, so the content isn't owned by this effect: a re-run for an
                            // unchanged key would otherwise dispose the bindings of content it keeps in place.
                            release = untrack(() => root(() => render(host, content)));
                        });

                        return dispose;
                    });
                },
                ondisconnect: dispose
            }}
        ></div>
    `;
};


export default subtree;
