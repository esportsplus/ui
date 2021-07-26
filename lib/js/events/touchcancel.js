import { directive } from 'ui/lib';


let directives = {
        'stoptouchcancel': {
            bubble: false
        },
        'touchcancel': {
            fn: directive.dispatch
        }
    },
    rootkey = 'root.touchcancel';


directive.addEventListener('touchcancel', directive.listener({ directives, rootkey }), {
    capture: true,
    passive: true
});
