import { reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes } from '@esportsplus/template';
import { drag, INTERACTIVE } from '~/shared/drag';
import './scss/index.scss';


// Snapping back, the drawer's own curve and length.
const SETTLE = { duration: 280, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' };


export default component<Attributes & { state?: { active: boolean } }>(
    function(this, { state = reactive({ active: true }), ...attributes }, content) {
        let opened = false,
            returning = false,
            height = 0,
            motion: Animation[] = [],
            frame: HTMLElement | undefined;

        const reset = () => {
            for (let animation of motion) {
                animation.cancel();
            }

            motion = [];
            frame?.style.removeProperty('height');
            (frame?.firstElementChild as HTMLElement | undefined)?.style.removeProperty('transform');
        };

        // The layout follows the same offset as the content, including the settle after release.
        let gesture = drag({
            begin: (e) => {
                if (e.button !== 0 || !state.active || motion.length || (e.target as Element).closest(INTERACTIVE)) {
                    return null;
                }

                return [{ axis: 'y', sign: -1 }];
            },
            capture: (element) => {
                frame = element.parentElement!;
                height = element.offsetHeight;
                frame.style.height = `${height}px`;
            },
            move: (element, { y }) => {
                element.style.transform = `translateY(${y}px)`;
                frame!.style.height = `${Math.max(0, height + Math.min(y, 0))}px`;
            },
            release: (element, _, dismiss) => {
                let from = element.style.transform,
                    space = frame!,
                    start = space.style.height,
                    end = dismiss ? 0 : height,
                    timing = matchMedia('(prefers-reduced-motion: reduce)').matches ? { duration: 0 } : SETTLE;

                element.style.removeProperty('transform');
                space.style.height = `${end}px`;

                if (dismiss) {
                    state.active = false;
                }

                motion = [
                    element.animate(
                        [{ transform: from }, { transform: dismiss ? `translateY(${-height}px)` : 'none' }],
                        timing
                    ),
                    space.animate([{ height: start }, { height: `${end}px` }], timing)
                ];
                void motion[1]!.finished.then(() => {
                    reset();
                }, () => {});
            }
        });

        return html`
            <div
                class='announcement'
                ${this?.attributes}
                ${attributes}
                ${{
                    class: () => {
                        if (state.active) {
                            opened = true;
                            reset();
                        }
                        // After a dismissal, showing again reverses it instead of sliding in.
                        else if (opened) {
                            returning = true;
                        }

                        return [state.active && '--active', returning && 'announcement--returning'].filter(Boolean).join(' ');
                    },
                    inert: () => !state.active,
                    ondisconnect: reset
                }}
            >
                <div class='announcement-content' ${gesture}>${content}</div>
            </div>
        `;
    }
);
