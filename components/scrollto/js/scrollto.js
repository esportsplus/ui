import { directive, dom, emitter, node } from 'ui/lib';


let container,
    ref = { mount: 'scrollto.mount' };


function getOffsetTop(element) {
    let distance = 0;

    if (element.offsetParent) {
        do {
            distance += element.offsetTop;
            element   = element.offsetParent;
        } while (element);
    }

    return (distance < 0) ? 0 : distance;
}


const mount = () => {
    container = (dom.ref(ref.mount) || {}).element || undefined;
};

const scrollTo = function(e) {
    let target = this.refs.scrollto;

    if (!container || !target) {
        if (!container) {
            directive.off('scrollto', scrollTo);
        }

        return;
    }

    // When Used With Hidden Frames ScrollTop Is Set To 0
    dom.read(() => {
        let scrollTop = getOffsetTop(target);

        dom.update(() => {
            node.attribute(container, { scrollTop });
        });
    });
};


directive.on('scrollto', scrollTo);
emitter.on('components.mount', mount);
