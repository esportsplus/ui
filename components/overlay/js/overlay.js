/**
 *------------------------------------------------------------------------------
 *
 *  Reusable Overlay Functionality ( Drawers, Modals )
 *
 *  container
 *      modifier        Create Modifier Classname Using Value Provided
 *                      By 'child.attribute.modifier' ( fn )
 *      modifiers       Modifiers Applied To Overlay During Activation  ( arr )
 *  directives
 *      close           Close Overlay + Children ( str )
 *      trigger         Trigger Opening/Closing An Overlay Child ( str )
 *
 */

import { state } from 'ui/components';
import { directive, dom, emitter, node } from 'ui/lib';


const overlay = (container, directives) => {
    container = Object.assign(container, dom.ref(container.ref), { modifiers: [] });

    if (!container.element) {
        return;
    }

    function activate(target) {
        let properties = dom.ref(target),
            classname = {
                [container.modifiers]: 'remove'
            },
            modifier = properties.modifier ? container.modifier( properties.modifier ) : null;

        if (modifier) {
            classname[modifier] = 'add';
        }

        dom.update(() => {
            container.element.classList.remove(...container.modifiers);
            container.element.classList.add(modifier);
            container.modifiers = [modifier];

            state.activate([container.element, target]);
            state.deactivate(node.siblings(target, (s) => state.active(s)));

            emitter.dispatch('overlay.activated');
        });
    }

    function deactivate() {
        dom.read(() => {
            let children = container.element.children,
                deactivate = [];

            for (let i = 0, n = children.length; i < n; i++) {
                let child = children[i];

                if (state.active(child)) {
                    deactivate.push(child);
                }
            }

            dom.update(() => {
                state.deactivate(deactivate.concat([container.element]));
                emitter.dispatch('overlay.deactivated');
            });
        });
    }


    const close = (e) => {
        if (!state.active(container.element) || (e && e.target !== container.element)) {
            return;
        }

        deactivate();
    };

    const trigger = function() {
        let target = this.refs[directives.trigger] || false;

        if (target && !state.active(target)) {
            activate(target);
        }
        else {
            close();
        }
    };


    directive.on(directives.close, close);
    directive.on(directives.trigger, trigger);
};


export default overlay;
