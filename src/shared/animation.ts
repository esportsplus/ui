// An element's box before a layout change, and the slide carrying it from there.
type Sliding = Element & { [FROM]?: DOMRect; [SLIDE]?: Animation };


const FROM = Symbol();

const SLIDE = Symbol();


// Settles once every finite animation on the element has, however each ended: a rejection only means the animation
// stopped running (reopening mid-close, say). Looping decoration must not keep a closing dialog modal forever.
// Every 'finished' is taken up front, since cancelling one replaces it with a promise that never settles.
const finished = (element: HTMLElement, options?: GetAnimationsOptions) => {
    let animations = element.getAnimations(options),
        pending: Promise<Animation>[] = [];

    for (let i = 0, n = animations.length; i < n; i++) {
        if (animations[i].effect?.getComputedTiming().endTime !== Infinity) {
            pending.push(animations[i].finished);
        }
    }

    return Promise.allSettled(pending);
};

// Records where each element is drawn now, a slide still running included, ahead of a change to the layout.
const measure = (elements: Iterable<Element>) => {
    for (let element of elements) {
        (element as Sliding)[FROM] = element.getBoundingClientRect();
    }
};

// A CSS time ('0.2s', '150ms') in milliseconds; 0 for anything else.
const ms = (value: string) => {
    let n = parseFloat(value);

    return isNaN(n) ? 0 : value.trim().endsWith('ms') ? n : n * 1000;
};

// Slides each element from the box 'measure' recorded to where the change put it, replacing a slide still running on
// it, and returns every element's new box. An element 'measure' never saw is new to the layout: it doesn't slide, and
// 'enter' hears it once every slide has started. Added onto its translate, so a shake or nudge of its own still plays.
// Every slide is cancelled, then every box read, then every slide started: a read between two starts would
// recalculate styles once per element.
const slides = <T extends Element>(elements: ArrayLike<T>, timing: KeyframeAnimationOptions | null, enter?: (element: T) => void) => {
    let froms: (DOMRect | undefined)[] = [],
        n = elements.length,
        options: KeyframeAnimationOptions | null = timing && { ...timing, composite: 'add' },
        tos: DOMRect[] = [];

    for (let i = 0; i < n; i++) {
        let element: Sliding = elements[i],
            from = element[FROM];

        element[FROM] = undefined;
        froms.push(from);

        if (from) {
            element[SLIDE]?.cancel();
        }
    }

    for (let i = 0; i < n; i++) {
        tos.push(elements[i].getBoundingClientRect());
    }

    for (let i = 0; i < n; i++) {
        let from = froms[i],
            to = tos[i];

        if (!from || !options) {
            continue;
        }

        let x = from.left - to.left,
            y = from.top - to.top;

        if (Math.abs(x) >= 0.5 || Math.abs(y) >= 0.5) {
            (elements[i] as Sliding)[SLIDE] = elements[i].animate(
                [{ translate: `${x}px ${y}px` }, { translate: '0px 0px' }],
                options
            );
        }
    }

    if (enter) {
        for (let i = 0; i < n; i++) {
            if (!froms[i]) {
                enter(elements[i]);
            }
        }
    }

    return tos;
};

// A slide's timing from the CSS variables '--{name}-duration' and '--{name}-easing'; null without a duration, so
// reduced motion is a CSS rule.
const timing = (computed: CSSStyleDeclaration, name: string): KeyframeAnimationOptions | null => {
    let duration = ms(computed.getPropertyValue(`--${name}-duration`));

    return duration ? { duration, easing: computed.getPropertyValue(`--${name}-easing`).trim() || 'ease' } : null;
};


export { finished, measure, ms, slides, timing };
