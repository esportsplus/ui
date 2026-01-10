import { Element } from '@esportsplus/frontend';


let key = Symbol();


const get = (element?: Element): { error: string } | undefined => {
    if (element) {
        return element[key] as { error: string } | undefined;
    }

    return undefined;
};

const onrender = (reactive: { error: string }) => {
    return (element: Element) => {
        element[key] = reactive;
    };
};


export default { get, onrender };