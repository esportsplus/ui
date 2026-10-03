import { effect, reactive } from '@esportsplus/reactivity';
import type { Attributes } from '@esportsplus/template';
import { finished } from '~/shared/animation';


type State = { active: boolean };

type Lifecycle = {
    activeClass?: boolean;
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
    popover?: boolean;
    state?: State;
    target?: (root: HTMLElement) => HTMLElement | undefined;
};


// Both dialogs and popups wait for their finite exit animations and invalidate an earlier close on reopening.
function lifecycle(element: HTMLElement, { activeClass = true, animations, close, closed, open, state, subtree = false }: Lifecycle) {
    let generation = 0,
        opened = false,
        stop = effect(() => {
            let active = state.active,
                current = ++generation;

            if (active) {
                open();
                opened = true;

                if (activeClass) {
                    element.classList.add('--active');
                }

                return;
            }

            if (activeClass) {
                element.classList.remove('--active');
            }

            close?.();

            if (!opened) {
                return;
            }

            void finished(animations?.() ?? element, { subtree }).then(() => {
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


let opened: HTMLElement[] = [];


// Spread on a popup's host. Inline surfaces retain their positioning and morph CSS; popovers use the top layer.
function popup({ canDismiss, contains = (root, node) => !!node && root.contains(node), dismiss = true, dismissOn, escape = true, ondismiss, onclosed, onopen, popover = false, state = reactive({ active: false }), target = (root) => root }: Popup = {}): Attributes {
    let root: HTMLElement | undefined,
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

    function dismissPopup(reason: 'escape' | 'outside') {
        if (state.active || canDismiss?.()) {
            ondismiss?.(reason);
            state.active = false;
        }
    }

    return {
        // Inline hosts compose this binding with their own class bindings through the template runtime.
        class: !popover ? () => state.active && '--active' : undefined,
        onconnect: (element: HTMLElement) => {
            root = element;
            stop = lifecycle(element, {
                activeClass: popover,
                animations: () => target(element) ?? element,
                close: () => {
                    remove();
                    let surface = target(element);

                    if (surface) {
                        surface.inert = true;
                    }
                },
                closed: hide,
                open: () => {
                    let surface = target(element),
                        previous = document.activeElement;

                    if (popover && surface && !surface.matches(':popover-open')) {
                        surface.popover = 'manual';
                        surface.inert = true;
                        surface.showPopover();
                    }

                    if (surface) {
                        surface.inert = false;
                    }

                    onopen?.();

                    // Commit the closed styles after placement, before lifecycle adds '--active'.
                    if (popover) {
                        surface?.getBoundingClientRect();
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
            stop?.();
            remove();
            hide();
            root = undefined;
        },
        ...(dismiss && {
            ondocumentpointerdown: (event: PointerEvent) => {
                if (root && !contains(root, event.target as Node | null)) {
                    dismissPopup('outside');
                }
            }
        }),
        ...(dismissOn && {
            ondocumentclick: (event: MouseEvent) => {
                let match = (event.target as Element | null)?.closest?.(dismissOn);

                if (root && match && root.contains(match)) {
                    dismissPopup('outside');
                }
            }
        }),
        ...(escape && {
            ondocumentkeydown: (event: KeyboardEvent) => {
                if (event.key !== 'Escape' || event.defaultPrevented || !root || !(state.active || canDismiss?.())) {
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
