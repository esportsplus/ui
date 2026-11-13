import { reactive } from '@esportsplus/reactivity';
import { Element } from '@esportsplus/template';
import type { On } from '@esportsplus/template';


// TODO: Needs to be expanded and we need better type for template
const KEY = Symbol();


// What a text field carries: '--active' while it holds focus, '--focused' while a press began on it already focused,
// and its state for 'form.action' to report errors into. The press is heard through 'on' rather than an
// 'onpointerdown' attribute, which would replace the caller's own.
const attributes = (state: { active: boolean, error: string }) => {
    let local = reactive({ focused: false });

    return {
        class: [() => state.active && '--active', () => local.focused && '--focused'],
        onconnect: (element: Element, on: On) => {
            element[KEY] = state;
            on(element, 'pointerdown', () => {
                local.focused = state.active;
            });
        },
        onfocusin: () => {
            state.active = true;
        },
        onfocusout: () => {
            local.focused = false;
            state.active = false;
        }
    };
};

const get = <T extends { error: string }>(element?: Element) => element?.[KEY] as T | undefined;

const onconnect = <T extends { error: string }>(reactive: T) => {
    return (element: Element) => {
        element[KEY] = reactive;
    };
};


export default { attributes, get, onconnect };
