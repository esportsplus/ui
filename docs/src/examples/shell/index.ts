import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import shell from '@esportsplus/ui/components/shell';
import type { Entry } from 'docs/types';
import 'docs/examples/shell/scss/index.scss';


// A sidebar's stand-in content: a title over a few rows.
function content(title: string, rows: string[]) {
    return html`
        <div class='shell-demo-panel'>
            <strong class='shell-demo-panel-title'>${title}</strong>
            ${rows.map((row) => html`<div class='shell-demo-panel-row'>${row}</div>`)}
        </div>
    `;
}


export default {
    name: 'shell',
    variants: [
        {
            render: () => {
                let left = {
                        content: content('Navigation', ['Inbox', 'Projects', 'Calendar', 'Settings']),
                        id: 'shell-demo-left',
                        label: 'Navigation',
                        state: reactive({ active: false })
                    },
                    right = {
                        content: content('Details', ['Owner', 'Status', 'Updated']),
                        hover: true,
                        id: 'shell-demo-right',
                        label: 'Details',
                        state: reactive({ active: false })
                    };

                return html`
                    <div class='shell-demo'>
                        ${shell({ left, right }, html`
                            <div class='shell-demo-main'>
                                <strong>Main content</strong>
                                <p>
                                    Hover near the left edge to bring out its handle, which follows the pointer: click it
                                    to open the sidebar, or drag it to pull the sidebar out. Drag an open sidebar back
                                    toward its edge to close it. The right sidebar opens on hover instead, peeking while
                                    the pointer rests on its edge and closing once it leaves. Either opens from its corner
                                    button too.
                                </p>
                            </div>
                        `)}
                    </div>
                `;
            },
            title: 'drag, hover and peek'
        }
    ]
} satisfies Entry;
