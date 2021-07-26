import { state } from 'ui/components';
import { directive, dom, emitter } from 'ui/lib';


let elements = [],
    ref = { mount: 'filter' };


const filter = function() {
    let activate = [],
        deactivate = [],
        filtering = elements[this.filter] || [],
        value = this.element.value;

    if (value === 'all') {
        activate = filtering;
    }
    else {
        for (let i = 0, n = filtering.length; i < n; i++) {
            let element = filtering[i],
                ref = dom.ref(element);

            if (ref.get('filter.value') == value) {
                activate.push(element);
            }
            else {
                deactivate.push(element);
            }
        }
    }

    dom.update(() => {
        state.deactivate(deactivate);
        state.activate(activate);
    });
};

const mount = () => {
    elements = dom.ref(ref.mount, true) || [];
}


directive.on('filter', filter);
emitter.on('components.mount', mount);
