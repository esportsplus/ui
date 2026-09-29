import { reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes } from '@esportsplus/template';
import capsLock from '@esportsplus/ui/svg/caps-lock.svg';
import '~/components/button/scss/index.scss';
import './scss/index.scss';


type A = Attributes & { state?: State };

type State = { active: boolean };


export default component(
    function(
        this: { attributes?: A } | void,
        {
            state = reactive({ active: false }),
            ...attributes
        }: A = {}
    ) {
        // Every key and pointer event carries the lock state, including the Caps Lock key's own events,
        // so the warning stays right without polling
        let read = (e: KeyboardEvent | PointerEvent) => {
                // Autofill dispatches plain Events as keydown
                if (!e.getModifierState) {
                    return;
                }

                state.active = e.getModifierState('CapsLock');
            };

        return html`
            <div
                class='capslock text'
                ${this?.attributes}
                ${attributes}
                ${{
                    class: () => state.active && '--active',
                    onwindowkeydown: read,
                    onwindowkeyup: read,
                    onwindowpointerdown: read
                }}
            >
                <kbd aria-hidden='true' class='button button--kbd capslock-key'>
                    <span class='capslock-key-light'></span>
                    <svg><use href='#${capsLock}' /></svg>
                </kbd>
                <span aria-hidden='true' class='capslock-text --flex-vertical'>Caps Lock On</span>
                <span aria-live='polite' class='capslock-live --flex-vertical'>${() => state.active ? 'Caps Lock On' : ''}</span>
            </div>
        `;
    }
);
export type { State };
