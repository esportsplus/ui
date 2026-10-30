import { effect, reactive, root } from '@esportsplus/reactivity';
import { setProperties, type Attributes, type Element as Bound } from '@esportsplus/template';
import { finished } from '~/shared/animation';


type State = { active: boolean };

type Lifecycle = {
    animations?: () => HTMLElement;
    close?: VoidFunction;
    closed?: VoidFunction;
    open: VoidFunction;
    state: State;
    subtree?: boolean;
};

type Popup = {
    // Pending hover delays can also be dismissed before a surface opens.
    canDismiss?: () => boolean;
    contains?: (root: HTMLElement, node: Node | null) => boolean;
    dismiss?: boolean;
    // Clicks on matching content close after its own click handler has run.
    dismissOn?: string;
    escape?: boolean;
    ondismiss?: (reason: 'escape' | 'outside') => void;
    onclosed?: VoidFunction;
    onopen?: VoidFunction;
    // The surface 'target' returns must carry its own 'popover' attribute.
    popover?: boolean;
    state?: State;
    target?: (root: HTMLElement) => HTMLElement | undefined;
};


const SURFACE_STATE = Symbol('popup.surface');


// Both dialogs and popups wait for their finite exit animations and invalidate an earlier close on reopening.
function lifecycle(element: HTMLElement, { animations, close, closed, open, state, subtree = false }: Lifecycle) {
    let generation = 0,
        opened = false,
        stop = effect(() => {
            let active = state.active,
                current = ++generation;

            if (active) {
                open();
                opened = true;
                return;
            }

            close?.();

            if (!opened) {
                return;
            }

            // A microtask on, so a close written through a binding (applied as this effect's pass settles) has
            // started the exit transitions it waits on.
            void Promise.resolve()
                .then(() => finished(animations?.() ?? element, { subtree }))
                .then(() => {
                    if (generation === current && !state.active) {
                        opened = false;
                        closed?.();
                    }
                });
        });

    return () => {
        generation++;
        stop();
    };
}


// The surface 'target' returns may be the consumer's, so the popup marks it inert through a store bound on it. Seeded
// inert, its first write lands as it binds, before the first open shows the surface.
function surface(element: HTMLElement) {
    let store = element as HTMLElement & { [SURFACE_STATE]?: { inert: boolean } };

    return store[SURFACE_STATE] ??= root(() => {
        let state = reactive({ inert: true });

        setProperties(element as Bound, { inert: () => state.inert });

        return state;
    });
}


let opened: HTMLElement[] = [];


// Spread on a popup's host. Inline surfaces retain their positioning and morph CSS; popovers use the top layer.
function popup({ canDismiss, contains = (root, node) => !!node && root.contains(node), dismiss = true, dismissOn, escape = true, ondismiss, onclosed, onopen, popover = false, state = reactive({ active: false }), target = (root) => root }: Popup = {}): Attributes {
    let entering = 0,
        // A popover's '--active', a microtask behind 'state.active' while opening.
        local = reactive({ active: false }),
        root: HTMLElement | undefined,
        stop: VoidFunction | undefined;

    function remove() {
        if (root) {
            let index = opened.indexOf(root);

            if (index !== -1) {
                opened.splice(index, 1);
            }
        }
    }

    function hide() {
        let element = root && target(root);

        if (popover && element?.matches(':popover-open')) {
            element.hidePopover();
        }

        onclosed?.();
    }

    function dismissable() {
        return state.active || !!canDismiss?.();
    }

    function dismissPopup(reason: 'escape' | 'outside') {
        ondismiss?.(reason);
        state.active = false;
    }

    return {
        // Hosts compose this binding with their own class bindings through the template runtime.
        class: popover ? () => local.active && '--active' : () => state.active && '--active',
        onconnect: (element: HTMLElement) => {
            root = element;
            stop = lifecycle(element, {
                animations: () => target(element) ?? element,
                close: () => {
                    entering++;
                    local.active = false;
                    remove();

                    let content = target(element);

                    if (content) {
                        surface(content).inert = true;
                    }
                },
                closed: hide,
                open: () => {
                    let content = target(element),
                        previous = document.activeElement;

                    // Inert until the open has landed, so showing it focuses nothing it contains.
                    if (content) {
                        let state = surface(content);

                        if (popover && !content.matches(':popover-open')) {
                            content.showPopover();
                        }

                        state.inert = false;
                    }

                    onopen?.();

                    // A microtask on, the placement 'onopen' bound has been written; the closed styles it makes are
                    // committed before '--active' starts the entrance from them.
                    if (popover) {
                        let current = ++entering;

                        queueMicrotask(() => {
                            if (current === entering) {
                                content?.getBoundingClientRect();
                                local.active = true;
                            }
                        });
                    }

                    if (previous instanceof HTMLElement && previous !== document.activeElement) {
                        previous.focus({ preventScroll: true });
                    }

                    remove();
                    opened.push(element);
                },
                state,
                subtree: true
            });
        },
        ondisconnect: () => {
            entering++;
            stop?.();
            remove();
            hide();
            root = undefined;
        },
        // Every popup sees every document event, so the cheap open check comes before any tree walk.
        ...(dismiss && {
            ondocumentpointerdown: (event: PointerEvent) => {
                if (root && dismissable() && !contains(root, event.target as Node | null)) {
                    dismissPopup('outside');
                }
            }
        }),
        ...(dismissOn && {
            ondocumentclick: (event: MouseEvent) => {
                if (!root || !dismissable()) {
                    return;
                }

                let match = (event.target as Element | null)?.closest?.(dismissOn);

                if (match && root.contains(match)) {
                    dismissPopup('outside');
                }
            }
        }),
        ...(escape && {
            ondocumentkeydown: (event: KeyboardEvent) => {
                if (event.key !== 'Escape' || event.defaultPrevented || !root || !dismissable()) {
                    return;
                }

                let modal = document.activeElement?.closest('dialog:modal') ?? document.querySelector('dialog:modal');

                if ((modal && !modal.contains(root) && !popover) || (opened.length && opened[opened.length - 1] !== root)) {
                    return;
                }

                event.preventDefault();
                dismissPopup('escape');
            }
        })
    };
}


export { lifecycle };
export default popup;
export type { Popup };
