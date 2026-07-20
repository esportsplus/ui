import { Element } from '@esportsplus/template';


const KEY = Symbol();


const get = (element?: Element) => {
    if (element) {
        return element[KEY] as { error: string } | undefined;
    }

    return undefined;
};

const onrender = (reactive: { error: string }) => {
    return (element: Element) => {
        element[KEY] = reactive;
    };
};


export default { get, onrender };