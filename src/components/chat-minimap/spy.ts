import type { Attributes } from '@esportsplus/template';
import { span, type Range } from './range';


// Lights every turn in view as a thread scrolls: 'root' goes on the scrolling element, 'turn(item)' on each turn in it,
// and 'scrollTo' is the minimap's 'onnavigate'. 'turns' is the thread's own list, so indexes follow it as it grows.
const spy = <T>({ state, turns }: { state: Range, turns: readonly T[] }) => {
    let elements = new Map<T, HTMLElement>(),
        items = new Map<Element, T>(),
        observer: IntersectionObserver | undefined,
        // A turn asked for before it was rendered, as one just pushed is; it scrolls there once it connects.
        pending: T | undefined,
        root: HTMLElement | undefined,
        visible = new Set<Element>();

    function measure() {
        let indexes: number[] = [];

        for (let element of visible) {
            let item = items.get(element);

            if (item !== undefined) {
                indexes.push(turns.indexOf(item));
            }
        }

        // Between two turns nothing intersects; the last range holds until the next one arrives.
        let range = span(indexes);

        if (!range) {
            return;
        }

        if (state.start !== range.start) {
            state.start = range.start;
        }

        if (state.end !== range.end) {
            state.end = range.end;
        }
    }

    function reveal(element: HTMLElement) {
        if (!root) {
            return;
        }

        root.scrollTo({
            behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
            top: root.scrollTop + element.getBoundingClientRect().top - root.getBoundingClientRect().top - (parseFloat(getComputedStyle(root).scrollPaddingTop) || 0)
        });
    }

    function scrollTo(index: number) {
        let item = turns[index],
            element = elements.get(item);

        pending = undefined;

        if (element) {
            reveal(element);
        }
        else if (index >= 0 && index < turns.length) {
            pending = item;
        }
    }

    function turn(item: T): Attributes {
        return {
            onconnect: (element: HTMLElement) => {
                elements.set(item, element);
                items.set(element, item);
                observer?.observe(element);

                if (pending === item) {
                    pending = undefined;
                    reveal(element);
                }
            },
            ondisconnect: (element: HTMLElement) => {
                if (elements.get(item) === element) {
                    elements.delete(item);
                }

                items.delete(element);
                observer?.unobserve(element);

                if (visible.delete(element)) {
                    measure();
                }
            }
        };
    }

    return {
        root: {
            onconnect: (element: HTMLElement) => {
                root = element;
                // A pixel in from each edge, so the turn just scrolled past, sitting flush against the top, is out.
                observer = new IntersectionObserver((entries) => {
                    for (let i = 0, n = entries.length; i < n; i++) {
                        let entry = entries[i];

                        if (entry.isIntersecting) {
                            visible.add(entry.target);
                        }
                        else {
                            visible.delete(entry.target);
                        }
                    }

                    measure();
                }, { root: element, rootMargin: '-1px 0px' });

                // Turns can connect before the thread holding them.
                for (let target of items.keys()) {
                    observer.observe(target);
                }
            },
            ondisconnect: () => {
                observer?.disconnect();
                observer = undefined;
                pending = undefined;
                root = undefined;
                visible.clear();
            }
        } satisfies Attributes,
        scrollTo,
        turn
    };
};


export default spy;
