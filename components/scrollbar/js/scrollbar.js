import { directive, dom, emitter, node } from 'ui/lib';


let modifier = 'scrollbar--hidden',
    ref = { mount: 'scrollbar.mount' };


const mount = () => {
    let elements = dom.ref(ref.mount, true) || [];

    for (let i = 0, n = elements.length; i < n; i++) {
        scrollbar.call(elements[i]);
    }
};

const scrollbar = function() {
    let scrollbar = this.refs.scrollbar || false;

    if (!scrollbar) {
        return;
    }

    dom.read(() => {
        let height = (this.element.clientHeight / this.element.scrollHeight) * 100,
            translate = `translate3d(0, ${(this.element.scrollTop / this.element.clientHeight) * 100}%, 0)`;

        dom.update(() => {
            scrollbar.classList.toggle(modifier, height >= 100);
            node.style(scrollbar, {
                '-webkit-transform': translate,
                '-ms-transform': translate,
                'transform': translate,
                'height': `${height}%`
            });
        });
    });
};


directive.on('scrollbar', scrollbar);
emitter.on('components.mount', mount);
