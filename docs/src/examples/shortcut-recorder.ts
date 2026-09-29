import { effect, onCleanup, reactive, untrack } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { shortcutRecorder, tooltip } from '@esportsplus/ui';
import './shortcut-recorder.scss';


type Row = {
    hint?: string;
    label: string;
    limit?: number;
    state: State;
    taken?: (shortcut: string) => string | undefined;
};

type Direction = 'e' | 'en' | 'es' | 'n' | 'ne' | 'nw' | 's' | 'se' | 'sw' | 'w' | 'wn' | 'ws';

type State = { error: string, value: string };


// Every side and corner the tooltip content can open on, clockwise from the top left.
const DIRECTIONS: Direction[] = ['nw', 'n', 'ne', 'en', 'e', 'es', 'se', 's', 'sw', 'ws', 'w', 'wn'];

const HINT = 'K alone, Mod+K, or Mod+L for a long one';

// The morph tooltip's '--morph-close-duration', plus a frame: a new message reopens once the old one has landed.
const MORPH_CLOSE = 180;

// Deliberately long, to see how each treatment copes with a sentence rather than a label.
const TAKEN: Record<string, string> = {
    'Mod+K': 'Open command menu',
    'Mod+L': 'Toggle the left sidebar and focus the file explorer in every open window'
};

// The way out of the field toward the side the tooltip opens on, keyed by that side, the direction's first letter.
const TRAVEL: Record<string, [number, number]> = {
    e: [1, 0],
    n: [0, -1],
    s: [0, 1],
    w: [-1, 0]
};


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
 * Error trials, drawn from outside the component so an idea can be judged without landing in it first. The recorder
 * sheet is adjusted per trial through the class passed in.
 *
 * The library's morph tooltip ('tooltip.onclick' with '--morph' content) opens on 'direction' on each failure, and
 * the picker changes it live. A click anywhere inside a '.tooltip' opens it, so the recorder can't sit in one; an
 * empty '.tooltip' is laid behind the field instead, out of the pointer's way. Clicking that stand-in runs the
 * component's own open, which grows the tooltip out of the stand-in's box, the field's. A new message shrinks it back
 * onto the field and grows it out again. The host carries the way toward the tooltip as '--demo-dx' and '--demo-dy',
 * for a recorder whose own swap should travel with it.
 */
function callout(label: string, recorder: string, direction: Direction = 'ne') {
    return () => {
        let message: HTMLElement | undefined,
            observer: MutationObserver | undefined,
            reopen: ReturnType<typeof setTimeout> | undefined,
            shown = '',
            stand: HTMLElement | undefined,
            state = reactive({ error: '', value: '' }),
            tip = reactive({ active: false }),
            view = reactive({ direction });

        // Written straight in: the open measures the tooltip's box to seed the morph, and the template's own write
        // lands a frame later, so the first open would measure it empty and then stretch out to the text.
        function open(text: string) {
            shown = text;

            if (message) {
                message.textContent = text;
            }

            stand?.click();
        }

        // Opens or moves on every failure. The recorder flips 'data-shake' on each one, even a repeat of the same
        // message, so it is the signal to watch.
        function fail() {
            let text = state.error;

            if (!text) {
                return;
            }

            clearTimeout(reopen);

            if (!tip.active) {
                open(text);
            }
            else if (text !== shown) {
                tip.active = false;
                reopen = setTimeout(() => open(text), MORPH_CLOSE);
            }
        }

        onCleanup(effect(() => {
            if (state.error) {
                return;
            }

            untrack(() => {
                clearTimeout(reopen);
                tip.active = false;
            });
        }));
        onCleanup(() => {
            clearTimeout(reopen);
            observer?.disconnect();
        });

        return html`
            <div class='shortcut-recorder-demo'>
                <div class='shortcut-recorder-demo-row'>
                    <div class='shortcut-recorder-demo-label'>
                        ${label}
                        <span class='shortcut-recorder-demo-hint'>${HINT}</span>
                        <label class='shortcut-recorder-demo-hint'>
                            Tooltip
                            <select
                                class='shortcut-recorder-demo-direction'
                                ${{
                                    onchange: (e: Event) => {
                                        clearTimeout(reopen);
                                        tip.active = false;
                                        view.direction = (e.target as HTMLSelectElement).value as Direction;
                                    }
                                }}
                            >
                                ${DIRECTIONS.map((d) => html`<option selected=${d === direction} value='${d}'>${d}</option>`)}
                            </select>
                        </label>
                    </div>
                    <div
                        class='shortcut-recorder-demo-host'
                        ${{
                            onconnect: (host: HTMLElement) => {
                                observer = new MutationObserver(fail);
                                observer.observe(host.querySelector('.shortcut-recorder') as HTMLElement, { attributeFilter: ['data-shake'] });
                            },
                            style: () => {
                                let [x, y] = TRAVEL[view.direction[0]];

                                return `--demo-dx: ${x}; --demo-dy: ${y};`;
                            }
                        }}
                    >
                        ${shortcutRecorder({ 'aria-label': `${label} shortcut`, class: recorder, state, taken })}
                        ${tooltip.onclick({ class: 'shortcut-recorder-demo-stand-in', onrender: (element: HTMLElement) => { stand = element; }, state: tip }, html`
                            <div
                                class='tooltip-content tooltip-content--morph shortcut-recorder-demo-morph'
                                ${{ class: () => `tooltip-content--${view.direction}` }}
                            >
                                <span ${{ onrender: (element: HTMLElement) => { message = element; } }}></span>
                            </div>
                        `)}
                    </div>
                </div>
            </div>
        `;
    };
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
            // The field keeps only its red border and a shake of its keys; the message is the tooltip's alone.
            render: callout('Callout', 'shortcut-recorder-demo-bare'),
            title: 'error trial 1: callout'
        },
        {
            // The field keeps its own error swap, the keys sliding out as the message slides in blurred, but says only
            // "ERROR!"; the tooltip carries the message.
            render: callout('Error!', 'shortcut-recorder-demo-shout'),
            title: 'error trial 2: callout + ERROR!'
        }
    ]
};
