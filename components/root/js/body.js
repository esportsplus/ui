import { dom, emitter } from 'ui/lib';


let body = document.body,
    modifier = {
        overlay: 'body--overlay'
    };


function update(action, classname) {
    dom.update(() => {
        body.classList[action](classname);
    });
}


emitter.on('overlay.activated', () => {
    update('add', modifier.overlay);
});

emitter.on('overlay.deactivated', () => {
    update('add', modifier.overlay);
});
