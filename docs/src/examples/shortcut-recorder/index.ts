import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { shortcutRecorder } from '@esportsplus/ui/components';
import 'docs/examples/shortcut-recorder/scss/index.scss';


type Row = {
    hint?: string;
    label: string;
    limit?: number;
    state: State;
    taken?: (shortcut: string) => string | undefined;
};

type State = { error: string, value: string };


// Deliberately long, to see the message wrap rather than run off in one line.
const TAKEN: Record<string, string> = {
    'Mod+K': 'Open command menu',
    'Mod+L': 'Toggle the left sidebar and focus the file explorer in every open window'
};


function row({ hint, label, limit, state, taken }: Row, border = false) {
    return html`
        <div class='group group--grid shortcut-recorder-demo-row ${border && 'shortcut-recorder-demo-row--border'}'>
            <span class='group-label'>${label}</span>
            ${shortcutRecorder({ 'aria-label': `${label} shortcut`, description: hint, limit, state, taken })}
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

// The error slides open under the recorder; a long one wraps to its width.
function errors() {
    let state = reactive({ error: '', value: '' });

    return html`
        <div class='shortcut-recorder-demo'>
            ${row({ hint: 'K alone, Mod+K, or Mod+L for a long one', label: 'Whole field', state, taken: (shortcut) => TAKEN[shortcut] })}
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
            title: 'errors'
        }
    ]
};
