import { component, html, type Attributes } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import input from '~/components/input';
import { PASSWORD_INPUT } from './constants';
import capsLock from '@esportsplus/ui/svg/caps-lock.svg';
import eyeOff from '@esportsplus/ui/svg/eye-off.svg';
import eye from '@esportsplus/ui/svg/eye.svg';
import './scss/index.scss';


type A = Attributes & { [PASSWORD_INPUT]?: Omit<Parameters<typeof input>[0], 'state'> };

type State = { active: boolean, capslock: boolean, error: string, visible: boolean };


function template(
    this: { attributes?: A } | void,
    {
        state = reactive({
            active: false,
            capslock: false,
            error: '',
            visible: false
        }),
        ...attributes
    }: A & { state?: State } = {}
) {
    // Every key and pointer event carries the lock state, including the Caps Lock
    // key's own events, so the field stays right without polling
    let read = (e: KeyboardEvent | PointerEvent) => {
            state.capslock = e.getModifierState('CapsLock');
        },
        warning = () => state.active && state.capslock;

    return html`
        <div
            class='password'
            ${this?.attributes}
            ${attributes}
            ${{
                class: [
                    () => state.active && '--active',
                    () => warning() && '--capslock'
                ],
                onkeydown: read,
                onkeyup: read,
                onpointerdown: read
            }}
        >
            <div class='password-field'>
                ${input.call({ attributes: this?.attributes?.[PASSWORD_INPUT] }, {
                    autocomplete: 'current-password',
                    ...attributes[PASSWORD_INPUT],
                    state,
                    type: () => state.visible ? 'text' : 'password'
                })}
                <div class='password-key' aria-hidden='true'>
                    <span class='password-key-light'></span>
                    <svg><use href='#${capsLock}' /></svg>
                </div>
                <button
                    class='password-toggle'
                    type='button'
                    ${{
                        'aria-label': () => state.visible ? 'Hide password' : 'Show password',
                        'aria-pressed': () => String(state.visible),
                        class: () => state.visible && '--visible',
                        onclick: () => {
                            state.visible = !state.visible;
                        },
                        // Keeps focus in the field so the caret and caps lock state survive
                        onpointerdown: (e: PointerEvent) => {
                            e.preventDefault();
                        }
                    }}
                >
                    <svg class='password-toggle-show' aria-hidden='true'><use href='#${eye}' /></svg>
                    <svg class='password-toggle-hide' aria-hidden='true'><use href='#${eyeOff}' /></svg>
                </button>
            </div>
            <div class='password-warning'>
                <span aria-hidden='true'>Caps Lock is on</span>
                <span class='password-warning-live' aria-live='polite'>${() => warning() ? 'Caps Lock is on' : ''}</span>
            </div>
        </div>
    `;
}


export default component(template, { input: PASSWORD_INPUT });
