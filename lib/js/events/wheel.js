import { directive, throttle } from 'ui/lib';


let directives = {
        'stopwheel': {
            bubble: false
        },
        'wheel': {
            fn: directive.dispatch,
            bubble: false
        }
    },
    rootkey = 'root.wheel';


// Disabling Passive Event For Scrollers
directive.addEventListener('wheel', throttle(directive.listener({ directives, rootkey }), 16), {
    capture: true,
    passive: false
});
