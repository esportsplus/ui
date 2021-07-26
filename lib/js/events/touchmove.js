import { directive } from 'ui/lib';


let directives = {
        'stoptouchmove': {
            bubble: false
        },
        'touchmove': {
            fn: directive.dispatch
        }
    },
    rootkey = 'root.touchmove';


directive.addEventListener('touchmove', directive.listener({ directives, rootkey }), {
    capture: true
});
