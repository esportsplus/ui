// TEMPORARY: component review checklist. Delete this file and its registration in docs/app.ts when done.
import { tasklist } from '@esportsplus/ui/components';
import type { Task } from '@esportsplus/ui/components/tasklist';
import { html } from 'docs/app';
import type { Router } from 'docs/app';
import layout from 'docs/components/layout';


const COMPONENT_NAME = /\/components\/([^/]+)\/index\.ts$/;

const STORAGE_KEY = 'docs:checklist';


// Lazy glob: only the keys are read, no component module is loaded
let names = Object.keys(import.meta.glob('../../../src/components/*/index.ts'))
    .map((path) => path.match(COMPONENT_NAME)![1])
    .sort((a, b) => a.localeCompare(b));


function load(): Record<string, boolean> {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    }
    catch {
        return {};
    }
}

function save(tasks: (Task & { name: string })[]) {
    let state: Record<string, boolean> = {};

    for (let task of tasks) {
        if (task.checked) {
            state[task.name] = true;
        }
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}


const page = () => {
    let state = load(),
        tasks = names.map((name) => ({ checked: !!state[name], label: name, name }));

    return {
        render: () => html`
            <div class='page'>
                <section class='page-section'>
                    <h2>Component checklist</h2>

                    ${tasklist({
                        class: 'tasklist--plan',
                        // Deferred so the row's own handler has written 'checked' onto its task first
                        onchange: () => queueMicrotask(() => save(tasks)),
                        [tasklist.item]: { style: '--background-default: var(--surface-background-default);' },
                        ordered: true,
                        style: 'max-width: 360px; width: 100%;',
                        tasks
                    })}
                </section>
            </div>
        `,
        toc: []
    };
};


export default (r: Router) => r
    .get({ name: 'checklist', path: '/checklist', responder: () => layout(page()) });
