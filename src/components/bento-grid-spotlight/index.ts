import { reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import './scss/index.scss';


type Card = Attributes & {
    // Decorative art behind the content; it brightens on hover.
    background?: Renderable<unknown>;
    // A slow light that circles the border, brightening on hover.
    beam?: boolean;
    columns?: 1 | 2 | 3 | 4;
    description?: Renderable<unknown>;
    icon?: Renderable<unknown>;
    rows?: 1 | 2 | 3;
    // A soft glow that follows the pointer.
    spotlight?: boolean;
    // Leans the card toward the pointer.
    tilt?: boolean;
    title?: Renderable<unknown>;
};


// Degrees the card leans at its edges.
const TILT = 5;

// Pointer distance from the centre, in px, that reaches the full lean.
const TILT_RANGE = 150;


function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}


const card = component<Card>(
    function(this, { background, beam = true, columns = 1, description, icon, rows = 1, spotlight = true, tilt = false, title, ...attributes }, content) {
        let footer = title || description || icon;

        return html`
            <div
                class='bento-grid-spotlight-card ${tilt && '--tilt'}'
                style='${`--columns: ${columns}; --rows: ${rows};`}'
                ${this?.attributes}
                ${attributes}
                ${{
                    onpointerleave: function(this: HTMLElement) {
                        this.style.setProperty('--tilt-x', '0deg');
                        this.style.setProperty('--tilt-y', '0deg');
                    },
                    onpointermove: function(this: HTMLElement, event: PointerEvent) {
                        let rect = this.getBoundingClientRect(),
                            x = event.clientX - rect.left,
                            y = event.clientY - rect.top;

                        // Written straight to the element; a reactive style binding would lag a frame behind the pointer.
                        this.style.setProperty('--spot-x', `${x}px`);
                        this.style.setProperty('--spot-y', `${y}px`);

                        if (tilt) {
                            this.style.setProperty('--tilt-x', `${clamp((y - rect.height / 2) / TILT_RANGE, -1, 1) * -TILT}deg`);
                            this.style.setProperty('--tilt-y', `${clamp((x - rect.width / 2) / TILT_RANGE, -1, 1) * TILT}deg`);
                        }
                    }
                }}
            >
                ${spotlight && html`<div aria-hidden='true' class='bento-grid-spotlight-glow'></div>`}
                ${beam && html`
                    <div aria-hidden='true' class='bento-grid-spotlight-beam'>
                        <div class='bento-grid-spotlight-beam-light'></div>
                    </div>
                `}
                ${background && html`<div aria-hidden='true' class='bento-grid-spotlight-background'>${background}</div>`}

                <div class='bento-grid-spotlight-body'>
                    <div class='bento-grid-spotlight-visual'>${content}</div>

                    ${footer && html`
                        <div class='bento-grid-spotlight-footer'>
                            ${icon && html`<div aria-hidden='true' class='bento-grid-spotlight-icon'>${icon}</div>`}
                            <div>
                                ${title && html`<h3 class='bento-grid-spotlight-title'>${title}</h3>`}
                                ${description && html`<p class='bento-grid-spotlight-description'>${description}</p>`}
                            </div>
                        </div>
                    `}
                </div>
            </div>
        `;
    }
);


export default Object.assign(
    component<Attributes>(
        function(this, attributes, content) {
            let observer: IntersectionObserver | undefined,
                ui = reactive({ visible: false });

            return html`
                <div
                    class='bento-grid-spotlight'
                    ${this?.attributes}
                    ${attributes}
                    ${{
                        class: () => ui.visible && '--visible',
                        onconnect: (element: HTMLElement) => {
                            let children = element.firstElementChild!.children;

                            // Cards rise in one after another in source order.
                            for (let i = 0, n = children.length; i < n; i++) {
                                (children[i] as HTMLElement).style.setProperty('--i', String(i));
                            }

                            observer = new IntersectionObserver((entries) => {
                                if (entries.some((entry) => entry.isIntersecting)) {
                                    ui.visible = true;
                                    observer?.disconnect();
                                }
                            }, { rootMargin: '-50px' });
                            observer.observe(element);
                        },
                        ondisconnect: () => {
                            observer?.disconnect();
                        }
                    }}
                >
                    <div class='bento-grid-spotlight-grid'>${content}</div>
                </div>
            `;
        }
    ),
    { card }
);
