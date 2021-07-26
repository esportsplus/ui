import { directive, dom, node } from 'ui/lib';


let transform = {
        multiplier: 4,
        perspective: '400px'
    };


function mouseleave(options) {
    dom.update(() => {
        node.style(options.content, { transform: `perspective(${options.perspective}) rotateY(0deg) rotateX(0deg)` });
    });
}

function mousemove(container, e, options) {
    dom.read(() => {
        let center = {
                x: container.offsetLeft + (container.clientWidth / 2),
                y: container.offsetTop + (container.clientHeight / 2)
            },
            percent = {
                x: (e.pageX - center.x) / (container.clientWidth / 2),
                y: -((e.pageY - center.y) / (container.clientHeight / 2))
            };

        dom.update(() => {
            node.style(options.content, {
                transform: `perspective(${options.perspective}) rotateY(${percent.x * options.multiplier}deg) rotateX(${percent.y * options.multiplier}deg)`
            });
        });
    });
}


const hover = function(e) {
    let container = this.element,
        options = Object.assign({ content: ((this.refs || {}).card || {}).container || container }, transform, this.card),
        type = e.type;

    if (type === 'mouseleave') {
        mouseleave(options);
    }
    else if (type === 'mousemove') {
        mousemove(container, e, options)
    }
};


directive.on('card.hover', hover);
