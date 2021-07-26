import { state } from 'ui/components';
import { directive, dom } from 'ui/lib';


const deactivate = function() {
    dom.update(() => {
        state.deactivate( this.refs.deactivate || this.element );
    });
};


directive.on('deactivate', deactivate);
