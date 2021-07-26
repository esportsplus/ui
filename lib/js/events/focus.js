import { directive } from 'ui/lib';


let directives = {
        'focus': {
            fn: directive.dispatch
        },
        'focusinout': {
            fn: directive.dispatch
        },
        'stopfocus': {
            bubble: false
        }
    },
    rootkey = 'root.focus';


directive.addEventListener('focus', directive.listener({ directives, rootkey }), {
    capture: true
});
