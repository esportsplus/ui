import { component, html, type Renderable } from '@esportsplus/template';
import magnifier from '@esportsplus/ui/svg/search.svg';
import button from '~/components/button';
import group from '~/components/group';
import icon from '~/components/icon';
import input from './field';


type A = NonNullable<Field> & {
    // Shortcut legends shown at the end, written like 'button.kbd' keys; 'Mod' is ⌘ on Apple platforms and Ctrl
    // elsewhere. Only shown: the host binds the shortcut itself.
    kbd?: string[];
};

type Field = Parameters<typeof input>[0];


// The icon and end items let presses through, so the whole field is one target and an 'onclick' (opening a dialog, say)
// fires wherever it's pressed. Content (a result count, say) sits at the end ahead of the keycaps, in the same item, since
// the group stacks every item on one side at one inset.
export default component(
    function(this: { attributes?: Field } | void, { kbd = [], ...attributes }: A, content?: Renderable<unknown>) {
        attributes['aria-label'] ??= 'Search';
        attributes.placeholder ??= 'Search';

        return group({ class: 'input-search' }, html`
            ${icon({ 'aria-hidden': 'true', class: 'group-item group-item--overlay' }, magnifier)}
            ${input.call(this, {
                autocomplete: 'off',
                enterkeyhint: 'search',
                type: 'search',
                ...attributes,
                class: ['input--search', attributes.class].flat()
            })}
            ${(content !== undefined || kbd.length > 0) && html`
                <span aria-hidden='true' class='group-item group-item--overlay input-search-keys'>
                    ${content}
                    ${kbd.map((key) => button.kbd({ key }))}
                </span>
            `}
        `);
    }
);
