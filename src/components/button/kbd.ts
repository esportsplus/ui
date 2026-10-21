import { reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes } from '@esportsplus/template';


type A = Attributes & {
    key: string,
    ontrigger?: () => void,
    onwindowblur?: never,
    onwindowkeydown?: never,
    onwindowkeyup?: never
};


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


export default component(
    ({ key: name, ontrigger, ...attributes }: A) => {
        let [key, legend] = KEYS[name.toLowerCase()] ?? [name.toLowerCase(), name.length === 1 ? name.toUpperCase() : name],
            state = reactive({ code: '', keyboard: false, pointer: false });

        // Only going from up to down triggers, so holding the key fires once.
        function press(source: 'keyboard' | 'pointer') {
            let down = state.keyboard || state.pointer;

            state[source] = true;

            if (down) {
                return false;
            }

            ontrigger?.();

            return true;
        }

        function release() {
            state.pointer = false;
        }

        return html`
            <kbd
                class='button button--kbd'
                ${attributes}
                ${{
                    class: () => (state.keyboard || state.pointer) && '--active',
                    onpointercancel: release,
                    onpointerdown: () => {
                        press('pointer');
                    },
                    onpointerleave: release,
                    onpointerup: release,
                    onwindowblur: () => {
                        state.keyboard = false;
                    },
                    onwindowkeydown: (e: KeyboardEvent) => {
                        if (e.key?.toLowerCase() !== key) {
                            return;
                        }

                        state.code = e.code;

                        if (press('keyboard')) {
                            e.preventDefault();
                        }
                    },
                    onwindowkeyup: (e: KeyboardEvent) => {
                        let name = e.key?.toLowerCase();

                        // Modifiers change 'key' mid-press (shift + '/' is '?'), 'code' is stable. macOS drops the keyup
                        // of every key released while Meta is held, so Meta's own keyup releases it too.
                        if (e.code === state.code || name === key || name === 'meta') {
                            state.keyboard = false;
                        }
                    }
                }}
            >
                ${legend}
            </kbd>
        `;
    }
);
