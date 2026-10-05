type Handler = (entries: ResizeObserverEntry[]) => void;

type Observation = {
    // The size 'change' last received, and the one the next frame applies.
    applied?: Size;
    change: (size: Size, element: HTMLElement) => void;
    element: HTMLElement;
    pending?: Size;
    vertical: boolean;
};

type Observer = {
    disconnect: VoidFunction;
    observe: (element: Element, options?: ResizeObserverOptions) => void;
    unobserve: (element: Element) => void;
};

type Size = { height: number; width: number };


// Elements connected this tick, measured together once it ends, and size changes waiting for the next frame.
let connecting = new Set<Observation>(),
    frame = 0,
    handlers = new WeakMap<Element, Set<Handler>>(),
    queued = new Set<Observation>(),
    shared: ResizeObserver | undefined;


// One callback per delivery: each handler receives the entries of its own elements together, as from a ResizeObserver
// of its own. An element unobserved by an earlier handler in the same delivery is not reported.
function dispatch(entries: ResizeObserverEntry[]) {
    let batches = new Map<Handler, ResizeObserverEntry[]>();

    for (let i = 0, n = entries.length; i < n; i++) {
        let entry = entries[i],
            listeners = handlers.get(entry.target);

        if (!listeners) {
            continue;
        }

        for (let handler of listeners) {
            let batch = batches.get(handler);

            if (batch) {
                batch.push(entry);
            }
            else {
                batches.set(handler, [entry]);
            }
        }
    }

    for (let [handler, batch] of batches) {
        let live = batch.filter((entry) => handlers.get(entry.target)?.has(handler));

        if (live.length) {
            handler(live);
        }
    }
}

function equal(a: Size | undefined, b: Size | undefined) {
    return a?.height === b?.height && a?.width === b?.width;
}

// Reads every element connected this tick before any change writes, so a tick costs one layout however many connect.
function flush() {
    let observations = [...connecting],
        sizes = observations.map(({ element }) => measure(element));

    connecting.clear();

    for (let i = 0, n = observations.length; i < n; i++) {
        let { height, vertical, width } = sizes[i],
            observation = observations[i];

        observation.applied = { height, width };
        observation.vertical = vertical;

        // As a ResizeObserver's first delivery: an element without a box has nothing to report yet.
        if (height || width) {
            observation.change(observation.applied, observation.element);
        }
    }
}

// The border box, as a ResizeObserver delivers it. A transform (a collapsed scale) skews the client rect, so the
// layout box stands in, rounded, once the two disagree.
function measure(element: HTMLElement) {
    let height = element.offsetHeight,
        rect = element.getBoundingClientRect(),
        vertical = getComputedStyle(element).writingMode !== 'horizontal-tb',
        width = element.offsetWidth;

    if (Math.abs(rect.height - height) < 1 && Math.abs(rect.width - width) < 1) {
        return { height: rect.height, vertical, width: rect.width };
    }

    return { height, vertical, width };
}

function render() {
    let observations = [...queued];

    frame = 0;
    queued.clear();

    for (let i = 0, n = observations.length; i < n; i++) {
        let observation = observations[i],
            size = observation.pending;

        if (size && !equal(size, observation.applied)) {
            observation.applied = size;
            observation.change(size, observation.element);
        }
    }
}


// Every resize in the library goes through one shared ResizeObserver. Observing an element another handler already
// observes delivers its current size to both again, as a second observer's first delivery would.
const observe = (element: Element, handler: Handler, options?: ResizeObserverOptions) => {
    let listeners = handlers.get(element);

    if (!listeners) {
        handlers.set(element, listeners = new Set());
    }

    listeners.add(handler);
    (shared ??= new ResizeObserver(dispatch)).observe(element, options);

    return () => unobserve(element, handler);
};

// A ResizeObserver's interface over the shared one, for handlers watching several elements at once.
const observer = (handler: Handler): Observer => {
    let elements = new Set<Element>();

    return {
        disconnect: () => {
            for (let element of elements) {
                unobserve(element, handler);
            }

            elements.clear();
        },
        observe: (element: Element, options?: ResizeObserverOptions) => {
            elements.add(element);
            observe(element, handler, options);
        },
        unobserve: (element: Element) => {
            elements.delete(element);
            unobserve(element, handler);
        }
    };
};

// Observe natural content, separately from the box whose height CSS animates. The size on connect is measured before
// the frame paints, so the first paint is already sized and the observer's first delivery finds nothing new. Later
// changes apply in the next frame: writing inside the observer's callback would resize what it observes in the same
// frame, which the browser reports as a ResizeObserver loop.
const observeSize = (change: (size: Size, element: HTMLElement) => void) => {
    let current: Observation | undefined,
        release: VoidFunction | undefined;

    function disconnect() {
        if (current) {
            connecting.delete(current);
            queued.delete(current);
            current = undefined;
        }

        release?.();
        release = undefined;
    }

    return {
        onconnect: (element: HTMLElement) => {
            disconnect();

            let observation: Observation = current = { change, element, vertical: false };

            if (!connecting.size) {
                queueMicrotask(flush);
            }

            connecting.add(observation);
            release = observe(element, ([entry]) => {
                // Not yet measured: the flush reads a newer layout than this delivery.
                if (!entry || connecting.has(observation)) {
                    return;
                }

                let box = entry.borderBoxSize[0],
                    vertical = observation.vertical,
                    size = {
                        height: vertical ? box.inlineSize : box.blockSize,
                        width: vertical ? box.blockSize : box.inlineSize
                    };

                observation.pending = size;

                if (equal(size, observation.applied)) {
                    queued.delete(observation);
                    return;
                }

                queued.add(observation);
                frame ||= requestAnimationFrame(render);
            }, { box: 'border-box' });
        },
        ondisconnect: disconnect
    };
};

const unobserve = (element: Element, handler: Handler) => {
    let listeners = handlers.get(element);

    if (!listeners?.delete(handler)) {
        return;
    }

    if (!listeners.size) {
        handlers.delete(element);
        shared?.unobserve(element);
    }
};


export { observe, observer, observeSize };
export type { Observer, Size };
