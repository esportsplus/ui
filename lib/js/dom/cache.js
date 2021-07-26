let cache = new WeakMap();


const get = (element) => {
    return cache.get(element) || {};
};

const set = (key, value) => {
    if (!key || !value) {
        return;
    }

    cache.set(key, value);
};


export default { get, set };
