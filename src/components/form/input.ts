let cache = new WeakMap<HTMLInputElement | HTMLSelectElement, { error: string }>();


const attributes = (reactive: { error: string }) => {
    return (element: HTMLInputElement | HTMLSelectElement) => {
        cache.set(element, reactive);
    };
};

const get = (element?: HTMLInputElement | HTMLSelectElement) => {
    return element ? cache.get(element) : undefined;
};


export default { attributes, get };