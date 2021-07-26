import { directive, dom, emitter, node } from 'ui/lib';


let elements = [],
    ref = { mount: 'countdown' };


function countdown(now) {
    let t = this.deadline - now,
        text = '',
        time = {
            day: Math.floor(t / (60 * 60 * 24)),
            hour: Math.floor((t % (60 * 60 * 24)) / (60 * 60)),
            minute: Math.floor((t % (60 * 60)) / 60),
            second: Math.floor(t % 60)
        };

    ['day', 'hour', 'minute', 'second'].foreach((key) => {
        text += ` ${time[key]} ${key[0].toUpperCase() + key.slice(1)}${time[key] === 1 ? '' : 's'}`;
    });

    dom.update(() => {
        node.text(this.element, text);
    });
};

function frame() {
    dom.read(() => {
        let now = Date.now() / 1000;

        for (let i = 0, n = elements.length; i < n; i++) {
            let cache = elements[i];

            if (cache.element) {
                countdown.call(cache, now);
            }
            else {
                elements.splice(i, 1);
            }
        }

        if (elements.length) {
            frame();
        }
    });
}


const mount = () => {
    elements = dom.ref(ref.mount, true) || [];

    if (elements.length) {
        frame();
    }
};


emitter.on('components.mount', mount);
