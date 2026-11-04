import { dispatch } from '~/shared/dispatch';


type Handler = (entries: IntersectionObserverEntry[]) => void;

// Against the document's viewport only: an observer with its own root can't be shared across roots.
type Options = Omit<IntersectionObserverInit, 'root'>;

type Shared = {
    handlers: Map<Element, Set<Handler>>;
    observer: IntersectionObserver;
};


// One observer per distinct margin and threshold, dropped once it observes nothing.
let shared = new Map<string, Shared>();


function key({ rootMargin = '0px', threshold = 0 }: Options) {
    return `${rootMargin}|${typeof threshold === 'number' ? threshold : threshold.join(',')}`;
}


// Every intersection against the viewport goes through one IntersectionObserver per option set. Observing an element
// another handler already observes with the same options re-observes it, so both hear its current state again, as a
// second observer's first delivery would.
const observeIntersection = (element: Element, handler: Handler, options: Options = {}) => {
    let id = key(options),
        group = shared.get(id);

    if (!group) {
        let handlers = new Map<Element, Set<Handler>>();

        shared.set(id, group = {
            handlers,
            observer: new IntersectionObserver((entries) => dispatch(handlers, entries), options)
        });
    }

    let { handlers, observer } = group,
        listeners = handlers.get(element);

    if (listeners) {
        observer.unobserve(element);
    }
    else {
        handlers.set(element, listeners = new Set());
    }

    listeners.add(handler);
    observer.observe(element);

    return () => {
        if (!listeners.delete(handler) || listeners.size) {
            return;
        }

        handlers.delete(element);
        observer.unobserve(element);

        if (!handlers.size) {
            observer.disconnect();
            shared.delete(id);
        }
    };
};

// Calls 'show' once, the first time the element these attributes are spread on comes into view: entrances that should
// play where someone can see them rather than off screen.
const onceVisible = (show: VoidFunction, options?: Options) => {
    let release: VoidFunction | undefined;

    function stop() {
        release?.();
        release = undefined;
    }

    return {
        onconnect: (element: HTMLElement) => {
            stop();
            release = observeIntersection(element, (entries) => {
                if (!entries.some((entry) => entry.isIntersecting)) {
                    return;
                }

                stop();
                show();
            }, options);
        },
        ondisconnect: stop
    };
};


export { observeIntersection, onceVisible };
