import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { statusPicker } from '@esportsplus/ui';
import './status-picker.scss';


type Status = 'away' | 'dnd' | 'invisible' | 'online';


// Steps away, goes do-not-disturb, then comes back online, walking the highlight like a pointer would.
function autoplay() {
    let state = reactive({ active: false, highlight: 0, status: 'online' as Status }),
        timers: ReturnType<typeof setTimeout>[] = [];

    function at(ms: number, fn: VoidFunction) {
        timers.push(setTimeout(fn, ms));
    }

    function pick(base: number, from: number, to: number, next: Status) {
        at(base, () => {
            state.active = true;
            state.highlight = from;
        });

        for (let i = from + 1, t = base + 450; i <= to; i++, t += 220) {
            let index = i;

            at(t, () => {
                state.highlight = index;
            });
        }

        at(base + 450 + (to - from) * 220 + 250, () => {
            state.status = next;
            state.active = false;
        });
    }

    function run() {
        timers.length = 0;
        pick(300, 0, 1, 'away');
        pick(2100, 1, 2, 'dnd');
        at(3900, () => {
            state.active = true;
            state.highlight = 2;
        });
        at(4350, () => {
            state.highlight = 1;
        });
        at(4570, () => {
            state.highlight = 0;
        });
        at(4900, () => {
            state.active = false;
            state.status = 'online';
        });
        at(6200, run);
    }

    return html`
        <div class='status-picker-demo'>
            ${statusPicker({
                initials: 'MR',
                name: 'Maya Ruiz',
                onconnect: run,
                ondisconnect: () => {
                    for (let i = 0, n = timers.length; i < n; i++) {
                        clearTimeout(timers[i]);
                    }
                },
                state
            })}
        </div>
    `;
}


export default {
    name: 'status-picker',
    variants: [
        {
            render: () => html`
                <div class='status-picker-demo'>
                    ${statusPicker({ initials: 'MR', name: 'Maya Ruiz' })}
                </div>
            `,
            title: 'default'
        },
        {
            render: autoplay,
            title: 'scripted'
        },
        {
            render: () => html`
                <div class='status-picker-demo'>
                    ${statusPicker({
                        initials: 'JK',
                        name: 'Jun Kato',
                        status: 'dnd',
                        statuses: [
                            { id: 'online', label: 'Available' },
                            { hint: 'Back in 15 minutes', id: 'away', label: 'Be right back' },
                            { hint: 'Only urgent pings', id: 'dnd', label: 'Focusing' },
                            { hint: 'Hidden from the roster', id: 'invisible', label: 'Offline' }
                        ]
                    })}
                </div>
            `,
            title: 'custom labels'
        }
    ]
};
