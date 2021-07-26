import { directive, dom, emitter } from 'ui/lib';


let preload = new WeakMap(),
    ref = { mount: 'autoplay.video' };


function autoplay(entry) {
    dom.update(() => {
        if (!entry.target.src) {
            autoplay(entry);
        }

        if (entry.isIntersecting) {
            entry.target.muted = true;
            entry.target.play();
        }
        else {
            entry.target.pause();
        }
    });
}


const hover = function(e) {
    let type = e.type,
        video = this.element;

    dom.update(() => {
        if (type === 'mouseenter') {
            video.muted = false;
            video.play();
        }
        else {
            video.pause();
        }
    });
};

const unmute = function(e) {
    let type = e.type,
        video = this.element;

    dom.update(() => {
        if (type === 'mouseenter') {
            video.controls = true;
            video.muted = false;
        }
        else {
            video.controls = false;
            video.muted = true;
        }

        if (video.paused) {
            video.play();
        }
    });
};

const mount = () => {
    let elements = dom.ref(ref.mount, true) || [],
        observer = new IntersectionObserver(function(videos, observer) {
            for (let i = 0, n = videos.length; i < n; i++) {
                autoplay(videos[i]);
            }
        });

    for (let i = 0, n = elements.length; i < n; i++) {
        let context = elements[i];

        preload.set(context.element, { src: context.src });
        observer.observe(context.element);
    }
};


directive.on('autoplay.hover', hover);
directive.on('unmute.hover', unmute);
emitter.on('components.mount', mount);
