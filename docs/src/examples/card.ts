import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';


let box = '--padding-horizontal: var(--size-500); --padding-vertical: var(--size-500); --border-radius: var(--border-radius-400); --width: 200px;',
    layers = [
        'Short',
        'A longer layer that wraps onto a few lines, so the card grows taller as well as wider.',
        'A medium length layer'
    ];


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
                style='--padding-horizontal: var(--size-500); --padding-vertical: var(--size-500); --border-radius: var(--border-radius-400);'
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
                            <div class='preview-text' style='max-width: 240px;'>${text}</div>
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
                <div class='card' style='${box}'>
                    <div class='preview-text'>Card with shadow</div>
                </div>
            `,
            title: 'default'
        },
        {
            render: morph,
            title: 'card--morph'
        }
    ]
};
