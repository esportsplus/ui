import { reactive } from '@esportsplus/reactivity';
import { observer } from '~/shared/resize';


// 'current' marks the last section scrolled past the top; 'visible' marks every section on screen.
type Mode = 'current' | 'visible';

type Spy = ReturnType<typeof spy>;


const LOCK_TIMEOUT = 1000;

const OVERFLOW = /auto|overlay|scroll/;

const TOLERANCE = 8;


function container(element: Element) {
    let parent = element.parentElement;

    while (parent) {
        if (OVERFLOW.test(getComputedStyle(parent).overflowY) && parent.scrollHeight > parent.clientHeight) {
            return parent;
        }

        parent = parent.parentElement;
    }

    return (document.scrollingElement ?? document.documentElement) as HTMLElement;
}


// Tracks which of the elements with these ids are in view, within whichever ancestor scrolls them. Navigating locks
// the active range on the target until the smooth scroll settles, so sections passed on the way don't flash active.
const spy = (ids: string[], mode: Mode = 'current') => {
    let frame = 0,
        locked = false,
        root: HTMLElement | undefined,
        state = reactive({ end: 0, start: 0 }),
        timer: ReturnType<typeof setTimeout> | undefined;

    function highlight(start: number, end: number) {
        if (state.start !== start) {
            state.start = start;
        }

        if (state.end !== end) {
            state.end = end;
        }
    }

    function lock() {
        clearTimeout(timer);
        locked = true;
        timer = setTimeout(unlock, LOCK_TIMEOUT);
    }

    function measure() {
        if (!root || locked) {
            return;
        }

        let elements = sections();

        if (!elements.length) {
            return;
        }

        let bounds = root === document.scrollingElement
                ? { bottom: window.innerHeight, top: 0 }
                : root.getBoundingClientRect(),
            current = elements[0].index,
            end = -1,
            rects = elements.map((section) => section.element.getBoundingClientRect()),
            start = -1;

        for (let i = 0, n = elements.length; i < n; i++) {
            let line = bounds.top + (parseFloat(getComputedStyle(elements[i].element).scrollMarginTop) || 0) + TOLERANCE,
                rect = rects[i];

            if (rect.top <= line) {
                current = elements[i].index;
            }

            if (mode === 'visible' && rect.top < bounds.bottom && (i + 1 < n ? rects[i + 1].top : rect.bottom) > line) {
                if (start === -1) {
                    start = elements[i].index;
                }

                end = elements[i].index;
            }
        }

        if (root.scrollTop + root.clientHeight >= root.scrollHeight - 2) {
            current = elements[elements.length - 1].index;
        }

        if (start === -1) {
            highlight(current, current);
        }
        else {
            highlight(start, end);
        }
    }

    function schedule() {
        if (frame) {
            return;
        }

        frame = requestAnimationFrame(() => {
            frame = 0;
            measure();
        });
    }

    function scrollend() {
        if (locked) {
            unlock();
        }
    }

    function sections() {
        let elements: { element: HTMLElement; index: number }[] = [];

        for (let i = 0, n = ids.length; i < n; i++) {
            let element = document.getElementById(ids[i]);

            if (element) {
                elements.push({ element, index: i });
            }
        }

        return elements;
    }

    function unlock() {
        clearTimeout(timer);
        locked = false;
        schedule();
    }

    return {
        active: (index: number) => state.start <= index && index <= state.end,
        connect: () => {
            let elements = sections();

            if (!elements.length) {
                return () => {};
            }

            root = container(elements[0].element);

            let resize = observer(schedule),
                target: EventTarget = root === document.scrollingElement ? window : root;

            target.addEventListener('scroll', schedule, { passive: true });
            target.addEventListener('scrollend', scrollend);
            resize.observe(root);

            for (let i = 0, n = elements.length; i < n; i++) {
                resize.observe(elements[i].element);
            }

            measure();

            return () => {
                cancelAnimationFrame(frame);
                clearTimeout(timer);
                resize.disconnect();
                target.removeEventListener('scroll', schedule);
                target.removeEventListener('scrollend', scrollend);
                frame = 0;
                root = undefined;
            };
        },
        navigate: (index: number) => {
            let element = document.getElementById(ids[index]);

            if (!element) {
                return;
            }

            lock();
            highlight(index, index);

            if (!element.hasAttribute('tabindex')) {
                element.setAttribute('tabindex', '-1');
            }

            element.focus({ preventScroll: true });
            element.scrollIntoView({
                behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
                block: 'start'
            });
        }
    };
};


export default spy;
export type { Mode, Spy };
