import { directive } from 'ui/lib';


let directives = {
        'stoptouchstart': {
            bubble: false
        },
        'touchstart': {
            fn: directive.dispatch
        }
    },
    rootkey = 'root.touchstart';


directive.addEventListener('touchstart', directive.listener({ directives, rootkey }), {
    capture: true,
    passive: true
});
