/**
 *------------------------------------------------------------------------------
 *
 *  Simplify Handling Field States
 *
 *  Modifiers Were Originally Dependent On Form Element ':focus' ':checked'
 *  Selectors To Modify States Resulting In Long Selectors Once Compiled.
 *
 *  JS Unifies States By Shifting Modifiers To Parent
 *  - Also Enables Sticking To A Unified State System Across All Modules!
 *
 */

import { state } from 'ui/components';
import { directive, dom, emitter, node } from 'ui/lib';


let active = new WeakMap(),
    ref = { mount: 'field.checkbox.mount' };


const checkbox = function() {
    let field = this.element,
        tag = this.get('refs.field.tag');

    if (!field || !tag) {
        return;
    }

    dom.update(() => {
        if (tag.type === 'radio') {
            if (!tag.checked) {
                return;
            }

            let fields = (active.get(tag.form) || {});

            state.activate(field);
            state.deactivate(fields[tag.name]);

            fields[tag.name] = field;

            active.set(tag.form, fields);
        }
        else {
            state[tag.checked ? 'activate' : 'deactivate'](field);
        }
    });
};

const mount = () => {
    let elements = dom.ref(ref.mount, true) || [];

    for (let i = 0, n = elements.length; i < n; i++) {
        checkbox.call(elements[i]);
    }
};


directive.on('field.checkbox', checkbox);
emitter.on('components.mount', mount);
