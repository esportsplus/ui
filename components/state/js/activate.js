import { state } from 'ui/components';
import { directive, dom } from 'ui/lib';


const activate = function() {
    dom.update(() => {
        state.activate( this.refs.activate || this.element );
    });
};


directive.on('activate', activate);
