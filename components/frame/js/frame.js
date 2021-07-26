import { state } from 'ui/components';
import { directive, dom, node } from 'ui/lib';


const frame = function() {
    dom.read(() => {
        let activate = [],
            deactivate = [],
            targets = this.refs.frame,
            trigger = this.element;

        if (!targets) {
            return;
        }
        else if (!Array.isArray(targets)) {
            targets = [targets];
        }

        for (let i = 0, n = targets.length; i < n; i++) {
            let target = targets[i];

            if (state.active(target)) {
                continue;
            }

            activate.push(target);
            deactivate = deactivate.concat(node.siblings(target));
        }

        if (this.get('frame.ignore') !== true) {
            activate.push(trigger);
            deactivate = deactivate.concat(node.siblings(trigger));
        }

        dom.update(() => {
            state.deactivate(deactivate);
            state.activate(activate);
        });
    });
};


directive.on('frame', frame);
