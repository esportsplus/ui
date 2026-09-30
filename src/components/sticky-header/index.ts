import { reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import './scss/index.scss';


const DAMPING = 44;
const MASS = 0.6;
const REST = 0.0005;
const STEP = 1 / 120;
const STIFFNESS = 240;

// Past the midpoint the sides swap which one is inert, so the faded one can't be focused, clicked or read twice.
const SWAP = 0.5;


let uid = 0;


export default component<Attributes & {
    after: Renderable<unknown>;
    before: Renderable<unknown>;
}>(
    function({ after, before, ...attributes }, content) {
        let bar: HTMLElement | undefined,
            frame = 0,
            id = `sticky-header-${++uid}`,
            last = 0,
            position = 0,
            range = 0,
            state = reactive({ condensed: false, progress: 0 }),
            target = 0,
            velocity = 0;

        function measure(bar: HTMLElement) {
            let travel = Math.max(1, bar.offsetHeight - parseFloat(getComputedStyle(bar).minHeight));

            // Condense over at least 64px so short headers don't snap shut on the first wheel tick.
            range = Math.max(64, travel * 3);
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

            state.progress = position;
        }

        return html`
            <div
                class='sticky-header'
                ${attributes}
                ${{
                    class: () => state.condensed && '--condensed',
                    onconnect: () => {
                        if (bar) {
                            measure(bar);
                        }
                    },
                    ondisconnect: () => {
                        cancelAnimationFrame(frame);
                        frame = 0;
                    },
                    style: () => `--progress: ${state.progress}`
                }}
            >
                <div
                    aria-labelledby='${id}'
                    class='sticky-header-scroll'
                    role='region'
                    tabindex='0'
                    onscroll='${(event: Event) => {
                        target = Math.min(1, Math.max(0, (event.currentTarget as HTMLElement).scrollTop / range));
                        state.condensed = target >= 1;

                        if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
                            position = target;
                            velocity = 0;
                            state.progress = position;
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

                <header
                    class='sticky-header-bar'
                    ${{
                        onrender: (element: HTMLElement) => {
                            bar = element;
                        }
                    }}
                >
                    <div aria-hidden='true' class='sticky-header-plate'></div>
                    <div aria-hidden='true' class='sticky-header-edge sticky-header-edge--shadow'></div>
                    <div aria-hidden='true' class='sticky-header-edge sticky-header-edge--fade'></div>
                    <div aria-hidden='true' class='sticky-header-edge sticky-header-edge--line'></div>

                    <div class='sticky-header-before' id='${id}' ${{ inert: () => state.progress >= SWAP }}>
                        ${before}
                    </div>
                    <div class='sticky-header-after' ${{ inert: () => state.progress < SWAP }}>
                        ${after}
                    </div>
                </header>
            </div>
        `;
    }
);
