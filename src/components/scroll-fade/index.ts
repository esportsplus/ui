import { reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes } from '@esportsplus/template';
import './scss/index.scss';


type A = Attributes & Options & {
    // Hides an edge while the content is scrolled all the way to it, so nothing is faded when nothing is hidden.
    auto?: boolean;
    edges?: 'both' | 'bottom' | 'top';
    // Keeps the native scrollbar; hidden by default so only the fade signals more content.
    scrollbar?: boolean;
};

type Edge = Attributes & Options & {
    // Pins the edge to the viewport, for pages that scroll the window rather than a panel.
    fixed?: boolean;
    side?: 'bottom' | 'top';
};

type Options = {
    // Backdrop blur in px at the very edge.
    blur?: number;
    // Stacks several blur layers so the blur ramps up smoothly instead of switching on at one strength.
    progressive?: boolean;
    // Height of the fade in px.
    size?: number;
};


// Enough layers for the ramp to read as continuous without stacking too many backdrop filters.
const LAYERS = 4;


function options({ blur, size }: Options) {
    return `${blur !== undefined ? `--blur: ${blur}px;` : ''}${size !== undefined ? ` --size: ${size}px;` : ''}`;
}

function layers(progressive?: boolean) {
    if (!progressive) {
        return '';
    }

    return Array.from({ length: LAYERS }, (_, i) => html`<div class='scroll-fade-layer' style='${`--layer: ${i}`}'></div>`);
}

const edge = component<Edge>(
    function(this, { blur, fixed = false, progressive = false, side = 'bottom', size, ...attributes }) {
        return html`
            <div
                aria-hidden='true'
                class='scroll-fade-edge scroll-fade-edge--${side} ${fixed && 'scroll-fade-edge--fixed'} ${progressive && 'scroll-fade-edge--progressive'}'
                style='${options({ blur, size })}'
                ${this?.attributes}
                ${attributes}
            >
                ${layers(progressive)}
            </div>
        `;
    }
);


export default Object.assign(
    component<A>(
        function(this, { auto = false, blur, edges = 'both', progressive = false, scrollbar = false, size, ...attributes }, content) {
            let observer: ResizeObserver | undefined,
                ui = reactive({ end: false, start: true });

            function measure(viewport: HTMLElement) {
                ui.start = viewport.scrollTop <= 1;
                ui.end = viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 1;
            }

            return html`
                <div class='scroll-fade' style='${options({ blur, size })}' ${this?.attributes} ${attributes}>
                    ${edges !== 'bottom' && html`
                        <div
                            aria-hidden='true'
                            class='scroll-fade-edge scroll-fade-edge--top ${progressive && 'scroll-fade-edge--progressive'}'
                            ${{ class: () => auto && ui.start && '--hidden' }}
                        >
                            ${layers(progressive)}
                        </div>
                    `}
                    ${edges !== 'top' && html`
                        <div
                            aria-hidden='true'
                            class='scroll-fade-edge scroll-fade-edge--bottom ${progressive && 'scroll-fade-edge--progressive'}'
                            ${{ class: () => auto && ui.end && '--hidden' }}
                        >
                            ${layers(progressive)}
                        </div>
                    `}

                    <div
                        class='scroll-fade-viewport ${!scrollbar && '--no-scrollbar'}'
                        ${{
                            onconnect: (element: HTMLElement) => {
                                if (!auto) {
                                    return;
                                }

                                // Content growing or the panel resizing can reveal or cover an end without any scroll.
                                observer = new ResizeObserver(() => measure(element));
                                observer.observe(element);

                                for (let i = 0, n = element.children.length; i < n; i++) {
                                    observer.observe(element.children[i]);
                                }

                                measure(element);
                            },
                            ondisconnect: () => {
                                observer?.disconnect();
                            },
                            onscroll: function(this: HTMLElement) {
                                if (auto) {
                                    measure(this);
                                }
                            }
                        }}
                    >
                        ${content}
                    </div>
                </div>
            `;
        }
    ),
    { edge }
);

