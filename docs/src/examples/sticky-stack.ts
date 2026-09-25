import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { stickyStack } from '@esportsplus/ui';
import './sticky-stack.scss';


const PRINCIPLES = [
    { text: 'Feedback starts the moment a finger lands, not when it lifts.', title: 'Respond on press' },
    { text: 'Anything in motion can be grabbed mid flight and sent somewhere else.', title: 'Stay interruptible' },
    { text: 'A release carries on at exactly the speed the hand gave it.', title: 'Keep the velocity' },
    { text: 'What slides in from the right goes back out to the right.', title: 'Leave the way you came' },
    { text: 'Motion people see a hundred times a day should barely be there.', title: 'Show restraint' }
];

const RELEASES = [
    { text: 'Streams the first byte before the database answers.', title: 'Edge rendering' },
    { text: 'Tabs, windows and devices agree within a second.', title: 'Live sync' },
    { text: 'Every screen works without a network, then catches up.', title: 'Offline first' }
];


function heading(title: string, subtitle: string) {
    return html`
        <h2 class='sticky-stack-demo-title'>${title}</h2>
        <p class='sticky-stack-demo-subtitle'>${subtitle}</p>
    `;
}


export default {
    name: 'sticky-stack',
    variants: [
        {
            render: () => stickyStack(
                { items: PRINCIPLES, label: 'Five principles of motion' },
                heading('Five principles of motion', 'Scroll to stack them up.')
            ),
            title: 'default'
        },
        {
            render: () => {
                let state = reactive({ active: 0 });

                return html`
                    <div class='sticky-stack-demo'>
                        ${stickyStack(
                            { class: 'sticky-stack--compact', items: RELEASES, label: 'Release highlights', state },
                            heading('Release highlights', 'Three things that shipped this month.')
                        )}
                        <span class='sticky-stack-demo-status'>${() => `On top: ${RELEASES[state.active].title}`}</span>
                    </div>
                `;
            },
            title: 'compact (observed state)'
        },
        {
            render: () => stickyStack(
                { class: 'sticky-stack--flat', items: PRINCIPLES, label: 'Five principles of motion' },
                heading('Flat stack', 'No scale or shade, just the offset strips.')
            ),
            title: 'flat'
        }
    ]
};
