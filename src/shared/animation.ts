// An element's box before a layout change, and the slide carrying it from there.
type Sliding = Element & { [FROM]?: DOMRect; [SLIDE]?: Animation };


const FROM = Symbol();

const SLIDE = Symbol();


// Settles once every animation on the element has, however each ended: a rejection only means the animation stopped
// running (reopening mid-close, say). Every 'finished' is taken up front, since cancelling one replaces it with a
// promise that never settles.
const finished = (element: HTMLElement, options?: GetAnimationsOptions) => {
    return Promise.allSettled( element.getAnimations(options).map((animation) => animation.finished) );
};

// Records where each element is drawn now, a slide still running included, ahead of a change to the layout.
const measure = (elements: Iterable<Element>) => {
    for (let element of elements) {
        (element as Sliding)[FROM] = element.getBoundingClientRect();
    }
};

// Slides an element from the box 'measure' recorded to where the change put it, replacing a slide still running on it,
// and returns that new box; undefined for an element 'measure' never saw, which is new to the layout. Added onto its
// translate, so a shake or nudge of its own still plays.
const slide = (element: Element, timing: KeyframeAnimationOptions | null) => {
    let from = (element as Sliding)[FROM];

    (element as Sliding)[FROM] = undefined;

    if (!from) {
        return undefined;
    }

    (element as Sliding)[SLIDE]?.cancel();

    let to = element.getBoundingClientRect(),
        x = from.left - to.left,
        y = from.top - to.top;

    if (timing && (Math.abs(x) >= 0.5 || Math.abs(y) >= 0.5)) {
        (element as Sliding)[SLIDE] = element.animate(
            [{ translate: `${x}px ${y}px` }, { translate: '0px 0px' }],
            { ...timing, composite: 'add' }
        );
    }

    return to;
};

// A slide's timing from the CSS variables '--{name}-duration' and '--{name}-easing'; null without a duration, so
// reduced motion is a CSS rule.
const timing = (computed: CSSStyleDeclaration, name: string): KeyframeAnimationOptions | null => {
    let duration = computed.getPropertyValue(`--${name}-duration`).trim(),
        ms = (parseFloat(duration) || 0) * (duration.endsWith('ms') ? 1 : 1000);

    return ms ? { duration: ms, easing: computed.getPropertyValue(`--${name}-easing`).trim() || 'ease' } : null;
};


export { finished, measure, slide, timing };
