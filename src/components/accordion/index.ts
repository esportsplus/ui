import { effect, reactive } from '@esportsplus/reactivity';
import { html, component, type Attributes } from '@esportsplus/template';
import { observeSize } from '~/shared/resize';
import { trackTransition } from '~/shared/transition';
import './scss/index.scss';


export default component<Attributes & {
    lines?: number,
    state?: { active: boolean | number, expandable?: boolean }
}>(
    function({ lines, state = reactive({ active: false, expandable: false }), ...attributes }, content) {
        let a: Attributes | undefined,
            c: Attributes | undefined,
            property = lines === undefined ? 'grid-template-rows' : 'height',
            ui = reactive({ scrollable: false }),
            viewport: HTMLElement | undefined;

        let motion = trackTransition(property, (running, element) => {
            ui.scrollable = !!state.active && !!element && !running;
        });

        effect(() => {
            let active = !!state.active;

            ui.scrollable = false;

            // Scroll position survives the height change; reset it as soon as closing starts.
            if (!active) {
                viewport?.scrollTo({ top: 0, behavior: 'instant' });
            }

            motion.settle();
        });

        if (lines !== undefined) {
            let measured = reactive({ height: 0, instant: true });

            a = {
                class: ['accordion--more', () => measured.instant && 'accordion--instant'],
                // The size measured on connect is written after the box was styled once, so the height holds still
                // until that first measured frame has painted, or it would play from the unmeasured height.
                onfirstpaint: () => {
                    measured.instant = false;
                },
                style: [
                    () => measured.height && `--height: ${measured.height}px;`,
                    `--lines: ${lines};`
                ]
            };
            c = observeSize(({ height }, element) => {
                let computed = getComputedStyle(element),
                    line = parseFloat(computed.lineHeight) || parseFloat(computed.fontSize) * 1.2;

                state.expandable = height > Math.ceil(line * lines);
                measured.height = height;
            });
        }

        return html`
            <div
                class='accordion'
                ${attributes}
                ${a}
                ${{
                    ...motion.attributes,
                    class: [
                        () => state.active && '--active',
                        () => state.active && ui.scrollable && 'accordion--scrollable'
                    ],
                    inert: () => lines === undefined && !state.active,
                    onconnect: (element: HTMLElement) => {
                        viewport = element;
                        motion.attributes.onconnect(element);
                    },
                    ondisconnect: () => {
                        motion.attributes.ondisconnect();
                        viewport = undefined;
                    }
                }}
            >
                <div class='accordion-content' ${c}>${content}</div>
            </div>
        `;
    }
);
