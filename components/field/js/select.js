import { state } from 'ui/components';
import { directive, dom, emitter, node } from 'ui/lib';


let active = new WeakMap(),
    mounting = false,
    ref = { mount: 'field.select.mount' };


function handle(value, dispatchEvent = false) {
    let { mask, options, tag } = this.get('refs.field', {});

    if (mounting && value === undefined) {
        value = tag.value;
    }

    let activate = options[value],
        deactivate = options[active.get(tag)];

    if (activate === deactivate || !mask || options[value] === undefined || !tag) {
        return;
    }

    dom.read(() => {
        let html = activate.innerHTML;

        dom.update(() => {
            active.set(tag, value);

            state.activate(activate);
            state.deactivate(deactivate);

            node.html(mask, { inner: `<div>${html}</div>` });

            tag.value = value;

            if (dispatchEvent) {
                tag.dispatchEvent(new Event('change'));
            }
        });
    });
}

function value(options, option) {
    for (let value in options) {
        if (options[value] !== option) {
            continue;
        }

        return value;
    }

    return undefined;
}


const click = function(e) {
    if (e.target === this.element) {
        return;
    }

    handle.call(this, value(this.get('refs.field.options', {}), e.target), true);
};

const mount = () => {
    let elements = dom.ref(ref.mount, true) || [];

    mounting = true;

    for (let i = 0, n = elements.length; i < n; i++) {
        handle.call(elements[i]);
    }

    mounting = false;
};

const update = function(value) {
    handle.call(this, value);
}


directive.on('field.select.click', click);
directive.on('field.select.update', update);
emitter.on('components.mount', mount);
