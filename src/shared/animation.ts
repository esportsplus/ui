// Settles once every animation on the element has, however each ended: a rejection only means the animation stopped
// running (reopening mid-close, say). Every 'finished' is taken up front, since cancelling one replaces it with a
// promise that never settles.
const finished = (element: HTMLElement, options?: GetAnimationsOptions) => {
    return Promise.allSettled( element.getAnimations(options).map((animation) => animation.finished) );
};

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;


export { finished, reduced };
