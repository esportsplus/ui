// TEMPORARY: component review checklist. Delete this file and its registration in docs/app.ts when done.
import { tasklist } from '@esportsplus/ui/components';
import { effect, html, reactive } from 'docs/app';
import type { Router } from 'docs/app';
import layout from 'docs/components/layout';


type Item = { checked: boolean; label: string; name: string };


const COMPONENT_NAME = /\/components\/([^/]+)\//;

const STORAGE_KEY = 'docs:checklist';


// Lazy glob: only the keys are read, no component module is loaded. CSS-only components have no index.ts.
let names = [...new Set(
        Object.keys(import.meta.glob(['../../../src/components/*/index.ts', '../../../src/components/*/scss/index.scss']))
            .map((path) => path.match(COMPONENT_NAME)![1])
    )]
    .sort((a, b) => a.localeCompare(b));


function load(): Record<string, boolean> {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    }
    catch {
        return {};
    }
}

function save(items: Item[]) {
    let state: Record<string, boolean> = {};

    for (let i = 0, n = items.length; i < n; i++) {
        if (items[i].checked) {
            state[items[i].name] = true;
        }
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}


const page = () => ({
    render: () => {
        let state = load(),
            items: Item[] = names.map((name) => reactive({ checked: !!state[name], label: name, name }));

        // The tasklist writes 'checked' onto each task; reading them all here saves on every change. An 'onchange'
        // on the list never runs, since each row's own handler takes the delegated event first.
        effect(() => save(items));

        return html`
            <div class='page'>
                <section class='page-section'>
                    <h2>Component checklist</h2>

                    ${tasklist({
                        class: 'tasklist--plan',
                        [tasklist.item]: { style: '--background-default: var(--surface-background-default);' },
                        ordered: true,
                        style: 'max-width: 360px; width: 100%;',
                        tasks: items
                    })}
                </section>
            </div>
        `;
    },
    toc: []
});


export default (r: Router) => r
    .get({ name: 'checklist', path: '/checklist', responder: () => layout(page()) });
