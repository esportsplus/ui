import { html, type Attributes } from '@esportsplus/template';
import { effect, flush, onCleanup, reactive } from '@esportsplus/reactivity';
import error, { type Direction } from '~/components/error';
import { mac as apple } from '~/shared/platform';
import '~/components/button/scss/index.scss';
import './scss/index.scss';


type A = Attributes & {
    // Where the error message opens, as a tooltip direction.
    direction?: Direction;
    limit?: number;
    state?: { error: string, value: string };
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

// Tokens are joined with '+' and the Plus key is itself '+', so tokens sit at every other match.
const TOKEN = /[^+]+|\+/g;


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
    return (value.match(TOKEN) ?? []).filter((_, i) => i % 2 === 0);
}


export default ({ direction = 'ne', limit, taken, value = '', state = reactive({ error: '', value }), ...attributes }: A) => {
    let chord: string[] = [],
        connected = false,
        field: HTMLElement | undefined,
        keys = reactive([] as Key[]),
        listeners: AbortController | undefined,
        mac = apple(),
        pressed: string[] = [],
        status = reactive({ recording: false });

    function commit(held: string[]) {
        let shortcut = chord.join('+'),
            owner = shortcut === state.value ? null : taken?.(shortcut);

        chord = [];
        pressed = [];

        if (owner) {
            fail(`Used by ${owner}`);
            show(held, 'enter');
            return;
        }

        state.value = shortcut;
        stop();
    }

    // A repeat is cleared and flushed first, so the error sees a new failure and shakes the field again.
    function fail(text: string) {
        if (state.error === text) {
            state.error = '';
            flush();
        }

        state.error = text;
    }

    function onaway(e: Event) {
        if (status.recording && (e.type === 'blur' || !field?.contains(e.target as Node | null))) {
            stop();
        }
    }

    // While recording every key belongs to the field, taken before the page's own shortcuts can act on it.
    // Keys gather into one chord until a key is released, or until the chord reaches 'limit' when one is set.
    function onkeydown(e: KeyboardEvent) {
        e.preventDefault();
        e.stopImmediatePropagation();

        if (e.repeat) {
            return;
        }

        // The next attempt takes the field back, so an error never sits over keys being pressed.
        state.error = '';

        let held = modifiers(e, mac);

        if (!MODIFIER_KEYS.has(e.key)) {
            if (!held.length && !pressed.length && e.key === 'Escape') {
                stop();
                return;
            }

            if (!held.length && !pressed.length && (e.key === 'Backspace' || e.key === 'Delete')) {
                state.value = '';
                stop();
                return;
            }

            let key = keyName(e);

            if (!held.length && !FUNCTION_KEY.test(key) && !pressed.some((token) => FUNCTION_KEY.test(token))) {
                fail(`Add ${mac ? '⌘, ⌥ or ⇧' : 'Ctrl, Alt or Shift'}`);
                return;
            }

            if (limit && held.length + pressed.length >= limit) {
                fail(`Up to ${limit} ${limit === 1 ? 'key' : 'keys'}`);
                return;
            }

            if (!pressed.includes(key)) {
                pressed.push(key);
            }
        }

        let tokens = [...held, ...pressed];

        show(tokens, 'enter');

        if (!pressed.length) {
            return;
        }

        chord = tokens;

        if (tokens.length === limit) {
            commit(held);
        }
    }

    // macOS drops keyup for keys pressed while ⌘ is held, so releasing any key, modifiers included, ends the chord.
    function onkeyup(e: KeyboardEvent) {
        e.stopImmediatePropagation();

        let held = modifiers(e, mac);

        if (chord.length) {
            commit(held);
            return;
        }

        show(held, 'enter');
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
        chord = [];
        pressed = [];
        status.recording = true;
        state.error = '';

        listeners?.abort();
        listeners = new AbortController();

        let signal = listeners.signal;

        window.addEventListener('keydown', onkeydown, { capture: true, signal });
        window.addEventListener('keyup', onkeyup, { capture: true, signal });
    }

    function stop() {
        listeners?.abort();
        status.recording = false;
        state.error = '';
    }

    onCleanup(effect(() => status.recording ? [] : parse(state.value), (tokens) => show(tokens, connected ? 'settle' : '')));

    onCleanup(() => {
        listeners?.abort();
    });

    return error({ direction, duration: ERROR_DURATION, state }, html`
        <button
            aria-pressed='${() => status.recording ? 'true' : 'false'}'
            class='shortcut-recorder'
            type='button'
            ${attributes}
            ${{
                class: [
                    () => status.recording && '--active',
                    () => state.error && '--invalid'
                ],
                onclick: () => {
                    if (status.recording) {
                        stop();
                    }
                    else {
                        start();
                    }
                },
                onconnect: (element: HTMLElement) => {
                    connected = true;
                    field = element;
                },
                ondocumentpointerdown: onaway,
                onwindowblur: onaway
            }}
        >
            ${html.reactive(keys, (key) => html`
                <kbd
                    class='button button--kbd shortcut-recorder-key ${key.animation && `shortcut-recorder-key--${key.animation}`}'
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
    `);
};
