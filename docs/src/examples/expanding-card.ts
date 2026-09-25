import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { expandingCard } from '@esportsplus/ui';


let notes = [
    {
        detail: 'Give two elements the same layoutId and Motion animates one into the other, measuring both boxes and bridging them with transforms.',
        id: 'layouts',
        meta: 'Sep 18',
        summary: 'Cards morph into their detail view.',
        title: 'Shared layouts'
    },
    {
        detail: 'Describe a spring by how long it should feel and how much it should overshoot, instead of tuning stiffness and damping by hand.',
        id: 'springs',
        meta: 'Aug 30',
        summary: 'Springs take a duration and bounce.',
        title: 'Spring timing'
    },
    {
        detail: 'When the system asks for less motion, the card and its detail view cross-fade in place with nothing flying across the screen.',
        id: 'motion',
        meta: 'Aug 12',
        summary: 'Morphs become a plain swap.',
        title: 'Reduced motion'
    }
];


export default {
    name: 'expanding-card',
    variants: [
        {
            render: () => expandingCard({ items: notes }),
            title: 'notes'
        },
        {
            render: () => {
                let state = reactive({ open: null as string | null });

                return html`
                    <div style='align-items: center; display: flex; flex-direction: column; gap: var(--size-500); width: 100%;'>
                        ${expandingCard({ items: notes, state })}
                        <div style='align-items: center; display: flex; gap: var(--size-300);'>
                            <div class='button button--tertiary' style='--width: auto;' onclick='${() => state.open = 'springs'}'>
                                open "Spring timing"
                            </div>
                            <span style='color: var(--color-text-300); font-size: var(--font-size-300);'>
                                ${() => `state.open: ${state.open ?? 'null'}`}
                            </span>
                        </div>
                    </div>
                `;
            },
            title: 'controlled state'
        },
        {
            render: () => expandingCard({
                items: notes,
                style: '--card-background: var(--color-white-300); --dialog-background: var(--color-white-300); --dialog-backdrop: oklch(from var(--color-black-500) l c h / 0.4); --dialog-width: 520px;'
            }),
            title: 'white surfaces, darker backdrop'
        }
    ]
};
