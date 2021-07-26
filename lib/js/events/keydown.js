import { directive } from 'ui/lib';


let directives = {
        'keydown': {
            fn: directive.dispatch
        }
    },
    rootkey = 'root.keydown';


directive.addEventListener('keydown', directive.listener({ directives, rootkey }), {
    capture: true
});
