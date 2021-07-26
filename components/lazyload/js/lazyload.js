import { dom, emitter } from 'ui/lib';


let classname = 'lazyloading',
    lazyload = new WeakMap(),
    ref = { mount: 'lazyload' };


const mount = () => {
    let elements = dom.ref(ref.mount, true) || [],
        observer = new IntersectionObserver(function(elements, observer) {
            for (let i = 0, n = elements.length; i < n; i++) {
                let element = elements[i],
                    target = element.target;

                dom.read(() => {
                    if (!element.isIntersecting) {
                        return;
                    }

                    dom.update(() => {
                        if (!target.src) {
                            target.src = lazyload.get(target).src || '';

                            if (target.load) {
                                target.load();
                            }
                        }

                        observer.unobserve(target);
                    });
                });
            }
        });

    for (let i = 0, n = elements.length; i < n; i++) {
        let context = elements[i];

        lazyload.set(context.element, { src: context.src });
        observer.observe(context.element);
    }
};


emitter.on('components.mount', mount);
