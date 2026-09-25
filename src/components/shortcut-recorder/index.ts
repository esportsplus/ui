import { html, type Attributes } from '@esportsplus/template';
import { effect, onCleanup, reactive, untrack } from '@esportsplus/reactivity';
import './scss/index.scss';


type A = Attributes & {
    label: string;
    state?: { value: string };
    taken?: (shortcut: string) => string | null | undefined;
    value?: string;
};

type Key = {
    animation: '' | 'enter' | 'settle';
    index: number;
    token: string;
};


const ARROWS: Record<string, string> = {
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    ArrowUp: '↑'
};

const ERROR_DURATION = 2200;

const FUNCTION_KEY = /^F\d{1,2}$/;

const MODIFIER_KEYS = new Set(['Alt', 'Control', 'Meta', 'OS', 'Shift']);

// Tokens are joined with '+', so a trailing '+' is the Plus key itself.
const SEPARATOR = /\+(?=.)/;


function glyph(token: string, mac: boolean) {
    if (token === 'Alt') {
        return mac ? '⌥' : 'Alt';
    }

    if (token === 'Ctrl') {
        return '⌃';
    }

    if (token === 'Mod') {
        return mac ? '⌘' : 'Ctrl';
    }

    if (token === 'Shift') {
        return mac ? '⇧' : 'Shift';
    }

    return token;
}

// Reads the physical key, so Option+K on a Mac records K rather than '˚'.
function keyName(e: KeyboardEvent) {
    if (e.code.startsWith('Key')) {
        return e.code.slice(3);
    }

    if (e.code.startsWith('Digit')) {
        return e.code.slice(5);
    }

    if (e.key in ARROWS) {
        return ARROWS[e.key];
    }

    if (e.key === ' ') {
        return 'Space';
    }

    if (e.key === 'Enter') {
        return '↵';
    }

    if (e.key.length === 1) {
        return e.key.toUpperCase();
    }

    return e.key;
}

// 'Mod' is ⌘ on a Mac and Ctrl elsewhere, so one saved shortcut works on both.
// Held modifiers follow the order each platform prints them in.
function modifiers(e: KeyboardEvent, mac: boolean) {
    let tokens = mac
        ? [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Mod']
        : [e.ctrlKey && 'Mod', e.altKey && 'Alt', e.shiftKey && 'Shift'];

    return tokens.filter((token): token is string => !!token);
}

function parse(value: string) {
    return value ? value.split(SEPARATOR) : [];
}


export default ({ label, taken, value = '', state = reactive({ value }), ...attributes }: A) => {
    let connected = false,
        field: HTMLElement | undefined,
        keys = reactive([] as Key[]),
        listeners: AbortController | undefined,
        mac = /Mac|iPhone|iPad/.test(navigator.platform),
        status = reactive({ error: '', recording: false, shake: 0 }),
        sync = effect(() => {
            let tokens = status.recording ? [] : parse(state.value);

            untrack(() => show(tokens, connected ? 'settle' : ''));
        }),
        timer: ReturnType<typeof setTimeout> | undefined;

    function fail(text: string) {
        clearTimeout(timer);
        status.error = text;
        // Alternating the parity swaps between identical keyframes, restarting the shake.
        status.shake = status.shake === 1 ? 2 : 1;
        timer = setTimeout(() => status.error = '', ERROR_DURATION);
    }

    function onaway(e: Event) {
        if (e.type === 'blur' || !field?.contains(e.target as Node | null)) {
            stop();
        }
    }

    // While recording every key belongs to the field, taken before the page's own shortcuts can act on it.
    function onkeydown(e: KeyboardEvent) {
        e.preventDefault();
        e.stopImmediatePropagation();

        let held = modifiers(e, mac);

        if (MODIFIER_KEYS.has(e.key)) {
            show(held, 'enter');
            return;
        }

        if (!held.length && e.key === 'Escape') {
            stop();
            return;
        }

        if (!held.length && (e.key === 'Backspace' || e.key === 'Delete')) {
            state.value = '';
            stop();
            return;
        }

        let key = keyName(e);

        if (!held.length && !FUNCTION_KEY.test(key)) {
            fail(`Add ${mac ? '⌘, ⌥ or ⇧' : 'Ctrl, Alt or Shift'}`);
            return;
        }

        let shortcut = [...held, key].join('+'),
            owner = shortcut === state.value ? null : taken?.(shortcut);

        if (owner) {
            fail(`Used by ${owner}`);
            return;
        }

        state.value = shortcut;
        stop();
    }

    function onkeyup(e: KeyboardEvent) {
        e.stopImmediatePropagation();
        show(modifiers(e, mac), 'enter');
    }

    // Recording keeps caps that are still held in place so only the new ones animate in.
    function show(tokens: string[], animation: Key['animation']) {
        if (animation !== 'enter') {
            keys.splice(0, keys.length, ...tokens.map((token, index) => ({ animation, index, token })));
            return;
        }

        for (let i = keys.length - 1; i >= 0; i--) {
            if (!tokens.includes(keys[i].token)) {
                keys.splice(i, 1);
            }
        }

        for (let i = 0, n = tokens.length; i < n; i++) {
            if (keys[i]?.token !== tokens[i]) {
                keys.splice(i, 0, { animation, index: i, token: tokens[i] });
            }
        }

        if (keys.length > tokens.length) {
            keys.splice(tokens.length);
        }
    }

    function start() {
        clearTimeout(timer);
        status.error = '';
        status.recording = true;

        listeners?.abort();
        listeners = new AbortController();

        let signal = listeners.signal;

        document.addEventListener('pointerdown', onaway, { signal });
        window.addEventListener('blur', onaway, { signal });
        window.addEventListener('keydown', onkeydown, { capture: true, signal });
        window.addEventListener('keyup', onkeyup, { capture: true, signal });
    }

    function stop() {
        clearTimeout(timer);
        listeners?.abort();
        status.error = '';
        status.recording = false;
    }

    onCleanup(() => {
        clearTimeout(timer);
        listeners?.abort();
        sync();
    });

    return html`
        <div class='shortcut-recorder' ${attributes}>
            <div class='shortcut-recorder-label'>
                ${label}
                <div class='shortcut-recorder-status' role='status'>
                    ${() => status.error && html`<span class='shortcut-recorder-error'>${status.error}</span>`}
                </div>
            </div>
            <button
                aria-label='${() => `${label} shortcut: ${state.value ? parse(state.value).map((token) => glyph(token, mac)).join(' ') : 'none'}. ${status.recording ? 'Recording, press the new keys, Escape to cancel, Backspace to clear.' : 'Press to change.'}`}'
                aria-pressed='${() => status.recording ? 'true' : 'false'}'
                class='shortcut-recorder-field'
                data-shake='${() => status.shake}'
                type='button'
                ${{
                    class: () => status.recording && '--active',
                    onclick: function(this: HTMLElement) {
                        field = this;

                        if (status.recording) {
                            stop();
                        }
                        else {
                            start();
                        }
                    },
                    onconnect: () => {
                        connected = true;
                    }
                }}
            >
                ${html.reactive(keys, (key) => html`
                    <kbd
                        class='shortcut-recorder-key ${key.animation && `shortcut-recorder-key--${key.animation}`}'
                        style='--index: ${key.index}'
                    >
                        ${glyph(key.token, mac)}
                    </kbd>
                `)}
                ${() => {
                    if (keys.length) {
                        return '';
                    }

                    return html`
                        <span class='shortcut-recorder-placeholder ${connected && 'shortcut-recorder-placeholder--fade'}'>
                            ${status.recording
                                ? html`<span class='shortcut-recorder-dot' aria-hidden='true'></span>Press keys`
                                : 'None'}
                        </span>
                    `;
                }}
            </button>
        </div>
    `;
};
