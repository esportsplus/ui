function split(keys) {
    if (typeof keys === 'number') {
        keys = `${keys}`;
    }

    if (typeof keys === 'string' || keys instanceof String) {
        keys = keys.includes('.') ? keys.split('.').map((k) => k.trim()).filter(k => k) : [keys];
    }

    return keys;
}


const get = (data, keys, splice = false) => {
    let value = undefined;

    keys = split(keys);

    if (!keys) {
        return value;
    }

    let key = keys.shift();

    if (keys.length === 0) {
        value = data[key] || value;

        if (splice) {
            data[key] = undefined;
        }

        return value;
    }
    else if (!data.hasOwnProperty(key)) {
        return value;
    }

    return get(data[key], keys, splice);
};

const set = (data, keys, value) => {
    keys = split(keys);

    let key = keys.shift();

    if (keys.length === 0) {
        if (key.endsWith('[]')) {
            key = key.substring(0, key.length - 2);

            if (!data.hasOwnProperty(key) || !data[key]) {
                data[key] = [];
            }

            data[key].push(value);
        }
        else {
            data[key] = value;
        }

        return;
    }
    else if (!data.hasOwnProperty(key)) {
        data[key] = {};
    }

    set(data[key], keys, value);
};


export default { get, set };
