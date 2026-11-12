import { component, html, type Renderable } from '@esportsplus/template';
import group from '~/components/group';
import input from '~/components/input';
import { glass, legend } from './parts';


type A = NonNullable<Field> & {
    // Shortcut legends shown at the end, written like 'button.kbd' keys; 'Mod' is ⌘ on Apple platforms and Ctrl
    // elsewhere. Only shown: the host binds the shortcut itself.
    kbd?: string[];
};

type Field = Parameters<typeof input>[0];


// A search field: an 'input' with the magnifier at its start and keycaps at its end, floating over it so the whole
// field is one target.
export default component(
    function(this: { attributes?: Field } | void, { kbd = [], ...attributes }: A, content?: Renderable<unknown>) {
        attributes['aria-label'] ??= 'Search';
        attributes.placeholder ??= 'Search';

        return group({ class: 'search' }, html`
            ${glass()}
            ${input.call(this, {
                autocomplete: 'off',
                enterkeyhint: 'search',
                type: 'search',
                ...attributes,
                class: ['search-input', attributes.class].flat()
            })}
            ${legend(kbd, content)}
        `);
    }
);
