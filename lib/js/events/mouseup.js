import { directive } from 'ui/lib';


let directives = {
        'mouseup': {
            fn: directive.dispatch
        },
        'stopmouseup': {
            bubble: false
        }
    },
    rootkey = 'root.mouseup';


directive.addEventListener('mouseup', directive.listener({ directives, rootkey }), {
    capture: true,
    passive: true
});
