import { reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes } from '@esportsplus/template';
import { drag, fling, INTERACTIVE } from '~/shared/drag';
import './scss/index.scss';


// Snapping back, the drawer's own curve and length.
const SETTLE = { duration: 280, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' };


export default component<Attributes & { state?: { active: boolean } }>(
    function(this, { state = reactive({ active: true }), ...attributes }, content) {
        let opened = false,
            returning = false,
            thrown: Animation | undefined;

        // Swiped up, the content leaves the way it went and the space closes behind it; any other way, it
        // rubber-bands. Thrown, it carries on until it has left the screen before the announcement closes.
        let gesture = drag({
            begin: (e) => {
                if (e.button !== 0 || !state.active || (e.target as Element).closest(INTERACTIVE)) {
                    return null;
                }

                return [{ axis: 'y', sign: -1 }];
            },
            move: (element, { y }) => {
                element.style.transform = `translateY(${y}px)`;
            },
            release: (element, drag, dismiss) => {
                let from = element.style.transform,
                    flung = dismiss ? fling(element, drag) : null;

                element.style.removeProperty('transform');

                if (!flung) {
                    if (dismiss) {
                        state.active = false;
                    }
                    else {
                        element.animate([{ transform: from }, { transform: 'none' }], SETTLE);
                    }

                    return;
                }

                // Gone from sight, it closes. The throw holds it out there until it opens again: a dismissed
                // announcement's hidden state rests in place, where dropping the throw would flash it back.
                thrown = element.animate(
                    [{ transform: from }, { transform: `translateY(${drag.y + flung.y}px)` }],
                    { duration: flung.duration, easing: flung.easing, fill: 'forwards' }
                );
                void thrown.finished.then(() => {
                    state.active = false;
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
                            thrown?.cancel();
                            thrown = undefined;
                        }
                        // After a dismissal, showing again reverses it instead of sliding in.
                        else if (opened) {
                            returning = true;
                        }

                        return [state.active && '--active', returning && 'announcement--returning'].filter(Boolean).join(' ');
                    },
                    inert: () => !state.active
                }}
            >
                <div class='announcement-content' ${gesture}>${content}</div>
            </div>
        `;
    }
);
