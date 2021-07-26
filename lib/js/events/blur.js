import { directive } from 'ui/lib';


let directives = {
        'blur': {
            fn: directive.dispatch
        },
        'focusinout': {
            fn: directive.dispatch
        },
        'stopblur': {
            bubble: false
        }
    },
    rootkey = 'root.blur';


directive.addEventListener('blur', directive.listener({ directives, rootkey }), {
    capture: true
});
