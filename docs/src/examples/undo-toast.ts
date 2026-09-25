import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { undoToast } from '@esportsplus/ui';


const FILES = [
    { id: 'roadmap', meta: '2.4 MB, edited 2h ago', name: 'Q3 roadmap.pdf' },
    { id: 'invoice', meta: '86 KB, edited yesterday', name: 'Invoice 0142.pdf' },
    { id: 'offsite', meta: '4.1 MB, edited Monday', name: 'Team offsite.jpg' },
    { id: 'notes', meta: '12 KB, edited Aug 29', name: 'Interview notes.md' }
];

const MESSAGES = [
    { id: 'standup', meta: 'Today, 9:30', name: 'Standup notes' },
    { id: 'review', meta: 'Yesterday', name: 'Design review' },
    { id: 'retro', meta: 'Friday', name: 'Sprint retro' }
];


export default {
    name: 'undo-toast',
    variants: [
        {
            render: () => undoToast({ items: FILES, restoreLabel: 'Restore demo', style: 'width: min(440px, 100%);' }),
            title: 'files'
        },
        {
            render: () => {
                let deleted = reactive({ names: '' }),
                    state = reactive({ empty: false, pending: 0 });

                return html`
                    <div style='display: flex; flex-direction: column; gap: var(--size-400); width: min(440px, 100%);'>
                        ${undoToast({
                            class: 'undo-toast--white',
                            duration: 8000,
                            emptyLabel: 'Inbox zero',
                            items: MESSAGES,
                            label: 'Messages',
                            ondelete: (items) => {
                                deleted.names = items.map((item) => item.name).join(', ');
                            },
                            restoreLabel: 'Bring them back',
                            state,
                            style: '--undo-toast-height: 188px;'
                        })}
                        <span style='color: var(--color-text-300); font-size: 14px;'>
                            ${() => state.pending ? `${state.pending} pending` : deleted.names ? `Deleted: ${deleted.names}` : 'Nothing deleted yet'}
                        </span>
                    </div>
                `;
            },
            title: 'longer window, observed'
        }
    ]
};
