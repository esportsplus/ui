import { html, type Attributes } from '@esportsplus/template';
import { effect, onCleanup, reactive, untrack } from '@esportsplus/reactivity';
import { mac as apple } from '~/lib/platform';
import '~/components/button/scss/index.scss';
import './scss/index.scss';


type A = Attributes & {
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

// The shared tooltip's glide, so the field resizes around its content the way the tooltip does between triggers.
const GLIDE: KeyframeAnimationOptions = { duration: 400, easing: 'cubic-bezier(0.22, 1.12, 0.36, 1)' };

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

function reduced() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// The shared tooltip's content swap: the incoming layer snaps to wait one shift along 'travel' and settles in, while
// the outgoing one carries on a shift the other way and stays there, hidden, until its next turn.
function swap(incoming: HTMLElement, outgoing: HTMLElement, travel: number) {
    incoming.style.setProperty('--travel', `${travel}`);
    outgoing.style.setProperty('--travel', `${travel}`);

    incoming.classList.add('--instant');
    incoming.classList.remove('--active', '--leaving');
    // Commits the waiting spot before the transition starts from it.
    void incoming.offsetWidth;
    incoming.classList.remove('--instant');
    incoming.classList.add('--active');

    outgoing.classList.remove('--active');
    outgoing.classList.add('--leaving');
}


export default ({ limit, taken, value = '', state = reactive({ error: '', value }), ...attributes }: A) => {
    let chord: string[] = [],
        connected = false,
        field: HTMLElement | undefined,
        keys = reactive([] as Key[]),
        layers: { error: HTMLElement, keys: HTMLElement } | undefined,
        listeners: AbortController | undefined,
        mac = apple(),
        observer: ResizeObserver | undefined,
        pressed: string[] = [],
        resize: Animation | undefined,
        status = reactive({ recording: false, shake: 0 }),
        sync = effect(() => {
            let tokens = status.recording ? [] : parse(state.value);

            untrack(() => show(tokens, connected ? 'settle' : ''));
        }),
        timer: ReturnType<typeof setTimeout> | undefined,
        width: number | undefined;

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

    function error(text: string) {
        if (text === state.error) {
            return;
        }

        state.error = text;

        if (!layers) {
            return;
        }

        // The message follows the field's growing left edge in and pushes the keys out right; going back retraces it.
        // Written straight in, as the template's own writes land a frame later. The text outlives the error, so it is
        // still there to slide out.
        if (text) {
            layers.error.textContent = text;
            swap(layers.error, layers.keys, -1);
            observer?.unobserve(layers.keys);
            observer?.observe(layers.error);
        }
        else {
            swap(layers.keys, layers.error, 1);
            observer?.unobserve(layers.error);
            observer?.observe(layers.keys);
        }
    }

    function fail(text: string) {
        clearTimeout(timer);
        error(text);
        // Alternating the parity swaps between identical keyframes, restarting the shake.
        status.shake = status.shake === 1 ? 2 : 1;
        timer = setTimeout(() => error(''), ERROR_DURATION);
    }

    // Watches the shown layer, which is in flow and sized by its content alone, so the field glides to fit however
    // that content changes: a swap, keys coming and going, or the placeholder. It runs after layout and before paint,
    // so the glide starts from the width still on screen.
    function glide(entries: ResizeObserverEntry[]) {
        let entry = entries[entries.length - 1];

        if (!field || !entry.target.classList.contains('--active')) {
            return;
        }

        let style = getComputedStyle(field),
            padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight),
            min = parseFloat(style.minWidth) || 0,
            next = Math.max(style.boxSizing === 'border-box' ? min : min + padding, entry.borderBoxSize[0].inlineSize + padding),
            shown = resize?.playState === 'running' ? field.getBoundingClientRect().width : width;

        width = next;

        if (shown === undefined || Math.abs(shown - next) < 0.5 || reduced()) {
            return;
        }

        resize?.cancel();
        resize = field.animate([{ width: `${shown}px` }, { width: `${next}px` }], GLIDE);
    }

    function onaway(e: Event) {
        if (e.type === 'blur' || !field?.contains(e.target as Node | null)) {
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
        if (state.error) {
            clearTimeout(timer);
            error('');
        }

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
        clearTimeout(timer);
        pressed = [];
        status.recording = true;
        error('');

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
        status.recording = false;
        error('');
    }

    onCleanup(() => {
        clearTimeout(timer);
        listeners?.abort();
        observer?.disconnect();
        resize?.cancel();
        sync();
    });

    return html`
        <button
            aria-pressed='${() => status.recording ? 'true' : 'false'}'
            class='shortcut-recorder'
            data-shake='${() => status.shake}'
            type='button'
            ${attributes}
            ${{
                class: () => `${status.recording ? '--active' : ''} ${state.error ? '--error' : ''}`,
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
                    layers = {
                        error: element.querySelector('.shortcut-recorder-error') as HTMLElement,
                        keys: element.querySelector('.shortcut-recorder-keys') as HTMLElement
                    };
                    observer = new ResizeObserver(glide);
                    observer.observe(layers.keys);
                }
            }}
        >
            <span class='shortcut-recorder-keys --active'>
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
            </span>
            <span aria-hidden='true' class='shortcut-recorder-error'></span>
            <span aria-live='polite' class='shortcut-recorder-live'>${() => state.error}</span>
        </button>
    `;
};
