import { directive } from 'ui/lib';


let directives = {
        'mousedown': {
            fn: directive.dispatch
        },
        'stopmousedown': {
            bubble: false
        }
    },
    rootkey = 'root.mousedown';


directive.addEventListener('mousedown', directive.listener({ directives, rootkey }), {
    capture: true,
    passive: true
});
