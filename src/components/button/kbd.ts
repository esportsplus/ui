import { reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes } from '@esportsplus/template';
import icon from '~/components/icon';
import plus from './svg/plus.svg';


const KBD_KEY = Symbol.for('@esportsplus/ui/button.kbd.key');


type A = Attributes & {
    [KBD_KEY]?: Attributes,
    keys: string[],
    ontrigger?: () => void,
    onwindowblur?: never,
    onwindowkeydown?: never,
    onwindowkeyup?: never
};

type Key = { code: string, key: string, keyboard: boolean, legend: string, pointer: boolean };


const KEYS: Record<string, [key: string, legend: string]> = {
    alt: ['alt', '⌥'],
    ctrl: ['control', '⌃'],
    down: ['arrowdown', '↓'],
    enter: ['enter', '↵'],
    escape: ['escape', 'esc'],
    left: ['arrowleft', '←'],
    meta: ['meta', '⌘'],
    right: ['arrowright', '→'],
    shift: ['shift', '⇧'],
    space: [' ', '␣'],
    up: ['arrowup', '↑']
};


function held(keys: Key[]) {
    for (let i = 0, n = keys.length; i < n; i++) {
        if (!keys[i].keyboard && !keys[i].pointer) {
            return false;
        }
    }

    return true;
}

function parse(name: string): Key {
    let [key, legend] = KEYS[name.toLowerCase()] ?? [name.toLowerCase(), name.length === 1 ? name.toUpperCase() : name];

    return reactive({ code: '', key, keyboard: false, legend, pointer: false });
}


export default component(
    ({ keys: names, ontrigger, ...attributes }: A) => {
        let keys = names.map(parse);

        // Only a key going from up to down can complete the combo, so holding it fires once.
        const press = (key: Key, source: 'keyboard' | 'pointer') => {
            let down = key.keyboard || key.pointer;

            key[source] = true;

            if (down || !held(keys)) {
                return false;
            }

            ontrigger?.();

            return true;
        };

        const release = () => {
            for (let i = 0, n = keys.length; i < n; i++) {
                keys[i].keyboard = false;
            }
        };

        return html`
            <kbd
                class='button-kbd'
                ${attributes}
                ${{
                    onwindowblur: release,
                    onwindowkeydown: (e: KeyboardEvent) => {
                        if (!e.key) {
                            return;
                        }

                        let name = e.key.toLowerCase();

                        for (let i = 0, n = keys.length; i < n; i++) {
                            let key = keys[i];

                            if (key.key !== name) {
                                continue;
                            }

                            key.code = e.code;

                            if (press(key, 'keyboard')) {
                                e.preventDefault();
                            }

                            break;
                        }
                    },
                    onwindowkeyup: (e: KeyboardEvent) => {
                        let name = e.key?.toLowerCase();

                        // macOS drops the keyup of every key released while Meta is held.
                        if (name === 'meta') {
                            release();
                            return;
                        }

                        // Modifiers change 'key' mid-press (shift + '/' is '?'), 'code' is stable.
                        for (let i = 0, n = keys.length; i < n; i++) {
                            let key = keys[i];

                            if (key.code === e.code || key.key === name) {
                                key.keyboard = false;
                            }
                        }
                    }
                }}
            >
                ${keys.map((key, i) => html`
                    ${i > 0 && icon({ 'aria-hidden': true, class: 'button-kbd-plus' }, plus)}
                    <kbd
                        class='button button--kbd'
                        ${attributes[KBD_KEY]}
                        ${{
                            class: () => key.keyboard || key.pointer ? '--active' : '',
                            onpointercancel: () => {
                                key.pointer = false;
                            },
                            onpointerdown: () => {
                                press(key, 'pointer');
                            },
                            onpointerleave: () => {
                                key.pointer = false;
                            },
                            onpointerup: () => {
                                key.pointer = false;
                            }
                        }}
                    >
                        ${key.legend}
                    </kbd>
                `)}
            </kbd>
        `;
    },
    { key: KBD_KEY }
);
