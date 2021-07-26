import { directive, dom, node } from 'ui/lib';


let reader = new FileReader();


const update = function() {
    let file = this.element.files[0],
        target = this.get('refs.upload.update');

    if (!target) {
        return;
    }

    reader.onloadend = () => {
        dom.read(() => {
            let image = reader.result;

            dom.update(() => {
                if (target.tagName === 'IMG') {
                    node.attribute(target, { 'src': image });
                }
                else {
                    node.style(target, { 'backgroundImage': `url(${image})` });
                }
            });
        });
    };

    if (file) {
        reader.readAsDataURL(file);
    }
};


directive.on('upload.update', update);
