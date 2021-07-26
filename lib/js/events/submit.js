import { directive } from 'ui/lib';


let directives = {
        'stopsubmit': {
            bubble: false
        },
        'submit': {
            fn: directive.dispatch
        }
    },
    rootkey = 'root.submit';


directive.addEventListener('submit', directive.listener({ directives, rootkey }), {
    capture: true
});
