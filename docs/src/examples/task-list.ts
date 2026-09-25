import { taskList } from '@esportsplus/ui';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { chat, icons, replay } from './agent';


let tasks = () => [
    {
        icon: icons.search(),
        runningTitle: 'Searching project files',
        steps: [
            { label: 'Searching "app/page.tsx, components structure"' },
            { chips: [{ icon: icons.react(), label: 'page.tsx' }], label: 'Read' },
            { label: 'Scanning 52 files' },
            { chips: [{ icon: icons.react(), label: 'layout.tsx' }], label: 'Reading files' }
        ],
        title: 'Found project files'
    },
    {
        icon: icons.code(),
        runningTitle: 'Editing files',
        steps: [
            { chips: [{ icon: icons.react(), label: 'theme-toggle.tsx' }], label: 'Created' },
            { chips: [{ icon: icons.react(), label: 'layout.tsx' }], label: 'Wired it into' },
            { label: 'Ran lint and type-check, 0 errors' }
        ],
        title: 'Registered the theme toggle'
    }
];


function driven() {
    let list = tasks(),
        state = reactive({ revealed: 0 }),
        units = list.reduce((total, task) => total + 1 + task.steps.length, 0);

    return html`
        <div class='agent-demo'>
            ${taskList({ state, tasks: list })}
            <div style='display: flex; gap: var(--size-300);'>
                <div class='button button--tertiary' style='--width: auto;' onclick='${() => state.revealed = Math.min(state.revealed + 1, units)}'>
                    next event
                </div>
                <div class='button button--tertiary' style='--width: auto;' onclick='${() => state.revealed = 0}'>
                    reset
                </div>
            </div>
        </div>
    `;
}


export default {
    name: 'task-list',
    variants: [
        {
            render: () => replay((onComplete) => taskList({ onComplete, tasks: tasks() })),
            title: 'default'
        },
        {
            render: () => chat(
                'Add a dark mode toggle to the dashboard',
                [
                    'Done. The toggle lives in the header and persists the choice to localStorage, so a reload keeps it.',
                    'It reads the system preference only on first visit, then the manual choice wins.'
                ],
                (onComplete) => taskList({ onComplete, tasks: tasks() })
            ),
            title: 'in a chat'
        },
        {
            render: () => replay((onComplete) => taskList({ collapseOnComplete: true, onComplete, startDelay: 320, stepInterval: 850, tasks: tasks() })),
            title: 'collapse each task as it lands'
        },
        {
            render: () => replay((onComplete) => taskList({ collapseOnComplete: 'all', onComplete, tasks: tasks() })),
            title: 'collapse all when the run lands'
        },
        {
            render: () => replay((onComplete) => taskList({ onComplete, stepInterval: 450, tasks: tasks(), working: 'Thinking' })),
            title: 'faster pacing, relabelled indicator'
        },
        {
            render: driven,
            title: 'driven from real events'
        }
    ]
};
