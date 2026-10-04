import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { select, shortcutRecorder } from '@esportsplus/ui/components';
import 'docs/examples/shortcut-recorder/scss/index.scss';


type Direction = NonNullable<Parameters<typeof shortcutRecorder>[0]['direction']>;

type Row = {
    direction?: Direction;
    hint?: string;
    label: string;
    limit?: number;
    state: State;
    taken?: (shortcut: string) => string | undefined;
};

type State = { error: string, value: string };


// Every side and corner the error can open on, clockwise from the top left.
const DIRECTIONS: Direction[] = ['nw', 'n', 'ne', 'en', 'e', 'es', 'se', 's', 'sw', 'ws', 'w', 'wn'];

// Deliberately long, to see the message wrap rather than run off in one line.
const TAKEN: Record<string, string> = {
    'Mod+K': 'Open command menu',
    'Mod+L': 'Toggle the left sidebar and focus the file explorer in every open window'
};


function row({ direction, hint, label, limit, state, taken }: Row, border = false) {
    return html`
        <div class='shortcut-recorder-demo-row ${border && 'shortcut-recorder-demo-row--border'}'>
            <div class='shortcut-recorder-demo-label'>
                ${label}
                ${hint && html`<span class='shortcut-recorder-demo-hint'>${hint}</span>`}
            </div>
            ${shortcutRecorder({ 'aria-label': `${label} shortcut`, direction, limit, state, taken })}
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

// The field renders afresh whenever the direction changes; the state outlives it.
function errors() {
    let direction = reactive({ active: false, error: '', selected: 'ne' }),
        state = reactive({ error: '', value: '' });

    return html`
        <div class='shortcut-recorder-demo'>
            ${() => row({
                direction: direction.selected as Direction,
                hint: 'K alone, Mod+K, or Mod+L for a long one',
                label: 'Whole field',
                state,
                taken: (shortcut) => TAKEN[shortcut]
            })}
            <div class='shortcut-recorder-demo-row shortcut-recorder-demo-row--border'>
                <div class='shortcut-recorder-demo-label'>
                    Error direction
                    <span class='shortcut-recorder-demo-hint'>Where the message opens</span>
                </div>
                ${select({
                    class: 'shortcut-recorder-demo-direction',
                    label: 'Error direction',
                    options: DIRECTIONS.map((d) => ({ label: d, value: d })),
                    state: direction
                })}
            </div>
        </div>
    `;
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
            render: errors,
            title: 'callout, whole field shakes'
        }
    ]
};
