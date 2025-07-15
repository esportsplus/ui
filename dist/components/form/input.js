let key = Symbol();
const get = (element) => {
    return element ? element[key] : undefined;
};
const onrender = (reactive) => {
    return (element) => {
        element[key] = reactive;
    };
};
export default { get, onrender };
