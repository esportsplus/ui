import { shortcutRecorder } from '@esportsplus/ui';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';


function shortcuts() {
    let rows = [
        { label: 'Open command menu', state: reactive({ value: 'Mod+K' }) },
        { label: 'New note', state: reactive({ value: 'Mod+N' }) },
        { label: 'Toggle sidebar', state: reactive({ value: 'Mod+B' }) }
    ];

    return html`
        <div style='display: grid; width: min(100%, 420px);'>
            ${rows.map((row, i) => shortcutRecorder({
                label: row.label,
                state: row.state,
                style: `padding: var(--size-400) 0; ${i ? 'border-top: 1px solid var(--color-border-300);' : ''}`,
                taken: (shortcut) => rows.find((other) => other !== row && other.state.value === shortcut)?.label
            }))}
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
            render: () => shortcutRecorder({ label: 'Toggle focus mode', style: 'width: min(100%, 420px);' }),
            title: 'empty'
        }
    ]
};
