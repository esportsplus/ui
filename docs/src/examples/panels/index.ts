import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { panels } from '@esportsplus/ui/components';
import type { Catalog, Node } from '@esportsplus/ui/components/panels';
import type { Entry } from 'docs/types';
import file from '@esportsplus/ui/svg/file-text.svg';
import gear from '@esportsplus/ui/svg/gear.svg';
import inbox from '@esportsplus/ui/svg/inbox.svg';
import pencil from '@esportsplus/ui/svg/pencil.svg';
import 'docs/examples/panels/scss/index.scss';


// Each surface keeps its own state, so a count or a draft survives dragging its tab anywhere in the layout.
const catalog: Catalog = {
    counter: {
        description: 'A count that survives every move.',
        icon: gear,
        multiple: true,
        render: (surface) => {
            let state = reactive({ count: 0 });

            return html`
                <div class='panels-demo-surface'>
                    <span class='panels-demo-count'>${() => state.count}</span>
                    <button class='button button--tactile' type='button' onclick='${() => state.count++}'>Increment ${surface.id}</button>
                </div>
            `;
        },
        shortcut: 'C',
        title: (surface) => surface.id ? `Counter ${surface.id.split('-')[1] ?? ''}`.trim() : 'Counter'
    },
    inbox: {
        description: 'A list to scroll through.',
        icon: inbox,
        render: () => html`
            <ul class='panels-demo-list'>
                ${Array.from({ length: 24 }, (_, i) => html`<li>Message ${i + 1}</li>`)}
            </ul>
        `,
        shortcut: 'I',
        title: 'Inbox'
    },
    notes: {
        description: 'A draft that keeps what you typed.',
        icon: pencil,
        render: () => html`<textarea aria-label='Notes' class='panels-demo-notes' placeholder='Type here, then drag this tab…'></textarea>`,
        shortcut: 'N',
        title: 'Notes'
    },
    readme: {
        description: 'Static text.',
        icon: file,
        render: () => html`
            <div class='panels-demo-surface panels-demo-surface--text'>
                <p>Drag a tab along the strip to reorder it, into another group to move it, onto a group's half to split
                it, or onto the bottom strip to dock it. Drag a separator to resize, double-click a header to maximize.</p>
            </div>
        `,
        shortcut: 'R',
        title: 'Readme'
    }
};


function demo(root: Node | null = null) {
    return html`
        <div class='panels-demo'>
            ${panels({ catalog, state: panels.state({ root }) })}
        </div>
    `;
}


export default {
    name: 'panels',
    variants: [
        {
            render: () => demo({
                children: [
                    {
                        active: 'readme',
                        id: 'group-1',
                        kind: 'group',
                        surfaces: [{ id: 'readme', kind: 'readme' }, { id: 'notes', kind: 'notes' }]
                    },
                    {
                        active: 'counter-1',
                        id: 'group-2',
                        kind: 'group',
                        surfaces: [{ id: 'counter-1', kind: 'counter' }, { id: 'inbox', kind: 'inbox' }]
                    }
                ],
                direction: 'row',
                id: 'split-1',
                kind: 'split',
                sizes: [0.5, 0.5]
            }),
            title: 'workspace'
        },
        {
            render: () => demo(),
            title: 'empty'
        }
    ]
} satisfies Entry;
