// Report whether one CSS property is still transitioning. A frame check also settles unchanged values,
// disabled motion and cancelled/reversing transitions, where transitionend alone is insufficient.
const trackTransition = (property: string, change: (running: boolean, element?: HTMLElement) => void) => {
    let element: HTMLElement | undefined,
        frame: number | undefined;

    function settle() {
        if (frame !== undefined) {
            cancelAnimationFrame(frame);
        }

        frame = requestAnimationFrame(() => {
            frame = undefined;
            change(!!element?.getAnimations().some(animation =>
                'transitionProperty' in animation && animation.transitionProperty === property &&
                animation.playState !== 'finished' && animation.playState !== 'idle'
            ), element);
        });
    }

    function incoming(event: TransitionEvent) {
        return event.target === element && !event.pseudoElement && event.propertyName === property;
    }

    return {
        settle,
        attributes: {
            onconnect: (target: HTMLElement) => {
                element = target;
                settle();
            },
            ondisconnect: () => {
                if (frame !== undefined) {
                    cancelAnimationFrame(frame);
                    frame = undefined;
                }

                element = undefined;
                change(false);
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
                    change(true, element);
                }
            }
        }
    };
};


export { trackTransition };
