import { emitter } from 'ui/lib';


const ready = () => {
    emitter.dispatch('dom.ready');
};


if (['complete', 'interactive', 'loaded'].includes(document.readyState)) {
    ready();
}
else {
    document.addEventListener('DOMContentLoaded', ready);
}
