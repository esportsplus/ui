import { directive, dom, node } from 'ui/lib';


let cache = new WeakMap();


const move = function(e) {
    dom.read(() => {
        let settings = cache.get(this.element);

        if (!settings || !settings.mouseDown || this.element.scrollTopMax + this.element.scrollLeftMax === 0) {
            return;
        }

        dom.update(() => {
            node.attribute(this.element, {
                scrollLeft: settings.scrollLeft - (((e.pageX || e.touches[0].pageX) - this.element.offsetLeft) - settings.startX),
                scrollTop: settings.scrollTop - (((e.pageY || e.touches[0].pageY) - this.element.offsetTop) - settings.startY)
            });
        });
    });
};

const start = function(e) {
    dom.read(() => {
        cache.set(this.element, {
            mouseDown: true,
            scrollLeft: this.element.scrollLeft,
            scrollTop: this.element.scrollTop,
            startX: (e.pageX || e.touches[0].pageX) - this.element.offsetLeft,
            startY: (e.pageY || e.touches[0].pageY) - this.element.offsetTop,
            element: this
        });
    });
};

const stop = function() {
    dom.read(() => {
        cache.set(this.element, {
            mouseDown: false,
            scrollLeft: 0,
            scrollTop: 0,
            startX: 0,
            startY: 0
        });
    });
};


directive.on('drag.move',  move);
directive.on('drag.start', start);
directive.on('drag.stop',  stop);
