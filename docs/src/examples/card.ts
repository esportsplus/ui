import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { card } from '@esportsplus/ui/components';


let box = '--padding-horizontal: var(--size-500); --padding-vertical: var(--size-500); --border-radius: var(--border-radius-400); --width: 200px; background: var(--color-grey-300);',
    layers = [
        'Short',
        'A longer layer that wraps onto a few lines, so the card grows taller as well as wider.',
        'A medium length layer'
    ],
    notes = [
        {
            detail: 'Name the card and its dialog alike and the browser morphs one into the other, measuring both boxes and bridging them in CSS.',
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


function controlled() {
    let state = reactive({ open: null as string | null });

    return html`
        <div style='align-items: center; display: flex; flex-direction: column; gap: var(--size-500); width: 100%;'>
            ${card.expand({ items: notes, state })}
            <div style='align-items: center; display: flex; gap: var(--size-300);'>
                <button class='button' onclick='${() => state.open = 'springs'}' style='--width: auto;' type='button'>
                    open "Spring timing"
                </button>
                <span style='color: var(--color-text-300); font-size: var(--font-size-300);'>
                    ${() => `state.open: ${state.open ?? 'null'}`}
                </span>
            </div>
        </div>
    `;
}


function morph() {
    let shell: HTMLElement | undefined,
        rendered: HTMLElement[] = [],
        state = reactive({ active: 0 });

    function select(index: number) {
        let layer = rendered[index];

        state.active = index;

        if (!shell || !layer) {
            return;
        }

        shell.style.setProperty('--morph-height', `${layer.offsetHeight}px`);
        shell.style.setProperty('--morph-width', `${layer.offsetWidth}px`);
    }

    return html`
        <div style='align-items: flex-start; display: flex; flex-direction: column; gap: var(--size-400); height: 200px;'>
            <div style='display: flex; gap: var(--size-200);'>
                ${layers.map((_, index) => html`
                    <button class='button' onclick='${() => select(index)}' type='button'>Layer ${index + 1}</button>
                `)}
            </div>
            <div
                class='card card--morph'
                style='--padding-horizontal: var(--size-500); --padding-vertical: var(--size-500); --border-radius: var(--border-radius-400); --box-shadow: var(--box-shadow-300); background: var(--color-grey-300);'
                ${{
                    onconnect: (element: HTMLElement) => {
                        shell = element;
                        select(state.active);
                    }
                }}
            >
                <div class='card-morph-viewport' style='${() => `--i: ${state.active}`}'>
                    ${layers.map((text, index) => html`
                        <div
                            class='card-morph-layer frame frame--swap ${() => state.active === index && '--active'}'
                            inert='${() => state.active !== index}'
                            style='--n: ${index}'
                            ${{
                                onconnect: (element: HTMLElement) => {
                                    rendered[index] = element;
                                }
                            }}
                        >
                            <div class='text' style='max-width: 240px;'>${text}</div>
                        </div>
                    `)}
                </div>
            </div>
        </div>
    `;
}


export default {
    name: 'card',
    variants: [
        {
            render: () => html`
                <div class='card' style='${box} --box-shadow: var(--box-shadow-300);'>
                    <div class='text'>Card with shadow</div>
                </div>
            `,
            title: 'default'
        },
        {
            render: morph,
            title: 'card--morph'
        },
        {
            render: () => card.expand({ items: notes }),
            title: 'card.expand'
        },
        {
            render: controlled,
            title: 'card.expand controlled state'
        },
        {
            render: () => card.expand({
                items: notes,
                style: '--dialog-backdrop: oklch(from var(--color-black-500) l c h / 0.4); --dialog-width: 520px; --surface-background: var(--color-white-300);'
            }),
            title: 'card.expand white surfaces, darker backdrop'
        }
    ]
};
