import { directive } from 'ui/lib';


let directives = {
        'stoptouchend': {
            bubble: false
        },
        'touchend': {
            fn: directive.dispatch
        }
    },
    rootkey = 'root.touchend';


directive.addEventListener('touchend', directive.listener({ directives, rootkey }), {
    capture: true,
    passive: true
});
