function remove(element, attributes) {
    if (!attributes) {
        return;
    }
    else if (!Array.isArray(attributes)) {
        attributes = [attributes];
    }

    for (let i = 0, n = attributes.length; i < n; i++) {
        let attribute = attributes[i];

        if (attribute === 'class') {
            element.className = '';
        }
        else {
            element.removeAttribute(attribute);
        }
    }
}

function set(element, attributes) {
    if (!attributes) {
        return;
    }

    for (let key in attributes) {
        let value = attributes[key];

        if (key === 'class') {
            element.className = value;
        }
        else if (key.startsWith('data-')) {
            element.setAttribute(key, value);
        }
        else {
            element[key] = value;
        }
    }
}


const attribute = (elements, obj) => {
    if (!elements || !obj) {
        return;
    }
    else if (!Array.isArray(elements)) {
        elements = [elements];
    }

    let add = {},
        del = [];

    for (let key in obj) {
        let value = obj[key];

        // == Checks 'null' + 'undefined'
        if (value == null || value === false || value === 'remove') {
            del.push(key);
        }
        else {
            add[key] = value;
        }
    }

    for (let i = 0, n = elements.length; i < n; i++) {
        remove(elements[i], del);
        set(elements[i], add);
    }
};


export default attribute;
