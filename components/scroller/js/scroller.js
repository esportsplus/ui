import { directive, dom, emitter, node } from 'ui/lib';


let cache = new WeakMap(),
    ref = { mount: 'scroller.center' },
    scroll = {
        multiplier: 32,
        threshold: 32
    };


const mount = () => {
    let elements = dom.element(ref.mount, true) || [];

    for (let i = 0, n = elements.length; i < n; i++) {
        let element = elements[i],
            scrollLeft;

        if (!element) {
            return;
        }

        dom.read(() => {
            scrollLeft = (element.scrollWidth - element.clientWidth) / 2;

            if (scrollLeft < 1) {
                return;
            }

            dom.update(() => {
                node.attribute(element, { scrollLeft });
            });
        });
    }
};

const scroller = function(e) {
    let element = this.element,
        threshold = cache.get(element) || scroll.threshold;

    if (threshold <= scroll.threshold) {
        e.preventDefault();
        e.stopPropagation();
    }

    dom.read(() => {
        let scrollLeft = element.scrollLeft - (Math.max(-1, Math.min(1, (- e.deltaY / 3))) * scroll.multiplier),
            scrollLeftMax = element.scrollWidth - element.clientWidth;

        // Scroll Up ( Left )
        if ((- e.deltaY / 3) === 1) {
            if (element.scrollLeft < 1) {
                return cache.set(element, ++threshold);
            }

            if (scrollLeft < 1) {
                scrollLeft = 0;
            }
        }
        // Scroll Down ( Right )
        else {
            if (element.scrollLeft > (scrollLeftMax - 1)) {
                return cache.set(element, ++threshold);
            }

            if (scrollLeft > scrollLeftMax) {
                scrollLeft = scrollLeftMax;
            }
        }

        // Valid Scroll Reset Threshold
        cache.set(element, 1);

        dom.update(() => {
            node.attribute(element, { scrollLeft });
        });
    });
};

directive.on('scroller', scroller);
emitter.on('components.mount', mount);
