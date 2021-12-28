import { state } from 'ui/components';
import { directive, dom, node } from 'ui/lib';


let classname = 'accordion';


function activate(target, trigger) {
    // Deactivate Siblings + Activate Accordion/Trigger
    let targets  = node.siblings(target, state.active),
        triggers = node.siblings(trigger, state.active);

    // Deal With Nested Accordions
    let element = target.parentNode,
        parents = [];

    while (element.classList !== undefined) {
        if (element.classList.contains(classname)) {
            parents.push(element);
        }

        element = element.parentNode;
    }

    dom.update(() => {
        state.deactivate(triggers.concat(targets));
        // state.activate([trigger, target]);
        state.activate(target);

        node.style(targets, { maxHeight: '0px' });
        node.style(target,  { maxHeight: `${target.scrollHeight}px` });

        if (parents.length > 0) {
            node.style(parents, { maxHeight: `999px` });
        }
    });
}

function deactivate(target, trigger) {
    dom.update(() => {
        state.deactivate([trigger, target]);
        node.style(target, { maxHeight: '0px' });
    });
}


const accordion = function() {
    let target = this.refs.accordion,
        trigger = this.element;

    if (!target) {
        return;
    }

    dom.read(() => {
        if (state.active(target)) {
            deactivate(target, trigger);
        }
        else {
            activate(target, trigger);
        }
    });
};


directive.on('accordion', accordion);
