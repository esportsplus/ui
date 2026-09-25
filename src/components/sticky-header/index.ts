import { reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import './scss/index.scss';


const DAMPING = 44;
const MASS = 0.6;
const REST = 0.0005;
const STEP = 1 / 120;
const STIFFNESS = 240;


export default component<Attributes & {
    actions?: Renderable<unknown>;
    leading?: Renderable<unknown>;
    subtitle?: string;
    title: string;
}>(
    function({ actions, leading, subtitle, title, ...attributes }, content) {
        let frame = 0,
            last = 0,
            position = 0,
            range = 0,
            root: HTMLElement | undefined,
            state = reactive({ condensed: false }),
            target = 0,
            velocity = 0;

        function measure(bar: HTMLElement) {
            let travel = Math.max(1, bar.offsetHeight - parseFloat(getComputedStyle(bar).minHeight));

            // Condense over at least 64px so short headers don't snap shut on the first wheel tick.
            range = Math.max(64, travel * 3);
        }

        function render(progress: number) {
            root?.style.setProperty('--progress', `${progress}`);
        }

        function tick(now: number) {
            let elapsed = Math.min((now - last) / 1000, 1 / 30);

            last = now;

            // Fixed substeps keep the overdamped spring stable when frames drop.
            for (let i = 0, n = Math.ceil(elapsed / STEP); i < n; i++) {
                velocity += ((-STIFFNESS * (position - target)) - (DAMPING * velocity)) / MASS * STEP;
                position += velocity * STEP;
            }

            if (Math.abs(position - target) < REST && Math.abs(velocity) < REST) {
                frame = 0;
                position = target;
                velocity = 0;
            }
            else {
                frame = requestAnimationFrame(tick);
            }

            render(position);
        }

        return html`
            <div
                class='sticky-header'
                ${attributes}
                ${{
                    class: () => state.condensed && '--condensed',
                    onconnect: (element: HTMLElement) => {
                        root = element;
                        measure(element.querySelector('.sticky-header-bar') as HTMLElement);
                    },
                    ondisconnect: () => {
                        cancelAnimationFrame(frame);
                        frame = 0;
                    }
                }}
            >
                <div
                    aria-label='${title}'
                    class='sticky-header-scroll'
                    role='region'
                    tabindex='0'
                    onscroll='${(event: Event) => {
                        target = Math.min(1, Math.max(0, (event.currentTarget as HTMLElement).scrollTop / range));
                        state.condensed = target >= 1;

                        if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
                            position = target;
                            velocity = 0;
                            render(position);
                        }
                        else if (!frame) {
                            last = performance.now();
                            frame = requestAnimationFrame(tick);
                        }
                    }}'
                >
                    <div aria-hidden='true' class='sticky-header-spacer'></div>
                    ${content}
                    <div aria-hidden='true' class='sticky-header-fade'></div>
                </div>

                <header class='sticky-header-bar'>
                    <div aria-hidden='true' class='sticky-header-plate'></div>
                    <div aria-hidden='true' class='sticky-header-edge sticky-header-edge--shadow'></div>
                    <div aria-hidden='true' class='sticky-header-edge sticky-header-edge--fade'></div>
                    <div aria-hidden='true' class='sticky-header-edge sticky-header-edge--line'></div>

                    <div class='sticky-header-row'>
                        ${leading ? html`<div class='sticky-header-slot'>${leading}</div>` : ''}

                        <div class='sticky-header-titles'>
                            <div class='sticky-header-expanded'>
                                <h2 class='sticky-header-title'>${title}</h2>
                                ${subtitle ? html`<p class='sticky-header-subtitle'>${subtitle}</p>` : ''}
                            </div>
                            <span aria-hidden='true' class='sticky-header-compact'>${title}</span>
                        </div>

                        ${actions ? html`<div class='sticky-header-slot sticky-header-slot--actions'>${actions}</div>` : ''}
                    </div>
                </header>
            </div>
        `;
    }
);
