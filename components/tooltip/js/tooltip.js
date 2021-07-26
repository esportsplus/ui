import { state } from 'ui/components';
import { directive, dom } from 'ui/lib';


// Active Tooltips
let tooltips = {
        // Should Only Be Deactivated On Root Click
        // - Contains Nested Tooltips
        elevated: [],
        // All Other Tooltips
        normal: []
    };


function deactivate(key) {
    if (tooltips[key].length === 0) {
        return;
    }

    let deactivate = tooltips[key].splice(0, tooltips[key].length);

    dom.update(() => {
        state.deactivate(deactivate);
    });
}


const detoggle = () => {
    deactivate('normal');
};

const root = () => {
    deactivate('elevated');
    deactivate('normal');
};

// For Tooltips That Should Toggle When Clicked ( Ex: Select Field Options )
const toggle = function(e) {
    tooltip.call(this, e, true);
};

const tooltip = function(e, toggle = false) {
    let active = state.active(this.element),
        elevated = this.get('tooltip.elevated') || false,
        target = e.target,
        trigger = this.element,
        type = e.type;

    if (['click', 'focus', 'mouseenter'].includes(type)) {
        if (active && !elevated && !toggle && trigger !== target) {
            return;
        }
    }
    else if (['blur', 'mouseleave'].includes(type)) {
        if (trigger.contains(target) && trigger !== target) {
            return;
        }
    }

    if (type === 'click') {
        deactivate('normal');

        if (active) {
            if (elevated) {
                deactivate('elevated');
            }
        }
        else {
            dom.update(() => {
                state.activate(trigger);
                tooltips[elevated ? 'elevated' : 'normal'].push(trigger);
            });
        }
    }
    else {
        directive.dispatch('toggle', e, this);
    }
};


directive.on('root.click', root);
directive.on('tooltip', tooltip);
directive.on('tooltip.detoggle', detoggle);
directive.on('tooltip.toggle', toggle);
