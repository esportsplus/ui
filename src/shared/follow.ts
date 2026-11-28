// Keeps top-layer surfaces on the elements they belong to. While anything follows, one captured scroll listener (so
// scrolling any container counts), a window resize listener and a resize observer on the followed elements call
// every update at most once a frame; with nothing following, nothing listens. The browser's anchor positioning would
// do this in layout, but it only reached every engine in 2026; this keeps the floating surfaces on 2024's baseline.
// Raw listeners, as these are document-wide rather than any template's.


let frame = 0,
    observer: ResizeObserver | undefined,
    updates = new Map<VoidFunction, Element>();


function run() {
    frame = 0;

    for (let update of updates.keys()) {
        update();
    }
}

function schedule() {
    frame ||= requestAnimationFrame(run);
}


// Calls 'update' whenever 'element' may have moved: a scroll anywhere, the window resizing, or the element resizing.
// Returns the stop.
const follow = (element: Element, update: VoidFunction) => {
    if (updates.size === 0) {
        observer = new ResizeObserver(schedule);
        window.addEventListener('resize', schedule, { passive: true });
        window.addEventListener('scroll', schedule, { capture: true, passive: true });
    }

    updates.set(update, element);
    observer?.observe(element);

    return () => {
        if (!updates.delete(update)) {
            return;
        }

        if (![...updates.values()].includes(element)) {
            observer?.unobserve(element);
        }

        if (updates.size === 0) {
            cancelAnimationFrame(frame);
            frame = 0;
            observer?.disconnect();
            observer = undefined;
            window.removeEventListener('resize', schedule);
            window.removeEventListener('scroll', schedule, { capture: true });
        }
    };
};


export { follow };
