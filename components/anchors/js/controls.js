import { state } from 'ui/components';
import { directive, dom } from 'ui/lib';


const controls = function() {
    dom.read(() => {
        let container = this.element,
            method = container.scrollTop > 100 ? 'activate' : 'deactivate',
            target = this.refs.controls;

        if (!target) {
            return;
        }

        dom.update(() => {
            state[method](target);
        });
    }); 
};


directive.on('controls', controls);
