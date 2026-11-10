import { component, html } from '@esportsplus/template';
import magnifier from '@esportsplus/ui/svg/search.svg';
import button from '~/components/button';
import field from '~/components/field';
import icon from '~/components/icon';
import input from './field';


type A = NonNullable<Field> & {
    // Shortcut legends shown at the end, written like 'button.kbd' keys; 'Mod' is ⌘ on Apple platforms and Ctrl
    // elsewhere. Only shown: the host binds the shortcut itself.
    kbd?: string[];
};

type Field = Parameters<typeof input>[0];


// The icon and keycaps let presses through, so the whole field is one target and an 'onclick' (opening a dialog, say)
// fires wherever it's pressed.
export default component(
    function(this: { attributes?: Field } | void, { kbd = [], ...attributes }: A) {
        attributes['aria-label'] ??= 'Search';
        attributes.placeholder ??= 'Search';

        return field.tag({ class: 'input-search' }, html`
            ${icon({ 'aria-hidden': 'true', class: 'field-tag-item' }, magnifier)}
            ${input.call(this, {
                autocomplete: 'off',
                enterkeyhint: 'search',
                type: 'search',
                ...attributes
            })}
            ${kbd.length > 0 && html`
                <span aria-hidden='true' class='field-tag-item input-search-keys'>
                    ${kbd.map((key) => button.kbd({ key }))}
                </span>
            `}
        `);
    }
);
