import { effect, onCleanup, reactive, untrack } from '@esportsplus/reactivity';
import { html, type Renderable } from '@esportsplus/template';
import { shortcutRecorder, tooltip } from '@esportsplus/ui';
import './shortcut-recorder.scss';


type Row = {
    hint?: string;
    label: string;
    limit?: number;
    state: State;
    taken?: (shortcut: string) => string | undefined;
};

type State = { error: string, value: string };

type Tracked = ReturnType<typeof track>;

type Ui = { active: boolean, hit: number, text: string };


const HINT = 'K alone, Mod+K, or Mod+L for a long one';

// The morph tooltip's '--morph-close-duration', plus a frame: a new message reopens once the old one has landed.
const MORPH_CLOSE = 180;

const MODIFIERS = /Mac|iPhone|iPad/.test(navigator.platform) ? ['⌘', '⌥', '⇧'] : ['Ctrl', 'Alt', 'Shift'];

// Deliberately long, to see how each treatment copes with a sentence rather than a label.
const TAKEN: Record<string, string> = {
    'Mod+K': 'Open command menu',
    'Mod+L': 'Toggle the left sidebar and focus the file explorer in every open window'
};

const TYPE_EVERY = 28;


function taken(shortcut: string) {
    return TAKEN[shortcut];
}

function row({ hint, label, limit, state, taken }: Row, border = false) {
    return html`
        <div class='shortcut-recorder-demo-row ${border && 'shortcut-recorder-demo-row--border'}'>
            <div class='shortcut-recorder-demo-label'>
                ${label}
                ${hint && html`<span class='shortcut-recorder-demo-hint'>${hint}</span>`}
            </div>
            ${shortcutRecorder({ 'aria-label': `${label} shortcut`, limit, state, taken })}
        </div>
    `;
}

function shortcuts() {
    let rows: Row[] = [
        { label: 'Open command menu', state: reactive({ error: '', value: 'Mod+K' }) },
        { label: 'New note', state: reactive({ error: '', value: 'Mod+N' }) },
        { label: 'Toggle sidebar', state: reactive({ error: '', value: 'Mod+B' }) }
    ];

    for (let i = 0, n = rows.length; i < n; i++) {
        let current = rows[i];

        current.taken = (shortcut) => rows.find((other) => other !== current && other.state.value === shortcut)?.label;
    }

    return html`
        <div class='shortcut-recorder-demo'>
            ${rows.map((r, i) => row(r, i > 0))}
        </div>
    `;
}


/*
 * Error trials. Each one renders the recorder bare, with its own error morph undone in the sheet, and draws the
 * error its own way from outside the component, so an idea can be judged without landing in the component first.
 */

// The recorder flips 'data-shake' on every failure, even a repeat of the same message, so it is the one signal that
// fires per failure; 'state.error' emptying is the signal that the error is over.
function track(state: State, ui: Ui = reactive({ active: false, hit: 0, text: '' })) {
    let observer: MutationObserver | undefined;

    onCleanup(effect(() => {
        if (!state.error) {
            ui.active = false;
        }
    }));

    return {
        host: {
            onconnect: (host: HTMLElement) => {
                observer = new MutationObserver(() => {
                    if (!state.error) {
                        return;
                    }

                    ui.active = true;
                    ui.hit++;
                    ui.text = state.error;
                });
                observer.observe(host.querySelector('.shortcut-recorder') as HTMLElement, { attributeFilter: ['data-shake'] });
            },
            ondisconnect: () => {
                observer?.disconnect();
            }
        },
        ui
    };
}

// Two identical keyframes keyed by parity, so every failure restarts the animation.
function parity(ui: Ui) {
    return () => ui.hit % 2 ? 'a' : 'b';
}

function field(state: State, tracked: Tracked, overlay: Renderable<unknown> = '', attributes: Record<string, unknown> = {}) {
    return html`
        <div class='shortcut-recorder-demo-host' ${tracked.host} ${attributes}>
            ${shortcutRecorder({ 'aria-label': 'Trial shortcut', class: 'shortcut-recorder-demo-bare', state, taken })}
            ${overlay}
        </div>
    `;
}

function swap(base: Renderable<unknown>, ui: Ui, text: () => string = () => ui.text) {
    return html`
        <span class='shortcut-recorder-demo-swap' ${{ class: () => ui.active && '--active' }}>
            <span class='shortcut-recorder-demo-swap-base'>${base}</span>
            <span class='shortcut-recorder-demo-swap-error'>${text}</span>
        </span>
    `;
}

function trial(label: Renderable<unknown>, hint: Renderable<unknown>, recorder: Renderable<unknown>, attributes: Record<string, unknown> = {}) {
    return html`
        <div class='shortcut-recorder-demo-row' ${attributes}>
            <div class='shortcut-recorder-demo-label'>
                ${label}
                <span class='shortcut-recorder-demo-hint'>${hint}</span>
            </div>
            ${recorder}
        </div>
    `;
}

function idea(render: (state: State, tracked: Tracked) => Renderable<unknown>) {
    return () => {
        let state = reactive({ error: '', value: '' });

        return html`<div class='shortcut-recorder-demo'>${render(state, track(state))}</div>`;
    };
}


// 1. The library's morph tooltip ('tooltip.onclick' with '--morph' content), opening at the top right. A click
// anywhere inside a '.tooltip' opens it, so the recorder can't sit in one; an empty '.tooltip' is laid over the field
// instead, out of the pointer's way. Clicking that stand-in runs the component's own open, which grows the tooltip out
// of the stand-in's box, the field's. A new message shrinks it back onto the field and grows it out again. The field
// keeps the recorder's shake and turns its border red.
function callout() {
    return idea((state, { host, ui }) => {
        let reopen: ReturnType<typeof setTimeout> | undefined,
            stand: HTMLElement | undefined,
            tip = reactive({ active: false }),
            view = reactive({ text: '' });

        function open(text: string) {
            view.text = text;
            stand?.click();
        }

        onCleanup(effect(() => {
            let active = ui.active,
                text = ui.text;

            if (!ui.hit) {
                return;
            }

            untrack(() => {
                clearTimeout(reopen);

                if (!active) {
                    tip.active = false;
                }
                else if (!tip.active) {
                    open(text);
                }
                else if (text !== view.text) {
                    tip.active = false;
                    reopen = setTimeout(() => open(text), MORPH_CLOSE);
                }
            });
        }));
        onCleanup(() => clearTimeout(reopen));

        return trial('Callout', HINT, html`
            <div class='shortcut-recorder-demo-host' ${host}>
                ${shortcutRecorder({ 'aria-label': 'Trial shortcut', class: 'shortcut-recorder-demo-bare shortcut-recorder-demo-bare--alert', state, taken })}
                ${tooltip.onclick({ class: 'shortcut-recorder-demo-stand-in', onrender: (element: HTMLElement) => { stand = element; }, state: tip }, html`
                    <div class='tooltip-content tooltip-content--ne tooltip-content--morph shortcut-recorder-demo-morph'>
                        <span>${() => view.text}</span>
                    </div>
                `)}
            </div>
        `);
    });
}

// 2. The row's own label rolls over to the message and back.
function labelSwap() {
    return idea((state, tracked) => trial(swap('Label swap', tracked.ui), HINT, field(state, tracked)));
}

// 3. The hint line becomes the message, with a bar draining over the error's lifetime.
function countdown() {
    return idea((state, tracked) => trial('Countdown', html`
        ${swap(HINT, tracked.ui)}
        <span class='shortcut-recorder-demo-drain' ${{ class: () => tracked.ui.active && '--active', 'data-hit': parity(tracked.ui) }}></span>
    `, field(state, tracked)));
}

// 4. A conflict points at the row that owns the shortcut, which lights up, instead of only naming it.
function conflict() {
    return () => {
        let rows = [
                { label: 'Open command menu', value: 'Mod+K' },
                { label: 'New note', value: 'Mod+N' },
                { label: 'Toggle sidebar', value: 'Mod+B' }
            ].map((r) => ({ ...r, flash: reactive({ hit: 0 }), pointer: reactive({ arrow: '' }), state: reactive({ error: '', value: r.value }) }));

        return html`
            <div class='shortcut-recorder-demo'>
                ${rows.map((r, i) => {
                    let tracked = track(r.state);

                    return trial(r.label, swap('Try Mod+N or Mod+B here', tracked.ui, () => `${tracked.ui.text} ${r.pointer.arrow}`), html`
                        <div class='shortcut-recorder-demo-host' ${tracked.host}>
                            ${shortcutRecorder({
                                'aria-label': `${r.label} shortcut`,
                                class: 'shortcut-recorder-demo-bare',
                                state: r.state,
                                taken: (shortcut) => {
                                    let owner = rows.findIndex((other) => other !== r && other.state.value === shortcut);

                                    if (owner === -1) {
                                        return undefined;
                                    }

                                    rows[owner].flash.hit++;
                                    r.pointer.arrow = owner > i ? '↓' : '↑';

                                    return rows[owner].label;
                                }
                            })}
                        </div>
                    `, {
                        class: `shortcut-recorder-demo-owner ${i > 0 ? 'shortcut-recorder-demo-row--border' : ''}`,
                        'data-flash': () => r.flash.hit === 0 ? '' : r.flash.hit % 2 ? 'a' : 'b'
                    });
                })}
            </div>
        `;
    };
}

// 5. The missing modifiers fan out beside the field as dashed ghost keys, showing what to add rather than saying it.
function ghosts() {
    return idea((state, { host, ui }) => trial('Ghost keys', HINT, field(state, { host, ui }, html`
        <span aria-hidden='true' class='shortcut-recorder-demo-ghosts' ${{ class: () => ui.active && '--active' }}>
            ${() => (ui.text.startsWith('Add') ? MODIFIERS : [ui.text]).map((token, i) => html`
                <kbd class='shortcut-recorder-demo-ghost' style='--i: ${i}'>${token}</kbd>
            `)}
        </span>
    `)));
}

// 6. Rings ripple off the field and a badge stays pinned to its corner; the badge carries the message on hover.
function ping() {
    return idea((state, { host, ui }) => trial('Ping + badge', 'Hover the badge for the message', field(state, { host, ui }, html`
        ${() => ui.hit > 0 && html`
            <span aria-hidden='true' class='shortcut-recorder-demo-ring'></span>
            <span aria-hidden='true' class='shortcut-recorder-demo-ring shortcut-recorder-demo-ring--late'></span>
        `}
        <span
            aria-hidden='true'
            class='shortcut-recorder-demo-badge'
            ${{ class: () => ui.active && '--active', 'data-text': () => ui.text }}
        >!</span>
    `)));
}

// 7. One reserved status line for the whole panel, so any row's error lands in the same place.
function statusBar() {
    return () => {
        let ui = reactive({ active: false, hit: 0, text: '' }),
            states = [reactive({ error: '', value: '' }), reactive({ error: '', value: '' })];

        return html`
            <div class='shortcut-recorder-demo shortcut-recorder-demo--panel'>
                ${states.map((state, i) => trial(i ? 'Toggle sidebar' : 'New note', HINT, field(state, track(state, ui)), {
                    class: i ? 'shortcut-recorder-demo-row--border' : ''
                }))}
                <div class='shortcut-recorder-demo-status'>${swap('All shortcuts saved', ui)}</div>
            </div>
        `;
    };
}

// 8. The whole row flashes red and its label turns, like a failed row in a table.
function rowFlash() {
    return idea((state, tracked) => trial(
        'Row flash',
        swap(HINT, tracked.ui),
        field(state, tracked),
        { class: () => `shortcut-recorder-demo-flash ${tracked.ui.active ? '--active' : ''}`, 'data-hit': parity(tracked.ui) }
    ));
}

// 9. A red stroke races once around the field's edge, then fades.
function trace() {
    return idea((state, tracked) => trial('Border trace', swap(HINT, tracked.ui), field(state, tracked, html`
        ${() => tracked.ui.hit > 0 && html`
            <svg aria-hidden='true' class='shortcut-recorder-demo-trace'>
                <rect pathLength='100' x='1' y='1' />
            </svg>
        `}
    `)));
}

// 10. The field squashes and stretches like jelly, and a caption drops in beneath it.
function jelly() {
    return idea((state, { host, ui }) => trial('Jelly', HINT, field(state, { host, ui }, html`
        <span aria-hidden='true' class='shortcut-recorder-demo-caption' ${{ class: () => ui.active && '--active' }}>${() => ui.text}</span>
    `, { class: 'shortcut-recorder-demo-jelly', 'data-hit': () => ui.hit === 0 ? '' : ui.hit % 2 ? 'a' : 'b' })));
}

// 11. The label is backspaced and the message typed in its place, then typed back.
function typed() {
    return () => {
        let label = 'Typewriter',
            state = reactive({ error: '', value: '' }),
            tracked = track(state),
            view = reactive({ text: label }),
            timer: ReturnType<typeof setInterval> | undefined;

        function retype(target: string) {
            clearInterval(timer);
            timer = setInterval(() => {
                let text = view.text;

                if (!target.startsWith(text)) {
                    view.text = text.slice(0, -1);
                }
                else if (text !== target) {
                    view.text = target.slice(0, text.length + 1);
                }
                else {
                    clearInterval(timer);
                }
            }, TYPE_EVERY);
        }

        onCleanup(effect(() => {
            retype(tracked.ui.active ? tracked.ui.text : label);
        }));
        onCleanup(() => clearInterval(timer));

        return html`
            <div class='shortcut-recorder-demo'>
                ${trial(html`
                    <span class='shortcut-recorder-demo-typed' ${{ class: () => tracked.ui.active && '--active' }}>${() => view.text}</span>
                `, HINT, field(state, tracked))}
            </div>
        `;
    };
}

// 12. The field flips over on its horizontal axis to a red back face carrying the message, then flips home.
function flip() {
    return idea((state, { host, ui }) => trial('Flip', HINT, field(state, { host, ui }, html`
        <span aria-hidden='true' class='shortcut-recorder-demo-face'>${() => ui.text}</span>
    `, { class: () => `shortcut-recorder-demo-flip ${ui.active ? '--active' : ''}` })));
}


export default {
    name: 'shortcut-recorder',
    variants: [
        {
            render: shortcuts,
            title: 'keyboard shortcuts'
        },
        {
            render: () => shortcutRecorder({ 'aria-label': 'Toggle focus mode shortcut' }),
            title: 'empty'
        },
        {
            render: () => html`
                <div class='shortcut-recorder-demo'>
                    ${row({ hint: 'Two keys at most', label: 'Quick switch', limit: 2, state: reactive({ error: '', value: '' }) })}
                </div>
            `,
            title: 'limit'
        },
        {
            render: () => html`
                <div class='shortcut-recorder-demo'>
                    ${row({ hint: HINT, label: 'Errors', state: reactive({ error: '', value: '' }), taken })}
                </div>
            `,
            title: 'error'
        },
        { render: callout(), title: 'error trial 1: callout' },
        { render: labelSwap(), title: 'error trial 2: label swap' },
        { render: countdown(), title: 'error trial 3: countdown' },
        { render: conflict(), title: 'error trial 4: point at the conflict' },
        { render: ghosts(), title: 'error trial 5: ghost keys' },
        { render: ping(), title: 'error trial 6: ping + badge' },
        { render: statusBar(), title: 'error trial 7: status bar' },
        { render: rowFlash(), title: 'error trial 8: row flash' },
        { render: trace(), title: 'error trial 9: border trace' },
        { render: jelly(), title: 'error trial 10: jelly' },
        { render: typed(), title: 'error trial 11: typewriter' },
        { render: flip(), title: 'error trial 12: flip' }
    ]
};
