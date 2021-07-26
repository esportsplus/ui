import { directive } from 'ui/lib';

let directives = {
        'hover': {
            bubble: false,
            fn: directive.dispatch
        },
        'stophover': {
            bubble: false
        }
    },
    rootkey = 'root.hover';


directive.addEventListener('mouseenter', directive.listener({ directives, rootkey }), {
    capture: true,
    passive: true
});

directive.addEventListener('mouseleave', directive.listener({ directives, rootkey }), {
    capture: true,
    passive: true
});
