import { html, type Attributes } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import './scss/index.scss';


type Status = 'error' | 'loading' | 'ready';


export default ({ alt, fetchpriority, height, loading = 'lazy', placeholder, sizes, src, srcset, width, ...attributes }: Attributes & {
    alt: string;
    fetchpriority?: 'auto' | 'high' | 'low';
    height: number;
    loading?: 'eager' | 'lazy';
    placeholder?: string;
    sizes?: string;
    src?: string;
    srcset?: string;
    width: number;
}) => {
    // Spread at runtime so unset values are skipped; an empty src would fire a spurious error.
    let source = { fetchpriority, sizes, src, srcset },
        state = reactive({ instant: false, status: 'loading' as Status });

    function settle(status: Status, instant: boolean) {
        state.instant = instant;
        state.status = status;
    }

    return html`
        <div
            aria-busy='${() => String(state.status === 'loading')}'
            class='image'
            style='${`--aspect-ratio: ${width} / ${height}`}'
            ${attributes}
            ${{
                class: () => `--${state.status}${state.instant ? ' --instant' : ''}`
            }}
        >
            ${placeholder && html`
                <img alt='' aria-hidden='true' class='image-placeholder' draggable='false' src='${placeholder}' />
            `}
            <img
                alt='${alt}'
                class='image-source'
                decoding='async'
                draggable='false'
                height='${height}'
                loading='${loading}'
                width='${width}'
                ${source}
                ${{
                    onerror: () => settle('error', false),
                    onload: function(this: HTMLImageElement) {
                        if (state.status === 'ready') {
                            return;
                        }

                        this.decode().then(
                            () => settle('ready', false),
                            () => settle('error', false)
                        );
                    },
                    onrender: (img: HTMLImageElement) => {
                        // Memory-cached images have dimensions synchronously; reveal them without replaying the develop.
                        // Deferred lazy images also report complete, so naturalWidth is the only reliable signal.
                        if (img.complete && img.naturalWidth > 0) {
                            settle('ready', true);
                        }
                    }
                }}
            />
            <div aria-hidden='true' class='image-error'>
                <svg fill='currentColor' viewBox='0 0 256 256'>
                    <path d='M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16h64a8,8,0,0,0,7.59-5.47l14.83-44.48L163,151.43a8.07,8.07,0,0,0,4.46-4.46l14.62-36.55,44.48-14.83A8,8,0,0,0,232,88V56A16,16,0,0,0,216,40ZM112.41,157.47,98.23,200H40V172l52-52,30.42,30.42L117,152.57A8,8,0,0,0,112.41,157.47ZM216,82.23,173.47,96.41a8,8,0,0,0-4.9,4.62l-14.72,36.82L138.58,144l-35.27-35.27a16,16,0,0,0-22.62,0L40,149.37V56H216Zm12.68,33a8,8,0,0,0-7.21-1.1l-23.8,7.94a8,8,0,0,0-4.9,4.61l-14.31,35.77-35.77,14.31a8,8,0,0,0-4.61,4.9l-7.94,23.8A8,8,0,0,0,137.73,216H216a16,16,0,0,0,16-16V121.73A8,8,0,0,0,228.68,115.24ZM216,200H148.83l3.25-9.75,35.51-14.2a8.07,8.07,0,0,0,4.46-4.46l14.2-35.51,9.75-3.25Z' />
                </svg>
            </div>
        </div>
    `;
};
