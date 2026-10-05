import { Element } from '@esportsplus/template';


// TODO: Needs to be expanded and we need better type for template
const KEY = Symbol();


// What a text field carries: '--active' while it holds focus, and its state for 'form.action' to report errors into.
const attributes = (state: { active: boolean, error: string }) => ({
    class: () => state.active && '--active',
    onconnect: onconnect(state),
    onfocusin: () => {
        state.active = true;
    },
    onfocusout: () => {
        state.active = false;
    }
});

const get = <T extends { error: string }>(element?: Element) => element?.[KEY] as T | undefined;

const onconnect = <T extends { error: string }>(reactive: T) => {
    return (element: Element) => {
        element[KEY] = reactive;
    };
};


export default { attributes, get, onconnect };
