import { dom, emitter } from 'ui/lib';


let ref = { mount: 'scrollbar.width.mount' },
    root = document.body;


const mount = () => {
    let container = dom.ref(ref.mount, true);

    if (!container) {
        return;
    }

    dom.read(() => {
        let width = container.offsetWidth - container.clientWidth;

        if (width && width !== 17) {
            dom.update(() => {
                root.style.setProperty('--scrollbar-width', `${width}px`);
            });
        }
    });
};


emitter.on('components.mount', mount);
