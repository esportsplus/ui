import { dot } from 'ui/lib';


let refs = {};


const get = (key, splice = false) => {
    return dot.get(refs, key, splice);
};

const set = (keys, value) => {
    if (!keys || !value) {
        return;
    }
    else if (!Array.isArray(keys)) {
        keys = [keys];
    }

    for (let i = 0, n = keys.length; i < n; i++) {
        let key = keys[i];

        key = key.includes(',') ? key.split(',').map((r) => r.trim()).filter(r => r) : [key];

        for (let j = 0, o = key.length; j < o; j++) {
            dot.set(refs, key[j], value);
        }
    }
};


export default { get, set };
