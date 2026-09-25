import { swipeDeck, toast } from '@esportsplus/ui';
import { html } from '@esportsplus/template';


type Person = {
    name: string;
    role: string;
    summary: string;
};

type Ticket = {
    from: string;
    subject: string;
};


let people: Person[] = [
    { name: 'Nadia Roussel', role: 'Design engineer', summary: 'Shipped a design system for a 40-person team.' },
    { name: 'Tomás Ibarra', role: 'Platform engineer', summary: 'Cut cold starts from four seconds to under one.' },
    { name: 'Priya Natarajan', role: 'Product designer', summary: 'Rebuilt onboarding; activation up 18%.' },
    { name: 'Jonah Okafor', role: 'Frontend engineer', summary: 'Owns the editor, from keybindings to collaboration.' }
];

let tickets: Ticket[] = [
    { from: 'mara@northwind.io', subject: 'Export stalls at 99%' },
    { from: 'devon@acme.dev', subject: 'Invoice shows the wrong seat count' },
    { from: 'li@fernhill.co', subject: 'SSO loop after password reset' }
];


export default {
    name: 'swipe-deck',
    variants: [
        {
            render: () => swipeDeck(
                {
                    itemLabel: (person: Person) => `${person.name}, ${person.role}`,
                    items: people,
                    label: 'Candidates',
                    style: 'max-width: 360px;'
                },
                (person) => html`
                    <div style='display: flex; flex-direction: column; height: 100%; justify-content: space-between; padding: var(--size-400);'>
                        <div style='font-weight: var(--font-weight-500); margin-top: var(--size-500);'>${person.name}</div>
                        <div style='color: var(--color-text-300); font-size: var(--font-size-300);'>${person.summary}</div>
                        <div style='color: var(--color-text-300); font-size: var(--font-size-200);'>${person.role}</div>
                    </div>
                `
            ),
            title: 'default'
        },
        {
            render: () => swipeDeck(
                {
                    emptyLabel: 'Queue empty. Undo reopens the last ticket.',
                    itemLabel: (ticket: Ticket) => `${ticket.subject}, from ${ticket.from}`,
                    items: tickets,
                    label: 'Support triage',
                    leftLabel: 'Archive',
                    onDecide: (ticket, choice) => toast.message(`${choice === 'right' ? 'Escalated' : 'Archived'}: ${ticket.subject}`),
                    onUndo: (ticket) => toast.message(`Reopened: ${ticket.subject}`),
                    rightLabel: 'Escalate',
                    style: 'max-width: 360px; --height: 168px;',
                    threshold: 104
                },
                (ticket) => html`
                    <div style='display: flex; flex-direction: column; height: 100%; justify-content: space-between; padding: var(--size-400);'>
                        <div style='font-weight: var(--font-weight-500); margin-top: var(--size-500);'>${ticket.subject}</div>
                        <div style='color: var(--color-text-300); font-size: var(--font-size-200);'>${ticket.from}</div>
                    </div>
                `
            ),
            title: 'triage with callbacks'
        }
    ]
};
