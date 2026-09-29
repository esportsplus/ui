import { shortcutRecorder } from '@esportsplus/ui';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';


type Row = {
    label: string;
    limit?: number;
    state: { error: string, value: string };
    taken?: (shortcut: string) => string | undefined;
};


function row({ label, limit, state, taken }: Row, border = false) {
    return html`
        <div style='align-items: center; display: flex; gap: var(--size-400); justify-content: space-between; padding: var(--size-400) 0; ${border ? 'border-top: 1px solid var(--color-border-300);' : ''}'>
            <div style='color: var(--color-text-500); font-size: var(--font-size-400); min-width: 0;'>
                ${label}
                <div role='status' style='color: var(--color-red-400); font-size: var(--font-size-300); min-height: 1lh;'>
                    ${() => state.error}
                </div>
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
        <div style='display: grid; width: min(100%, 420px);'>
            ${rows.map((r, i) => row(r, i > 0))}
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
                <div style='width: min(100%, 420px);'>
                    ${row({ label: 'Quick switch', limit: 2, state: reactive({ error: '', value: '' }) })}
                </div>
            `,
            title: 'limit'
        }
    ]
};
