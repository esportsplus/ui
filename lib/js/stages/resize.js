import { emitter, throttle } from 'ui/lib';


const resize = () => {
    emitter.dispatch('window.resize');
};


window.addEventListener('resize', throttle(resize, 250));
