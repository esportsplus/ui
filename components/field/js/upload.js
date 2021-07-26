import { directive, dom, node } from 'ui/lib';


const upload = function() {
    dom.read(() => {
        let mask = this.refs.mask,
            name = this.element.files[0].name;

        dom.update(() => {
            node.html(mask, `<span>${name}</span>`);
        });
    });
};


directive.on('field.upload', upload);
