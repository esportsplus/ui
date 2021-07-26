import { directive, throttle } from 'ui/lib';


let directives = {
        'scroll': {
            fn: directive.dispatch
        },
        'stopscroll': {
            bubble: false
        }
    },
    rootkey = 'root.scroll';


directive.addEventListener('scroll', throttle(directive.listener({ directives, rootkey }), 16), {
    capture: true,
    passive: true
});
