import cache from './dom/cache.js';
import dot from './dot.js';
import emitter from './emitter.js';
import node from './node.js';
import raf from './dom/raf.js';
import refs from './dom/refs.js';


function build(key, properties = true, purge = false) {
    if (key instanceof HTMLElement) {
    }
    else if (Array.isArray(key)) {
        let elements = [];

        for (let i = 0, n = key.length; i < n; i++) {
            elements.push(build(key[i], properties));
        }

        return elements;
    }
    else if (typeof key === 'object' && key !== null) {
        let elements = {};

        for (let k in key) {
            elements[k] = build(key[k], properties);
        }

        return elements;
    }
    else if (['number', 'string'].includes(typeof key) || key instanceof String) {
        return build(refs.get(`${key}`, purge), properties);
    }
    else {
        return undefined;
    }

    let values = {};

    if (properties) {
        values = cache.get(key) || {};
        values.element = key;
        values.get = (key, fallback = undefined) => {
            return dot.get(values, key) || fallback;
        };
        values.refs = values.refs || {};

        if (values.refs) {
            for (let k in values.refs) {
                values.refs[k] = build(values.refs[k], false);
            }
        }
    }
    else {
        values = key;
    }

    return values;
}


const element = (key, purge = false) => {
    return build(key, false, purge);
};

const ref = (key, purge = false) => {
    return build(key, true, purge);
};

const sync = (element) => {
    raf.read(() => {
        let elements = Array.from(element.querySelectorAll(`[data-bind]`) || []),
            json = [];

        for (let i = 0, n = elements.length; i < n; i++) {
            json.push(elements[i].dataset.bind);
        }

        json = JSON.parse(`[${json.join(',')}]`) || [];

        for (let i = 0, n = elements.length; i < n; i++) {
            let data = json[i],
                element = elements[i];

            cache.set(element, data);
            refs.set(data.ref, element);
        }

        // raf.update(() => {
        //     node.attribute(elements, {
        //         'data-bind': false
        //     });
        // });

        emitter.dispatch('dom.refs.ready');
    });
};


export default Object.assign({ element, ref, sync }, raf);
