import { directive, dom, node } from 'ui/lib';


const password = function() {
    dom.read(() => {
        let tag = this.refs.tag,
            type = tag.type === 'password' ? 'text' : 'password';

        dom.update(() => {
            node.attribute(tag, { type });
        });
    });
};


directive.on('field.password', password);
