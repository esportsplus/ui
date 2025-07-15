let key = Symbol();


const get = (element?: HTMLInputElement | HTMLSelectElement) => {
    // @ts-ignore
    return element ? element[key] : undefined;
};

const onrender = (reactive: { error: string }) => {
    return (element: HTMLInputElement | HTMLSelectElement) => {
        // @ts-ignore
        element[key] = reactive;
    };
};


export default { get, onrender };