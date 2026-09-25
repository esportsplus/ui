import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { kanbanBoard } from '@esportsplus/ui';


let columns = [
    {
        cards: [
            { id: 'spec', title: 'Draft spec' },
            { id: 'icons', title: 'Icon set' },
            { id: 'copy', title: 'Empty states' }
        ],
        id: 'todo',
        title: 'Todo'
    },
    {
        cards: [
            { id: 'login', title: 'Login flow' },
            { id: 'review', title: 'Review PR' }
        ],
        id: 'doing',
        title: 'Doing'
    },
    {
        cards: [{ id: 'tokens', title: 'Color tokens' }],
        id: 'done',
        title: 'Done'
    }
];


export default {
    name: 'kanban-board',
    variants: [
        {
            render: () => kanbanBoard({ columns, label: 'Project board' }),
            title: 'drag between columns'
        },
        {
            render: () => {
                let state = reactive({ summary: columns.map((column) => `${column.title}: ${column.cards.length}`).join(' · ') });

                return html`
                    <div style='display: flex; flex-direction: column; gap: var(--size-400); align-items: center;'>
                        ${kanbanBoard({
                            columns,
                            label: 'Project board',
                            onsort: (next) => {
                                state.summary = next.map((column) => `${column.title}: ${column.cards.map((card) => card.title).join(', ') || '—'}`).join(' · ');
                            }
                        })}
                        <span style='color: var(--color-text-300); font-size: var(--font-size-300);'>${() => state.summary}</span>
                    </div>
                `;
            },
            title: 'onsort'
        }
    ]
};
