import { html, type Attributes } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';


type Status = 'error' | 'loading' | 'ready';


export default ({ alt, crossorigin, fetchpriority, height, loading = 'lazy', placeholder, referrerpolicy, sizes, src, srcset, width, ...attributes }: Attributes & {
    alt: string;
    crossorigin?: 'anonymous' | 'use-credentials';
    fetchpriority?: 'auto' | 'high' | 'low';
    height: number;
    loading?: 'eager' | 'lazy';
    placeholder: string;
    referrerpolicy?: ReferrerPolicy;
    sizes?: string;
    src: string;
    srcset?: string;
    width: number;
}) => {
    // Spread at runtime so unset values are skipped.
    let source = { crossorigin, fetchpriority, referrerpolicy, sizes, srcset },
        state = reactive({ covered: true, status: 'loading' as Status });

    function uncover(e: TransitionEvent) {
        if (e.propertyName === 'opacity') {
            state.covered = false;
        }
    }

    return html`
        <div
            aria-busy='${() => String(state.status === 'loading')}'
            class='image-lazyload'
            style='${`--aspect-ratio: ${width} / ${height}`}'
            ${attributes}
            ${{
                class: () => `image-lazyload--${state.status}`
            }}
        >
            <img
                alt='${alt}'
                class='image-lazyload-source'
                decoding='async'
                draggable='false'
                height='${height}'
                loading='${loading}'
                src='${src}'
                width='${width}'
                ${source}
                ${{
                    onerror: () => {
                        state.status = 'error';
                    },
                    onload: function(this: HTMLImageElement) {
                        if (state.status === 'ready') {
                            return;
                        }

                        this.decode().then(
                            () => {
                                state.status = 'ready';
                            },
                            () => {
                                state.status = 'error';
                            }
                        );
                    },
                    onrender: (img: HTMLImageElement) => {
                        // Memory-cached images have dimensions synchronously; drop the placeholder without a fade.
                        // Deferred lazy images also report complete, so naturalWidth is the only reliable signal.
                        if (img.complete && img.naturalWidth > 0) {
                            state.covered = false;
                            state.status = 'ready';
                        }
                    }
                }}
            />
            ${() => state.covered && html`
                <img
                    alt=''
                    aria-hidden='true'
                    class='image-lazyload-placeholder'
                    decoding='async'
                    draggable='false'
                    src='${placeholder}'
                    ${{
                        ontransitioncancel: uncover,
                        ontransitionend: uncover
                    }}
                />
            `}
        </div>
    `;
};
