import { overlay } from 'ui/components';
import { emitter } from 'ui/lib';


let container = {
        modifier: (k) => `drawers--${k}`,
        ref: 'drawers.container'
    },
    directives = {
        close: 'drawers',
        trigger: 'drawer'
    };


const mount = () => {
    overlay(container, directives);
};


emitter.on('components.mount', mount);
