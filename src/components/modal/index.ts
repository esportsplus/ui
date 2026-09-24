import { effect, reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes } from '@esportsplus/template';
import './scss/index.scss';


type A = Attributes<HTMLDialogElement> & {
    state?: { active: boolean }
};


async function finished(element: HTMLElement) {
    let animations = element.getAnimations();

    for (let i = 0, n = animations.length; i < n; i++) {
        // Reopening mid-close cancels the transition, which rejects 'finished'.
        await animations[i].finished.catch(() => {});
    }
}

function outside(element: HTMLElement, e: MouseEvent) {
    let rect = element.getBoundingClientRect();

    return e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom;
}


export default component<A>(
    function(this, { state = reactive({ active: false }), ...attributes }, content) {
        let stop: VoidFunction | undefined;

        return html`
            <dialog
                class='modal'
                ${this?.attributes}
                ${attributes}
                ${{
                    oncancel: (e: Event) => {
                        e.preventDefault();
                        state.active = false;
                    },
                    onclick: (e: MouseEvent) => {
                        let element = e.currentTarget as HTMLDialogElement;

                        if (e.target === element && outside(element, e)) {
                            state.active = false;
                        }
                    },
                    onclose: () => {
                        state.active = false;
                    },
                    onconnect: (element: HTMLDialogElement) => {
                        stop = effect(() => {
                            if (state.active) {
                                if (!element.open) {
                                    element.showModal();
                                    // Commit the closed styles first so adding '--active' transitions in.
                                    element.getBoundingClientRect();
                                }

                                element.classList.add('--active');
                                return;
                            }

                            element.classList.remove('--active');

                            if (!element.open) {
                                return;
                            }

                            void finished(element).then(() => {
                                if (!state.active) {
                                    element.close();
                                }
                            });
                        });
                    },
                    ondisconnect: () => {
                        stop?.();
                    }
                }}
            >
                ${content}
            </dialog>
        `;
    }
);
