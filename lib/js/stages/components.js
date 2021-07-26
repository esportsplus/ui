import { emitter } from 'ui/lib';


const mount = () => {
    // Add 'mounted' To The End Of The Components Mount Loop
    emitter.once('components.mount', () => {
        emitter.dispatch('components.mounted');
    });

    emitter.dispatch('components.mount');
};


emitter.on('dom.refs.ready', mount);
