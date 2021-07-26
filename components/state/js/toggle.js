import { state } from 'ui/components';
import { directive, dom } from 'ui/lib';


const toggle = function(e) {
    dom.read(() => {
        let target = this.refs.toggle || this.element,
            trigger = this.element,
            type = e.type;

        if (state.active(target) || ['blur', 'mouseleave'].includes(type)) {
            type = 'deactivate';
        }
        else if (['focus', 'mouseenter'].includes(type)) {
            type = 'activate';
        }
        else {
            type = 'toggle';
        }

        dom.update(() => {
            state[type](target);

            if (target !== trigger) {
                state[type](trigger);
            }
        });
    });
};


directive.on('toggle', toggle);
