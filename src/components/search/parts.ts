import { html, type Renderable } from '@esportsplus/template';
import magnifier from '@esportsplus/ui/svg/search.svg';
import button from '~/components/button';
import icon from '~/components/icon';


// The magnifier, floating over the control's start.
function glass() {
    return icon({ 'aria-hidden': 'true', class: 'group-item group-item--overlay' }, magnifier);
}

// Content (a result count, say) and the keycaps, floating over the control's end in one item, since the group stacks
// every item on one side at one inset. Keycaps only show a shortcut; the host binds it.
function legend(kbd: string[], content?: Renderable<unknown>) {
    return (content !== undefined || kbd.length > 0) && html`
        <span aria-hidden='true' class='group-item group-item--overlay search-keys'>
            ${content}
            ${kbd.map((key) => button.kbd({ key }))}
        </span>
    `;
}


export { glass, legend };
