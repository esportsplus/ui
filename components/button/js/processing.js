import { directive, dom } from 'ui/lib';


let modifier = 'button--processing';


const processing = function(e) {
    dom.update(() => {
        e.submitter.classList.add(modifier);
    });
};


directive.on('processing', processing);
