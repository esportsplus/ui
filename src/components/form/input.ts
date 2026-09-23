import { Element } from '@esportsplus/template';


// TODO: Needs to be expanded and we need better type for template
const KEY = Symbol();


const get = <T extends { error: string }>(element?: Element) => {
    if (element) {
        return element[KEY] as T | undefined;
    }

    return undefined;
};

const onrender = <T extends { error: string }>(reactive: T) => {
    return (element: Element) => {
        element[KEY] = reactive;
    };
};


export default { get, onrender };