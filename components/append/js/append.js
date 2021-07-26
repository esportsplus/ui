import { directive, dom, node } from 'ui/lib';


let id = 0;


const append = function(e) {
    e.preventDefault();

    let { container, template } = this.refs.append;

    if (!container || !template) {
        return;
    }

    dom.update(() => {
        node.html(container, {
            append: template.replace(new RegExp('{id}', 'g'), id++)
        });
    });
};


directive.on('append', append);
