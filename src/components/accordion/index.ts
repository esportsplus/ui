import { effect, reactive } from '@esportsplus/reactivity';
import { html, component, type Attributes } from '@esportsplus/template';
import './scss/index.scss';


export default component<Attributes & {
    lines?: number,
    state?: { active: boolean | number, expandable?: boolean }
}>(
    function({ lines, state = reactive({ active: false, expandable: false }), ...attributes }, content) {
        let a: Attributes | undefined,
            c: Attributes | undefined,
            frame: number | undefined,
            property = lines === undefined ? 'grid-template-rows' : 'height',
            ui = reactive({ scrollable: false }),
            viewport: HTMLElement | undefined;

        function settle() {
            if (frame !== undefined) {
                cancelAnimationFrame(frame);
            }

            // No transitionend fires for an unchanged height or disabled motion. Also check here after
            // cancellation, once a reversing transition has had a chance to start.
            frame = requestAnimationFrame(() => {
                frame = undefined;
                ui.scrollable = !!state.active && !!viewport && !viewport.getAnimations().some(animation =>
                    'transitionProperty' in animation && animation.transitionProperty === property &&
                    animation.playState !== 'finished' && animation.playState !== 'idle'
                );
            });
        }

        function incoming(event: TransitionEvent) {
            return event.target === viewport && !event.pseudoElement && event.propertyName === property;
        }

        effect(() => {
            let active = !!state.active;

            ui.scrollable = false;

            // Scroll position survives the height change; reset it as soon as closing starts.
            if (!active) {
                viewport?.scrollTo({ top: 0, behavior: 'instant' });
            }

            settle();
        });

        if (lines !== undefined) {
            let measured = reactive({ height: 0 }),
                observer: ResizeObserver | undefined;

            a = {
                class: 'accordion--more',
                style: [
                    () => measured.height && `--height: ${measured.height}px;`,
                    `--lines: ${lines};`
                ]
            };
            c = {
                onconnect: (element) => {
                    observer = new ResizeObserver(() => {
                        let computed = getComputedStyle(element),
                            height = element.offsetHeight,
                            line = parseFloat(computed.lineHeight) || parseFloat(computed.fontSize) * 1.2;

                        state.expandable = height > Math.ceil(line * lines);
                        measured.height = height;
                    });
                    observer.observe(element);
                },
                ondisconnect: () => {
                    observer?.disconnect();
                }
            };
        }

        return html`
            <div
                class='accordion'
                ${attributes}
                ${a}
                ${{
                    class: [
                        () => state.active && '--active',
                        () => state.active && ui.scrollable && 'accordion--scrollable'
                    ],
                    inert: () => lines === undefined && !state.active,
                    onconnect: (element: HTMLElement) => {
                        viewport = element;
                        settle();
                    },
                    ondisconnect: () => {
                        if (frame !== undefined) {
                            cancelAnimationFrame(frame);
                            frame = undefined;
                        }

                        viewport = undefined;
                    },
                    ontransitioncancel: (event: TransitionEvent) => {
                        if (incoming(event)) {
                            settle();
                        }
                    },
                    ontransitionend: (event: TransitionEvent) => {
                        if (incoming(event)) {
                            settle();
                        }
                    },
                    ontransitionrun: (event: TransitionEvent) => {
                        if (incoming(event)) {
                            ui.scrollable = false;
                        }
                    }
                }}
            >
                <div class='accordion-content' ${c}>${content}</div>
            </div>
        `;
    }
);
