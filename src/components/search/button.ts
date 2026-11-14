import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import group from '~/components/group';
import { glass, legend } from './parts';


type A = Attributes & {
    // Shortcut legends shown at the end, written like 'button.kbd' keys; 'Mod' is ⌘ on Apple platforms and Ctrl
    // elsewhere. Only shown: the host binds the shortcut itself.
    kbd?: string[];
    label?: string;
};


// A button dressed as 'search.input', for opening a search that lives elsewhere: the label sits where the field's
// placeholder would, and the magnifier and keycaps float over it the same way, so presses land on the button.
export default component(
    function({ kbd = [], label = 'Search', ...attributes }: A, content?: Renderable<unknown>) {
        return group({ class: 'search' }, html`
            ${glass()}
            <button class='button search-button' type='button' ${attributes}>${label}</button>
            ${legend(kbd, content)}
        `);
    }
);
